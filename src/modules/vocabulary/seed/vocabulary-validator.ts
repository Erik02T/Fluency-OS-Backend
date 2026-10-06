import type {
  NormalizedVocabularyEntry,
  ValidatedVocabularyEntry,
} from './types';

const MAX_WORD_LENGTH = 100;
const MAX_READING_LENGTH = 200;
const MAX_MEANING_LENGTH = 300;
const MAX_CONTEXT_LENGTH = 200;

export function validateNormalizedEntries(
  entries: NormalizedVocabularyEntry[],
): {
  valid: ValidatedVocabularyEntry[];
  invalid: ValidatedVocabularyEntry[];
} {
  const valid: ValidatedVocabularyEntry[] = [];
  const invalid: ValidatedVocabularyEntry[] = [];

  for (const entry of entries) {
    const errors = validateEntry(entry);
    const marked: ValidatedVocabularyEntry = {
      ...entry,
      isValid: errors.length === 0,
      validationErrors: errors,
    };

    if (marked.isValid) {
      valid.push(marked);
    } else {
      invalid.push(marked);
    }
  }

  return { valid, invalid };
}

function validateEntry(entry: NormalizedVocabularyEntry): string[] {
  const errors: string[] = [];

  if (!entry.word) {
    errors.push('word is empty');
  } else if (entry.word.length > MAX_WORD_LENGTH) {
    errors.push(`word too long: ${entry.word.length} > ${MAX_WORD_LENGTH}`);
  }

  if (!entry.reading) {
    errors.push('reading is empty');
  } else if (entry.reading.length > MAX_READING_LENGTH) {
    errors.push(
      `reading too long: ${entry.reading.length} > ${MAX_READING_LENGTH}`,
    );
  }

  if (!entry.meanings || entry.meanings.length === 0) {
    errors.push('no meanings provided');
  }

  for (let i = 0; i < (entry.meanings?.length ?? 0); i++) {
    const m = entry.meanings[i];
    if (!m.meaning || !m.meaning.trim()) {
      errors.push(`meaning[${i}] is empty`);
    } else if (m.meaning.length > MAX_MEANING_LENGTH) {
      errors.push(
        `meaning[${i}] too long: ${m.meaning.length} > ${MAX_MEANING_LENGTH}`,
      );
    }
    if (m.context && m.context.length > MAX_CONTEXT_LENGTH) {
      errors.push(
        `meaning[${i}].context too long: ${m.context.length} > ${MAX_CONTEXT_LENGTH}`,
      );
    }
  }

  return errors;
}

export function dedupeByWordAndReading(entries: NormalizedVocabularyEntry[]): {
  deduped: NormalizedVocabularyEntry[];
  duplicates: number;
} {
  const map = new Map<string, NormalizedVocabularyEntry>();
  let duplicates = 0;

  for (const entry of entries) {
    const key = `${entry.word}::${entry.reading}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, entry);
    } else {
      duplicates++;
      if (entry.selectionScore > existing.selectionScore) {
        map.set(key, entry);
      }
    }
  }

  return { deduped: Array.from(map.values()), duplicates };
}

export function isJlpLevelValid(
  value: unknown,
): value is 'N5' | 'N4' | 'N3' | 'N2' | 'N1' {
  return (
    value === 'N5' ||
    value === 'N4' ||
    value === 'N3' ||
    value === 'N2' ||
    value === 'N1'
  );
}

export function isPartOfSpeechValid(value?: string | null): boolean {
  if (value === undefined || value === null) return true;
  const allowed = /^[a-zA-Z ()\-,/]{1,50}$/;
  return allowed.test(value);
}
