import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JLPTLevel } from '@prisma/client';
import type { KanjiDic2Character } from 'kanjidic2-json';

export type SeedKanji = {
  character: string;
  unicodeCodepoint: string;
  jlptLevel: JLPTLevel;
  grade?: number;
  strokeCount?: number;
  frequencyRank?: number;
  notes?: string;
  meanings: string[];
  readings: Array<{
    reading: string;
    type: 'ONYOMI' | 'KUNYOMI' | 'NANORI';
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

const JLPT_MAP: Record<number, JLPTLevel> = {
  1: JLPTLevel.N1,
  2: JLPTLevel.N2,
  3: JLPTLevel.N3,
  4: JLPTLevel.N4,
  5: JLPTLevel.N5,
};

const FALLBACK_MEANING_NOTE =
  'Fallback: meanings em inglês do KANJIDIC2 quando pt-BR não estiver disponível.';

const RICH_OVERRIDES: Record<string, Partial<SeedKanji>> = {
  日: {
    unicodeCodepoint: 'U+65E5',
    jlptLevel: JLPTLevel.N5,
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
  本: {
    unicodeCodepoint: 'U+672C',
    jlptLevel: JLPTLevel.N5,
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
  語: {
    unicodeCodepoint: 'U+8A9E',
    jlptLevel: JLPTLevel.N5,
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
  学: {
    unicodeCodepoint: 'U+5B66',
    jlptLevel: JLPTLevel.N5,
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
  人: {
    unicodeCodepoint: 'U+4EBA',
    jlptLevel: JLPTLevel.N5,
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
  大: {
    unicodeCodepoint: 'U+5927',
    jlptLevel: JLPTLevel.N5,
    grade: 1,
    strokeCount: 3,
    frequencyRank: 6,
    meanings: ['grande'],
    readings: [
      { reading: 'ダイ', type: 'ONYOMI', romanization: 'dai', isCommon: true },
      { reading: 'タイ', type: 'ONYOMI', romanization: 'tai' },
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
  電: {
    unicodeCodepoint: 'U+96FB',
    jlptLevel: JLPTLevel.N5,
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
  話: {
    unicodeCodepoint: 'U+8A71',
    jlptLevel: JLPTLevel.N5,
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
};

function jlptFromRaw(jlpt?: number): JLPTLevel {
  return jlpt ? (JLPT_MAP[jlpt] ?? JLPTLevel.N5) : JLPTLevel.N5;
}

function codepointToUnicode(rawCodepoint?: string): string {
  if (!rawCodepoint) {
    return '';
  }

  return `U+${rawCodepoint.toUpperCase()}`;
}

function mapReadings(entry: KanjiDic2Character): SeedKanji['readings'] {
  const readings = entry.readings ?? {};
  const nanoris = entry.nanoris ?? [];

  return [
    ...(readings.ja_on ?? []).map((reading) => ({
      reading,
      type: 'ONYOMI' as const,
      romanization: reading.toLowerCase(),
      isCommon: false,
    })),
    ...(readings.ja_kun ?? []).map((reading) => ({
      reading,
      type: 'KUNYOMI' as const,
      romanization: reading.toLowerCase(),
      isCommon: false,
    })),
    ...nanoris.map((reading) => ({
      reading,
      type: 'NANORI' as const,
      romanization: reading.toLowerCase(),
      isCommon: false,
    })),
  ];
}

function mapMeanings(entry: KanjiDic2Character): {
  meanings: string[];
  notes?: string;
} {
  const meanings = entry.meanings ?? {};

  if (meanings.pt && meanings.pt.length > 0) {
    return { meanings: meanings.pt };
  }

  if (meanings.en && meanings.en.length > 0) {
    return {
      meanings: meanings.en,
      notes: FALLBACK_MEANING_NOTE,
    };
  }

  return { meanings: [] };
}

function mapSeedKanji(entry: KanjiDic2Character): SeedKanji {
  const { meanings, notes } = mapMeanings(entry);
  const override = RICH_OVERRIDES[entry.literal] ?? {};

  return {
    character: entry.literal,
    unicodeCodepoint:
      override.unicodeCodepoint ?? codepointToUnicode(entry.codepoints.ucs),
    jlptLevel: override.jlptLevel ?? jlptFromRaw(entry.jlpt),
    grade: override.grade ?? entry.grade,
    strokeCount: override.strokeCount ?? entry.strokeCounts[0],
    frequencyRank: override.frequencyRank ?? entry.freq,
    notes: override.notes ?? notes,
    meanings: override.meanings ?? meanings,
    readings: override.readings ?? mapReadings(entry),
    examples: override.examples ?? [],
    radicals: override.radicals ?? [],
  };
}

export function loadSeedKanjis(): Promise<SeedKanji[]> {
  const datasetPath = join(
    process.cwd(),
    'node_modules',
    'kanjidic2-json',
    'KANJIS.json',
  );
  const data = JSON.parse(
    readFileSync(datasetPath, 'utf8'),
  ) as KanjiDic2Character[];

  return Promise.resolve(
    data.map(mapSeedKanji).sort((left, right) => {
      const leftFrequency = left.frequencyRank ?? Number.MAX_SAFE_INTEGER;
      const rightFrequency = right.frequencyRank ?? Number.MAX_SAFE_INTEGER;

      if (leftFrequency !== rightFrequency) {
        return leftFrequency - rightFrequency;
      }

      return left.character.localeCompare(right.character);
    }),
  );
}

export function countUniqueSeedKanjiCharacters(kanjis: SeedKanji[]): number {
  return new Set(kanjis.map((kanji) => kanji.character)).size;
}
