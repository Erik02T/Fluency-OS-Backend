import type {
  NormalizedVocabularyEntry,
  ValidatedVocabularyEntry,
} from './types';
import { DEFAULT_IMPORT_LIMIT } from './types';

export function selectTopVocabulary(
  validated: ValidatedVocabularyEntry[],
  limit: number = DEFAULT_IMPORT_LIMIT,
): NormalizedVocabularyEntry[] {
  const validOnly = validated.filter((v) => v.isValid);

  const sorted = [...validOnly].sort((a, b) => {
    if (b.selectionScore !== a.selectionScore) {
      return b.selectionScore - a.selectionScore;
    }

    if (b.isCommon !== a.isCommon) {
      return b.isCommon ? 1 : -1;
    }

    const meaningDiff = (b.meanings?.length ?? 0) - (a.meanings?.length ?? 0);
    if (meaningDiff !== 0) return meaningDiff;

    return a.word.localeCompare(b.word, 'ja');
  });

  return sorted.slice(0, limit);
}

export function splitByJlptAvailability(entries: NormalizedVocabularyEntry[]): {
  withJlpt: NormalizedVocabularyEntry[];
  withoutJlpt: NormalizedVocabularyEntry[];
} {
  const withJlpt: NormalizedVocabularyEntry[] = [];
  const withoutJlpt: NormalizedVocabularyEntry[] = [];

  for (const e of entries) {
    if ('jlptLevel' in (e as unknown as object)) {
      withJlpt.push(e);
    } else {
      withoutJlpt.push(e);
    }
  }

  return { withJlpt, withoutJlpt };
}

export function countCommonWords(entries: NormalizedVocabularyEntry[]): number {
  return entries.filter((e) => e.isCommon).length;
}

export function countWithoutExamples(
  entries: Array<{ examples?: unknown[] }>,
): number {
  return entries.filter((e) => !e.examples || e.examples.length === 0).length;
}

export function calculateScoreBreakdown(
  entry: NormalizedVocabularyEntry,
): Record<string, number | boolean> {
  return {
    selectionScore: entry.selectionScore,
    isCommon: entry.isCommon,
    meaningsCount: entry.meanings.length,
    hasPartOfSpeech: Boolean(entry.partOfSpeech),
    tagsCount: entry.tags.length,
  };
}
