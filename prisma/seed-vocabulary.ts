import { Prisma, PrismaClient, JLPTLevel } from '@prisma/client';
import {
  loadSeedVocabulary,
  type ImportSummary,
  type VocabularyPrismaData,
  type PipelineResult,
} from '../src/modules/vocabulary/seed';

const prisma = new PrismaClient();

const CHUNK_SIZE = 200;

type WordReadingKey = string;

function wordReadingKey(word: string, reading: string): WordReadingKey {
  return `${word}\x00${reading}`;
}

async function collectExistingKeys(): Promise<{
  existingSet: Set<WordReadingKey>;
  existingMap: Map<WordReadingKey, string>;
}> {
  const existing = await prisma.vocabulary.findMany({
    select: { id: true, word: true, reading: true },
  });

  const existingSet = new Set<WordReadingKey>();
  const existingMap = new Map<WordReadingKey, string>();

  for (const row of existing) {
    const k = wordReadingKey(row.word, row.reading);
    existingSet.add(k);
    existingMap.set(k, row.id);
  }

  return { existingSet, existingMap };
}

function splitIntoChunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function computeJlptDistribution(
  items: VocabularyPrismaData[],
): Record<JLPTLevel | 'UNKNOWN', number> {
  const dist: Record<JLPTLevel | 'UNKNOWN', number> = {
    N5: 0,
    N4: 0,
    N3: 0,
    N2: 0,
    N1: 0,
    UNKNOWN: 0,
  };

  for (const it of items) {
    if (it.jlptLevel && Object.values(JLPTLevel).includes(it.jlptLevel)) {
      dist[it.jlptLevel]++;
    } else {
      dist.UNKNOWN++;
    }
  }

  return dist;
}

type InsertChunkResult = {
  inserted: number;
  updated: number;
  meaningsInserted: number;
  examplesInserted: number;
};

async function insertChunk(
  tx: Prisma.TransactionClient,
  chunk: VocabularyPrismaData[],
): Promise<InsertChunkResult> {
  let inserted = 0;
  let updated = 0;
  let meaningsInserted = 0;
  let examplesInserted = 0;

  for (const data of chunk) {
    const createInput: Prisma.VocabularyCreateInput = {
      word: data.word,
      reading: data.reading,
      jlptLevel: data.jlptLevel ?? undefined,
      frequency: data.frequency ?? undefined,
      partOfSpeech: data.partOfSpeech ?? undefined,
      tags: data.tags,
      notes: data.notes ?? undefined,
      audioUrl: data.audioUrl ?? undefined,
    };

    try {
      const created = await tx.vocabulary.create({
        data: createInput,
        select: { id: true },
      });
      inserted++;

      if (data.meanings.length > 0) {
        await tx.vocabularyMeaning.createMany({
          data: data.meanings.map((m) => ({
            vocabularyId: created.id,
            meaning: m.meaning,
            context: m.context ?? null,
            isPrimary: m.isPrimary,
            position: m.position,
          })),
          skipDuplicates: true,
        });
        meaningsInserted += data.meanings.length;
      }

      if (data.examples.length > 0) {
        await tx.vocabularyExample.createMany({
          data: data.examples.map((ex) => ({
            vocabularyId: created.id,
            japanese: ex.japanese,
            reading: ex.reading ?? null,
            translation: ex.translation,
            source: ex.source ?? null,
          })),
          skipDuplicates: true,
        });
        examplesInserted += data.examples.length;
      }
    } catch (e: unknown) {
      const prismaErr = e as { code?: string; message?: string };
      if (prismaErr?.code === 'P2002') {
        updated++;
        continue;
      }
      throw e;
    }
  }

  return { inserted, updated, meaningsInserted, examplesInserted };
}

