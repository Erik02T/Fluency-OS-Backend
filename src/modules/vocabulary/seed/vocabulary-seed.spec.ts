import type { JMdictWord } from '@scriptin/jmdict-simplified-types';
import { parseJmdictWord, calcPriorityScore } from './vocabulary-parser';
import {
  normalizeRawEntries,
  normalizeUnicodeAndTrim,
  calculateSelectionScore,
} from './vocabulary-normalizer';
import {
  validateNormalizedEntries,
  dedupeByWordAndReading,
  isPartOfSpeechValid,
} from './vocabulary-validator';
import { selectTopVocabulary } from './vocabulary-selector';
import {
  transformOneToPrisma,
  transformToPrismaData,
} from './vocabulary-transformer';
import type {
  NormalizedVocabularyEntry,
  RawVocabularyEntry,
  ValidatedVocabularyEntry,
} from './types';

function buildMockWord(overrides: Partial<JMdictWord> = {}): JMdictWord {
  const base: JMdictWord = {
    id: '1000000',
    kanji: [{ common: true, text: '食べる', tags: [] }],
    kana: [
      {
        common: true,
        text: 'たべる',
        tags: [],
        appliesToKanji: ['*'],
      },
    ],
    sense: [
      {
        partOfSpeech: ['v1', 'vt'],
        appliesToKanji: ['*'],
        appliesToKana: ['*'],
        related: [],
        antonym: [],
        field: [],
        dialect: [],
        misc: [],
        info: [],
        languageSource: [],
        gloss: [
          { lang: 'eng', gender: null, type: null, text: 'to eat' },
          { lang: 'eng', gender: null, type: null, text: 'to consume (food)' },
        ],
      },
    ],
  };
  return { ...base, ...overrides };
}

function buildRawEntry(
  overrides: Partial<RawVocabularyEntry> = {},
): RawVocabularyEntry {
  const base: RawVocabularyEntry = {
    jmdictId: 'x-1',
    word: '食べる',
    reading: 'たべる',
    alternativeReadings: [],
    meanings: [
      { meaning: 'to eat', language: 'eng' },
      { meaning: 'to consume', language: 'eng' },
    ],
    partOfSpeechTags: ['v1', 'vt'],
    isCommon: true,
    isRare: false,
    isObscure: false,
    fieldTags: [],
    dialectTags: [],
  };
  return { ...base, ...overrides };
}

describe('vocabulary-parser', () => {
  it('parses a simple verb with kanji + kana + gloss', () => {
    const word = buildMockWord();
    const out = parseJmdictWord(word);
    expect(out).toHaveLength(1);
    expect(out[0].word).toBe('食べる');
    expect(out[0].reading).toBe('たべる');
    expect(out[0].meanings.map((m) => m.meaning)).toEqual([
      'to eat',
      'to consume (food)',
    ]);
    expect(out[0].isCommon).toBe(true);
  });

  it('returns empty for name-only entries (surname pos)', () => {
    const nameWord = buildMockWord({
      sense: [
        {
          partOfSpeech: ['surname'],
          appliesToKanji: ['*'],
          appliesToKana: ['*'],
          related: [],
          antonym: [],
          field: [],
          dialect: [],
          misc: [],
          info: [],
          languageSource: [],
          gloss: [{ lang: 'eng', gender: null, type: null, text: 'Tanaka' }],
        },
      ],
    });
    expect(parseJmdictWord(nameWord)).toHaveLength(0);
  });

  it('handles kana-only words (no kanji array entries)', () => {
    const kanaOnly = buildMockWord({
      kanji: [],
      kana: [
        { common: true, text: 'カフェ', tags: [], appliesToKanji: [] },
        { common: false, text: 'カフェー', tags: [], appliesToKanji: [] },
      ],
    });
    const out = parseJmdictWord(kanaOnly);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].word).toBe(out[0].reading);
    expect(['カフェ', 'カフェー']).toContain(out[0].word);
  });

  it('skips senses when no English gloss is present but uses fallback language', () => {
    const noEn = buildMockWord({
      sense: [
        {
          partOfSpeech: ['n'],
          appliesToKanji: ['*'],
          appliesToKana: ['*'],
          related: [],
          antonym: [],
          field: [],
          dialect: [],
          misc: [],
          info: [],
          languageSource: [],
          gloss: [{ lang: 'fra', gender: null, type: null, text: 'maison' }],
        },
      ],
    });
    const out = parseJmdictWord(noEn);
    expect(out).toHaveLength(1);
    expect(out[0].meanings[0].meaning).toBe('maison');
  });

  it('calcPriorityScore picks up ichi1/news1 tags', () => {
    const w1 = buildMockWord({
      kanji: [{ common: true, text: '日本', tags: ['ichi1', 'news1'] }],
    });
    const w2 = buildMockWord();
    expect(calcPriorityScore(w1)).toBeGreaterThan(calcPriorityScore(w2));
  });
});

