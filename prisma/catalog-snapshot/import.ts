import { Prisma, PrismaClient, ReviewStatus } from '@prisma/client';
import type { Catalog, Grammar, Vocabulary } from './schema';
import { grammarKey, loadSnapshot, vocabularyKey } from './snapshot';

function missingParents<T extends { id: string }>(
  source: T[],
  target: { id: string }[],
  sourceKey: (row: T) => string | undefined,
  targetKeys: Map<string, Set<string>>,
): T[] {
  const ids = new Set(target.map(({ id }) => id));
  return source.filter((row) => {
    const key = sourceKey(row);
    const matchingIds = key === undefined ? undefined : targetKeys.get(key);
    if (
      matchingIds &&
      (matchingIds.size > 1 || (ids.has(row.id) && !matchingIds.has(row.id)))
    ) {
      throw new Error('Conflicting identities for snapshot record ' + row.id);
    }
    return !ids.has(row.id) && !matchingIds;
  });
}

function indexKeys<T extends { id: string }>(
  rows: T[],
  getKey: (row: T) => string | undefined,
) {
  const keys = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = getKey(row);
    if (key === undefined) continue;
    const ids = keys.get(key) ?? new Set<string>();
    ids.add(row.id);
    keys.set(key, ids);
  }
  return keys;
}

async function insertBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<{ count: number }>,
) {
  const batchSize = 500;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const { count } = await insert(batch);
    if (count !== batch.length)
      throw new Error('Database inserted an incomplete batch');
  }
  return rows.length;
}

async function importVocabulary(
  tx: Prisma.TransactionClient,
  source: Vocabulary[],
) {
  const target = await tx.vocabulary.findMany({
    select: { id: true, word: true, reading: true },
  });
  const pending = missingParents(
    source,
    target,
    vocabularyKey,
    indexKeys(target, vocabularyKey),
  );
  const inserted = await insertBatches(
    pending.map(({ meanings: _meanings, examples: _examples, ...row }) => row),
    (data) => tx.vocabulary.createMany({ data }),
  );
  const insertedMeanings = await insertBatches(
    pending.flatMap(({ id, meanings }) =>
      meanings.map((meaning) => ({ ...meaning, vocabularyId: id })),
    ),
    (data) => tx.vocabularyMeaning.createMany({ data }),
  );
  const insertedExamples = await insertBatches(
    pending.flatMap(({ id, examples }) =>
      examples.map((example) => ({ ...example, vocabularyId: id })),
    ),
    (data) => tx.vocabularyExample.createMany({ data }),
  );

  return {
    inserted,
    preserved: source.length - inserted,
    insertedMeanings,
    insertedExamples,
  };
}

function newGrammarPoint({
  examples: _examples,
  reviewStatus,
  reviewedAt,
  enrichmentData,
  patternFurigana,
  patternKanjiBreakdown,
  ...row
}: Grammar): Prisma.GrammarPointCreateManyInput {
  const wasPublished = reviewStatus === ReviewStatus.PUBLISHED;
  return {
    ...row,
    reviewStatus: wasPublished ? ReviewStatus.VALIDATED : reviewStatus,
    reviewedAt: wasPublished ? null : reviewedAt,
    enrichmentData: enrichmentData ?? Prisma.DbNull,
    patternFurigana: patternFurigana ?? Prisma.DbNull,
    patternKanjiBreakdown: patternKanjiBreakdown ?? Prisma.DbNull,
  };
}

async function importGrammar(tx: Prisma.TransactionClient, source: Grammar[]) {
  const target = await tx.grammarPoint.findMany({
    select: { id: true, source: true, sourceId: true },
  });
  const pending = missingParents(
    source,
    target,
    grammarKey,
    indexKeys(target, grammarKey),
  );
  const inserted = await insertBatches(pending.map(newGrammarPoint), (data) =>
    tx.grammarPoint.createMany({ data }),
  );
  const insertedExamples = await insertBatches(
    pending.flatMap(({ id, examples }) =>
      examples.map(({ furigana, kanjiBreakdown, ...example }) => ({
        ...example,
        grammarPointId: id,
        furigana: furigana ?? Prisma.DbNull,
        kanjiBreakdown: kanjiBreakdown ?? Prisma.DbNull,
      })),
    ),
    (data) => tx.grammarExample.createMany({ data }),
  );

  return { inserted, preserved: source.length - inserted, insertedExamples };
}

export async function importSnapshot(
  destinationUrl: string,
  catalog?: Catalog,
) {
  const { manifest, rows } = loadSnapshot();
  const prisma = new PrismaClient({ datasourceUrl: destinationUrl });
  const includeVocabulary = catalog !== 'grammar';
  const includeGrammar = catalog !== 'vocabulary';

  const result = await prisma
    .$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`;
        if (includeVocabulary) {
          await tx.$executeRaw`LOCK TABLE vocabulary, vocabulary_meanings, vocabulary_examples IN SHARE ROW EXCLUSIVE MODE`;
        }
        if (includeGrammar) {
          await tx.$executeRaw`LOCK TABLE grammar_points, grammar_examples IN SHARE ROW EXCLUSIVE MODE`;
        }

        return {
          ...(includeVocabulary && {
            vocabulary: await importVocabulary(tx, rows.vocabulary),
          }),
          ...(includeGrammar && {
            grammar: await importGrammar(tx, rows.grammar),
          }),
        };
      },
      { maxWait: 10_000, timeout: 120_000 },
    )
    .finally(() => prisma.$disconnect());

  return { datasetVersion: manifest.datasetVersion, ...result };
}