async function main(): Promise<void> {
  console.log('='.repeat(72));
  console.log('Vocabulary Seed Pipeline — JMdict import');
  console.log('='.repeat(72));

  console.log(
    '\n[1/4] Parsing JMdict JSON and running transformation pipeline...',
  );
  let pipeline: PipelineResult;
  try {
    pipeline = loadSeedVocabulary();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const { prismaData, stats } = pipeline;

  console.log(
    `  • JMdict entries:             ${stats.totalJmdictEntries.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • Raw (word+reading combos):  ${stats.rawEntries.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • Normalized entries:         ${stats.normalizedEntries.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • After internal dedupe:      ${stats.dedupedEntries.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • Valid entries:              ${stats.validEntries.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • Invalid entries (skipped):  ${stats.invalidEntries.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • Internal duplicates:        ${stats.skippedDuplicated.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • Selected for DB insert:     ${stats.selectedEntries.toLocaleString('pt-BR')}`,
  );

  console.log(
    '\n[2/4] Fetching existing vocabulary keys from DB for idempotency...',
  );
  const { existingSet } = await collectExistingKeys();
  console.log(
    `  • Existing vocabulary rows:   ${existingSet.size.toLocaleString('pt-BR')}`,
  );

  const toInsert = prismaData.filter(
    (data) => !existingSet.has(wordReadingKey(data.word, data.reading)),
  );
  const alreadyExists = prismaData.length - toInsert.length;
  console.log(
    `  • Already in DB (skip):       ${alreadyExists.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  • Pending insert:             ${toInsert.length.toLocaleString('pt-BR')}`,
  );

  const jlptDist = computeJlptDistribution(prismaData);
  const withoutExamples = prismaData.filter(
    (d) => d.examples.length === 0,
  ).length;

  console.log(
    '\n[3/4] Inserting into PostgreSQL in batches (transactional)...',
  );
  const chunks = splitIntoChunks(toInsert, CHUNK_SIZE);
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalMeanings = 0;
  let totalExamples = 0;
  const errorsLogged: string[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    try {
      const result = await prisma.$transaction(async (tx) =>
        insertChunk(tx, chunk),
      );
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      totalMeanings += result.meaningsInserted;
      totalExamples += result.examplesInserted;

      const progress = Math.round(((ci + 1) / chunks.length) * 100);
      process.stdout.write(
        `    [${String(ci + 1).padStart(String(chunks.length).length, '0')}/${chunks.length}] ` +
          `${progress}% — inserted=${totalInserted}, meanings=${totalMeanings}\r`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errorsLogged.push(`chunk#${ci} (n=${chunk.length}): ${msg}`);
    }
  }
  process.stdout.write('\n');

  const summary: ImportSummary = {
    totalJmdictEntries: stats.totalJmdictEntries,
    validEntries: stats.validEntries,
    selectedForImport: stats.selectedEntries,
    skippedInvalid: stats.invalidEntries,
    skippedDuplicated: stats.skippedDuplicated,
    alreadyExistsInDb: alreadyExists,
    insertedInThisRun: totalInserted,
    updatedInThisRun: totalUpdated,
    totalMeaningsInserted: totalMeanings,
    totalExamplesInserted: totalExamples,
    withoutExamples,
    jlptDistribution: jlptDist,
    errorsLogged,
  };

  console.log('\n[4/4] Import Summary');
  console.log('-'.repeat(72));
  console.log(
    `  Inserted vocabulary rows:        ${summary.insertedInThisRun.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  Already existed (skip):          ${summary.alreadyExistsInDb.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  Skipped (invalid schema):        ${summary.skippedInvalid.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  Skipped (internal duplicates):   ${summary.skippedDuplicated.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  VocabularyMeaning rows added:    ${summary.totalMeaningsInserted.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  VocabularyExample rows added:    ${summary.totalExamplesInserted.toLocaleString('pt-BR')}`,
  );
  console.log(
    `  Entries without examples:        ${summary.withoutExamples.toLocaleString('pt-BR')}`,
  );
  console.log('');
  console.log('  JLPT distribution (selected set):');
  console.log(`    N5:        ${jlptDist.N5.toLocaleString('pt-BR')}`);
  console.log(`    N4:        ${jlptDist.N4.toLocaleString('pt-BR')}`);
  console.log(`    N3:        ${jlptDist.N3.toLocaleString('pt-BR')}`);
  console.log(`    N2:        ${jlptDist.N2.toLocaleString('pt-BR')}`);
  console.log(`    N1:        ${jlptDist.N1.toLocaleString('pt-BR')}`);
  console.log(`    UNKNOWN:   ${jlptDist.UNKNOWN.toLocaleString('pt-BR')}`);
  if (errorsLogged.length > 0) {
    console.log(`\n  ⚠  Errors logged (${errorsLogged.length} chunks):`);
    for (const err of errorsLogged.slice(0, 5)) {
      console.log(`    - ${err}`);
    }
    if (errorsLogged.length > 5) {
      console.log(`    ... and ${errorsLogged.length - 5} more.`);
    }
  }

  console.log('\n✅ Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('\n❌ Fatal error during vocabulary seed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