describe('vocabulary-normalizer', () => {
  it('normalizes unicode NFC and trims', () => {
    const nfd = 'たへ\u3099る'; // べ decomposed: へ + combining dakuten (U+3099)
    const result = normalizeUnicodeAndTrim(`  ${nfd}  `);
    expect(result).toBe('たべる');
    expect(result === result.normalize('NFC')).toBe(true);
  });

  it('merges duplicate meanings preserving context', () => {
    const raws: RawVocabularyEntry[] = [
      buildRawEntry({
        meanings: [
          { meaning: '  to eat  ', language: 'eng' },
          { meaning: 'To eat', language: 'eng', context: 'general' },
        ],
      }),
    ];
    const norm = normalizeRawEntries(raws);
    expect(norm[0].meanings).toHaveLength(1);
    expect(norm[0].meanings[0].context).toBe('general');
  });

  it('calculates higher selection score for common non-rare words', () => {
    const common = buildRawEntry();
    const rare = buildRawEntry({ isCommon: false, isRare: true });
    expect(calculateSelectionScore(common)).toBeGreaterThan(
      calculateSelectionScore(rare),
    );
  });

  it('normalizes multiple raw entries and combines word/reading duplicates', () => {
    const raws: RawVocabularyEntry[] = [
      buildRawEntry({
        jmdictId: 'a',
        meanings: [{ meaning: 'to eat', language: 'eng' }],
      }),
      buildRawEntry({
        jmdictId: 'b',
        meanings: [
          { meaning: 'to consume', language: 'eng' },
          { meaning: 'to eat', language: 'eng', context: 'daily' },
        ],
      }),
    ];
    const norm = normalizeRawEntries(raws);
    expect(norm).toHaveLength(1);
    expect(norm[0].meanings.length).toBeGreaterThanOrEqual(2);
  });
});

describe('vocabulary-validator', () => {
  it('accepts valid entries', () => {
    const entry: NormalizedVocabularyEntry = {
      jmdictId: 'x',
      word: '食べる',
      reading: 'たべる',
      meanings: [{ meaning: 'to eat' }],
      partOfSpeech: 'verb (ichidan)',
      tags: [],
      selectionScore: 100,
      hasFrequencyInfo: false,
      isCommon: true,
    };
    const { valid, invalid } = validateNormalizedEntries([entry]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
    expect(valid[0].isValid).toBe(true);
  });

  it('rejects entries with no reading', () => {
    const entry: NormalizedVocabularyEntry = {
      jmdictId: 'x',
      word: '食べる',
      reading: '',
      meanings: [{ meaning: 'to eat' }],
      tags: [],
      selectionScore: 0,
      hasFrequencyInfo: false,
      isCommon: false,
    };
    const { valid, invalid } = validateNormalizedEntries([entry]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].validationErrors.some((e) => e.includes('reading'))).toBe(
      true,
    );
  });

  it('rejects meanings with empty meaning text', () => {
    const entry: NormalizedVocabularyEntry = {
      jmdictId: 'x',
      word: '食べる',
      reading: 'たべる',
      meanings: [{ meaning: '' }, { meaning: '   ' }],
      tags: [],
      selectionScore: 0,
      hasFrequencyInfo: false,
      isCommon: false,
    };
    const { valid } = validateNormalizedEntries([entry]);
    expect(valid).toHaveLength(0);
  });

  it('dedupes by word+reading choosing higher score', () => {
    const entries: NormalizedVocabularyEntry[] = [
      {
        jmdictId: 'low',
        word: '食べる',
        reading: 'たべる',
        meanings: [{ meaning: 'bad meaning' }],
        tags: [],
        selectionScore: 10,
        hasFrequencyInfo: false,
        isCommon: false,
      },
      {
        jmdictId: 'high',
        word: '食べる',
        reading: 'たべる',
        meanings: [{ meaning: 'to eat' }],
        tags: ['common'],
        selectionScore: 200,
        hasFrequencyInfo: false,
        isCommon: true,
      },
    ];
    const { deduped, duplicates } = dedupeByWordAndReading(entries);
    expect(duplicates).toBe(1);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].jmdictId).toBe('high');
  });

  it('part of speech validator accepts nullable values', () => {
    expect(isPartOfSpeechValid(undefined)).toBe(true);
    expect(isPartOfSpeechValid(null)).toBe(true);
    expect(isPartOfSpeechValid('verb (ichidan)')).toBe(true);
    expect(isPartOfSpeechValid('invalid@pos#')).toBe(false);
  });
});

