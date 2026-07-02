import { JLPTLevel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedKanji = {
  character: string;
  unicodeCodepoint: string;
  jlptLevel: JLPTLevel;
  grade: number;
  strokeCount: number;
  frequencyRank: number;
  meanings: string[];
  readings: Array<{
    reading: string;
    type: 'ONYOMI' | 'KUNYOMI';
    romanization: string;
    isCommon?: boolean;
  }>;
  examples: Array<{
    word: string;
    reading: string;
    meaning: string;
  }>;
  radicals: Array<{
    character: string;
    name: string;
    strokeCount: number;
    meaning: string;
    position: number;
    isPrimary?: boolean;
  }>;
};

const kanjis: SeedKanji[] = [
  {
    character: '日',
    unicodeCodepoint: 'U+65E5',
    jlptLevel: 'N5',
    grade: 1,
    strokeCount: 4,
    frequencyRank: 1,
    meanings: ['sol', 'dia'],
    readings: [
      {
        reading: 'ニチ',
        type: 'ONYOMI',
        romanization: 'nichi',
        isCommon: true,
      },
      { reading: 'ジツ', type: 'ONYOMI', romanization: 'jitsu' },
      { reading: 'ひ', type: 'KUNYOMI', romanization: 'hi', isCommon: true },
    ],
    examples: [
      { word: '日本', reading: 'にほん', meaning: 'Japão' },
      { word: '今日', reading: 'きょう', meaning: 'hoje' },
    ],
    radicals: [
      {
        character: '日',
        name: 'hi',
        strokeCount: 4,
        meaning: 'sol',
        position: 72,
        isPrimary: true,
      },
    ],
  },
  {
    character: '本',
    unicodeCodepoint: 'U+672C',
    jlptLevel: 'N5',
    grade: 1,
    strokeCount: 5,
    frequencyRank: 2,
    meanings: ['livro', 'origem'],
    readings: [
      { reading: 'ホン', type: 'ONYOMI', romanization: 'hon', isCommon: true },
      { reading: 'もと', type: 'KUNYOMI', romanization: 'moto' },
    ],
    examples: [
      { word: '本', reading: 'ほん', meaning: 'livro' },
      { word: '日本', reading: 'にほん', meaning: 'Japão' },
    ],
    radicals: [
      {
        character: '木',
        name: 'ki',
        strokeCount: 4,
        meaning: 'árvore',
        position: 75,
        isPrimary: true,
      },
    ],
  },
  {
    character: '語',
    unicodeCodepoint: 'U+8A9E',
    jlptLevel: 'N5',
    grade: 2,
    strokeCount: 14,
    frequencyRank: 3,
    meanings: ['idioma', 'palavra'],
    readings: [
      { reading: 'ゴ', type: 'ONYOMI', romanization: 'go', isCommon: true },
      { reading: 'かた.る', type: 'KUNYOMI', romanization: 'kataru' },
    ],
    examples: [
      { word: '日本語', reading: 'にほんご', meaning: 'japonês' },
      { word: '英語', reading: 'えいご', meaning: 'inglês' },
    ],
    radicals: [
      {
        character: '言',
        name: 'kotoba',
        strokeCount: 7,
        meaning: 'palavra',
        position: 134,
        isPrimary: true,
      },
    ],
  },
  {
    character: '学',
    unicodeCodepoint: 'U+5B66',
    jlptLevel: 'N5',
    grade: 1,
    strokeCount: 8,
    frequencyRank: 4,
    meanings: ['estudar', 'aprender'],
    readings: [
      { reading: 'ガク', type: 'ONYOMI', romanization: 'gaku', isCommon: true },
      {
        reading: 'まな.ぶ',
        type: 'KUNYOMI',
        romanization: 'manabu',
        isCommon: true,
      },
    ],
    examples: [
      { word: '学生', reading: 'がくせい', meaning: 'estudante' },
      { word: '学校', reading: 'がっこう', meaning: 'escola' },
    ],
    radicals: [
      {
        character: '子',
        name: 'ko',
        strokeCount: 3,
        meaning: 'criança',
        position: 39,
        isPrimary: true,
      },
    ],
  },
  {
    character: '人',
    unicodeCodepoint: 'U+4EBA',
    jlptLevel: 'N5',
    grade: 1,
    strokeCount: 2,
    frequencyRank: 5,
    meanings: ['pessoa', 'humano'],
    readings: [
      { reading: 'ジン', type: 'ONYOMI', romanization: 'jin', isCommon: true },
      { reading: 'ニン', type: 'ONYOMI', romanization: 'nin' },
      {
        reading: 'ひと',
        type: 'KUNYOMI',
        romanization: 'hito',
        isCommon: true,
      },
    ],
    examples: [
      { word: '日本人', reading: 'にほんじん', meaning: 'japonês (pessoa)' },
      { word: '人', reading: 'ひと', meaning: 'pessoa' },
    ],
    radicals: [
      {
        character: '人',
        name: 'hito',
        strokeCount: 2,
        meaning: 'pessoa',
        position: 9,
        isPrimary: true,
      },
    ],
  },
  {
    character: '大',
    unicodeCodepoint: 'U+5927',
    jlptLevel: 'N5',
    grade: 1,
    strokeCount: 3,
    frequencyRank: 6,
    meanings: ['grande'],
    readings: [
      {
        reading: 'ダイ',
        type: 'ONYOMI',
        romanization: 'dai',
        isCommon: true,
      },
      {
        reading: 'タイ',
        type: 'ONYOMI',
        romanization: 'tai',
      },
      {
        reading: 'おお.きい',
        type: 'KUNYOMI',
        romanization: 'ookii',
        isCommon: true,
      },
    ],
    examples: [
      { word: '大学', reading: 'だいがく', meaning: 'universidade' },
      { word: '大きい', reading: 'おおきい', meaning: 'grande' },
    ],
    radicals: [
      {
        character: '大',
        name: 'dai',
        strokeCount: 3,
        meaning: 'grande',
        position: 37,
        isPrimary: true,
      },
    ],
  },
  {
    character: '電',
    unicodeCodepoint: 'U+96FB',
    jlptLevel: 'N5',
    grade: 2,
    strokeCount: 13,
    frequencyRank: 7,
    meanings: ['eletricidade'],
    readings: [
      { reading: 'デン', type: 'ONYOMI', romanization: 'den', isCommon: true },
    ],
    examples: [
      { word: '電話', reading: 'でんわ', meaning: 'telefone' },
      { word: '電車', reading: 'でんしゃ', meaning: 'trem' },
    ],
    radicals: [
      {
        character: '雨',
        name: 'ame',
        strokeCount: 8,
        meaning: 'chuva',
        position: 173,
        isPrimary: true,
      },
    ],
  },
  {
    character: '話',
    unicodeCodepoint: 'U+8A71',
    jlptLevel: 'N5',
    grade: 2,
    strokeCount: 13,
    frequencyRank: 8,
    meanings: ['fala', 'conversa'],
    readings: [
      { reading: 'ワ', type: 'ONYOMI', romanization: 'wa', isCommon: true },
      {
        reading: 'はな.す',
        type: 'KUNYOMI',
        romanization: 'hanasu',
        isCommon: true,
      },
      { reading: 'はなし', type: 'KUNYOMI', romanization: 'hanashi' },
    ],
    examples: [
      { word: '電話', reading: 'でんわ', meaning: 'telefone' },
      { word: '話す', reading: 'はなす', meaning: 'falar' },
    ],
    radicals: [
      {
        character: '言',
        name: 'kotoba',
        strokeCount: 7,
        meaning: 'palavra',
        position: 149,
        isPrimary: true,
      },
    ],
  },
];

async function main() {
  for (const item of kanjis) {
    const kanji = await prisma.kanji.upsert({
      where: { character: item.character },
      update: {
        unicodeCodepoint: item.unicodeCodepoint,
        jlptLevel: item.jlptLevel,
        grade: item.grade,
        strokeCount: item.strokeCount,
        frequency: item.frequencyRank,
      },
      create: {
        character: item.character,
        unicodeCodepoint: item.unicodeCodepoint,
        jlptLevel: item.jlptLevel,
        grade: item.grade,
        strokeCount: item.strokeCount,
        frequency: item.frequencyRank,
      },
    });

    await prisma.kanjiMeaning.deleteMany({ where: { kanjiId: kanji.id } });
    await prisma.kanjiReading.deleteMany({ where: { kanjiId: kanji.id } });
    await prisma.kanjiExample.deleteMany({ where: { kanjiId: kanji.id } });
    await prisma.kanjiRadical.deleteMany({ where: { kanjiId: kanji.id } });

    await prisma.kanjiMeaning.createMany({
      data: item.meanings.map((meaning, position) => ({
        kanjiId: kanji.id,
        meaning,
        language: 'pt-BR',
        isPrimary: position === 0,
        position,
      })),
    });

    await prisma.kanjiReading.createMany({
      data: item.readings.map((reading, position) => ({
        kanjiId: kanji.id,
        position,
        ...reading,
      })),
    });

    await prisma.kanjiExample.createMany({
      data: item.examples.map((example, position) => ({
        kanjiId: kanji.id,
        jlptLevel: item.jlptLevel,
        frequency: position + 1,
        position,
        ...example,
      })),
    });

    for (const radicalData of item.radicals) {
      const radical = await prisma.radical.upsert({
        where: { character: radicalData.character },
        update: {
          name: radicalData.name,
          strokeCount: radicalData.strokeCount,
          meaning: radicalData.meaning,
          position: radicalData.position,
        },
        create: {
          character: radicalData.character,
          name: radicalData.name,
          strokeCount: radicalData.strokeCount,
          meaning: radicalData.meaning,
          position: radicalData.position,
        },
      });

      await prisma.kanjiRadical.create({
        data: {
          kanjiId: kanji.id,
          radicalId: radical.id,
          isPrimary: radicalData.isPrimary ?? false,
        },
      });
    }
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
