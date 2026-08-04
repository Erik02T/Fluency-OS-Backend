import { Prisma, PrismaClient } from '@prisma/client';
import { loadSeedKanjis, type SeedKanji } from '../src/modules/kanji/seed/kanjidic2-seed';

const prisma = new PrismaClient();

function buildKanjiUpsertData(item: SeedKanji): Prisma.KanjiCreateInput & Prisma.KanjiUpdateInput {
  return {
    character: item.character,
    unicodeCodepoint: item.unicodeCodepoint || undefined,
    jlptLevel: item.jlptLevel,
    grade: item.grade,
    strokeCount: item.strokeCount,
    frequency: item.frequencyRank,
    notes: item.notes,
    romanization: item.readings.find((reading) => reading.type === 'ONYOMI')?.romanization,
  };
}

async function syncKanjiRelations(tx: Prisma.TransactionClient, kanjiId: string, item: SeedKanji): Promise<void> {
  await tx.kanjiMeaning.deleteMany({ where: { kanjiId } });
  await tx.kanjiReading.deleteMany({ where: { kanjiId } });
  await tx.kanjiExample.deleteMany({ where: { kanjiId } });
  await tx.kanjiRadical.deleteMany({ where: { kanjiId } });

  if (item.meanings.length > 0) {
    await tx.kanjiMeaning.createMany({
      data: item.meanings.map((meaning, position) => ({
        kanjiId,
        meaning,
        language: item.notes?.startsWith('Fallback: meanings em inglês') ? 'en' : 'pt-BR',
        isPrimary: position === 0,
        position,
      })),
    });
  }

  if (item.readings.length > 0) {
    await tx.kanjiReading.createMany({
      data: item.readings.map((reading) => ({
        kanjiId,
        reading: reading.reading,
        type: reading.type,
        romanji: reading.romanization,
        isPrimary: reading.isCommon ?? false,
      })),
    });
  }

  if (item.examples.length > 0) {
    await tx.kanjiExample.createMany({
      data: item.examples.map((example, position) => ({
        kanjiId,
        word: example.word,
        reading: example.reading,
        meaning: example.meaning,
        jlptLevel: position === 0 ? item.jlptLevel : null,
        position,
      })),
    });
  }

  for (const radicalData of item.radicals) {
    const radical = await tx.radical.upsert({
      where: { character: radicalData.character },
      update: {
        name: radicalData.name,
        meaning: radicalData.meaning,
        strokeCount: radicalData.strokeCount,
        position: radicalData.position,
      },
      create: {
        character: radicalData.character,
        name: radicalData.name,
        meaning: radicalData.meaning,
        strokeCount: radicalData.strokeCount,
        position: radicalData.position,
      },
    });

    await tx.kanjiRadical.create({
      data: {
        kanjiId,
        radicalId: radical.id,
        isPrimary: radicalData.isPrimary ?? false,
      },
    });
  }
}

async function seedKanji(item: SeedKanji): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const kanji = await tx.kanji.upsert({
      where: { character: item.character },
      update: buildKanjiUpsertData(item),
      create: buildKanjiUpsertData(item),
    });

    await syncKanjiRelations(tx, kanji.id, item);
  });
}

async function main(): Promise<void> {
  const kanjis = await loadSeedKanjis();

  for (const item of kanjis) {
    await seedKanji(item);
  }

  console.log(`Seed completed: ${kanjis.length} kanjis inserted/updated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