describe('vocabulary-selector', () => {
  function makeValidated(
    score: number,
    word: string,
    meaningsCount = 2,
    common = true,
  ): ValidatedVocabularyEntry {
    return {
      jmdictId: word,
      word,
      reading: `r-${word}`,
      meanings: Array.from({ length: meaningsCount }, (_, i) => ({
        meaning: `${word}-m${i}`,
      })),
      partOfSpeech: 'noun',
      tags: [],
      selectionScore: score,
      hasFrequencyInfo: false,
      isCommon: common,
      isValid: true,
      validationErrors: [],
    };
  }

  it('selects top N sorted by selectionScore desc', () => {
    const pool: ValidatedVocabularyEntry[] = [
      makeValidated(10, 'low'),
      makeValidated(500, 'hi'),
      makeValidated(300, 'mid'),
    ];
    const top = selectTopVocabulary(pool, 2);
    expect(top.map((t) => t.word)).toEqual(['hi', 'mid']);
  });

  it('prefers common words and more meanings as tiebreakers', () => {
    const pool: ValidatedVocabularyEntry[] = [
      makeValidated(200, 'uncommon', 1, false),
      makeValidated(200, 'common', 3, true),
    ];
    const top = selectTopVocabulary(pool, 1);
    expect(top[0].word).toBe('common');
    expect(top[0].meanings.length).toBe(3);
  });

  it('drops invalid entries from selection', () => {
    const pool: ValidatedVocabularyEntry[] = [
      makeValidated(1000, 'a'),
      {
        ...makeValidated(5000, 'bad'),
        isValid: false,
        validationErrors: ['no reading'],
      },
    ];
    const top = selectTopVocabulary(pool, 10);
    expect(top.some((t) => t.word === 'bad')).toBe(false);
  });
});

describe('vocabulary-transformer', () => {
  it('assigns isPrimary=true to position 0 meaning', () => {
    const entry: NormalizedVocabularyEntry = {
      jmdictId: 'x',
      word: '食べる',
      reading: 'たべる',
      meanings: [{ meaning: 'to eat' }, { meaning: 'to consume' }],
      partOfSpeech: 'verb (ichidan)',
      tags: ['common'],
      selectionScore: 100,
      hasFrequencyInfo: false,
      isCommon: true,
    };
    const data = transformOneToPrisma(entry);
    expect(data.word).toBe('食べる');
    expect(data.jlptLevel).toBe(null);
    expect(data.meanings[0].isPrimary).toBe(true);
    expect(data.meanings[0].position).toBe(0);
    expect(data.meanings[1].isPrimary).toBe(false);
    expect(data.meanings[1].position).toBe(1);
    expect(data.partOfSpeech).toBe('verb (ichidan)');
    expect(data.tags).toEqual(['common']);
    expect(data.examples).toEqual([]);
  });

  it('deduplicates meanings case-insensitively', () => {
    const entry: NormalizedVocabularyEntry = {
      jmdictId: 'x',
      word: '家',
      reading: 'いえ',
      meanings: [
        { meaning: 'house' },
        { meaning: 'House' },
        { meaning: 'home' },
      ],
      tags: [],
      selectionScore: 0,
      hasFrequencyInfo: false,
      isCommon: true,
    };
    const data = transformOneToPrisma(entry);
    expect(data.meanings.map((m) => m.meaning)).toEqual(['house', 'home']);
  });

  it('handles empty inputs without crashing', () => {
    const batch = transformToPrismaData([]);
    expect(batch).toEqual([]);
  });
});
