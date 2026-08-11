import type { JLPTLevel } from '@prisma/client';
import type { NormalizedVocabularyEntry, VocabularyPrismaData } from './types';

const DEFAULT_JLPT: JLPTLevel | null = null;
const DEFAULT_FREQUENCY: number | null = null;
const DEFAULT_AUDIO_URL: string | null = null;

export function transformToPrismaData(
  entries: NormalizedVocabularyEntry[],
): VocabularyPrismaData[] {
  return entries.map(transformOneToPrisma);
}

export function transformOneToPrisma(
  entry: NormalizedVocabularyEntry,
): VocabularyPrismaData {
  const meanings = transformMeanings(entry.meanings);
  const examples = transformExamples([]);

  const existing = entry as unknown as {
    jlptLevel?: JLPTLevel;
    frequency?: number | null;
    examples?: unknown[];
  };

  return {
    word: entry.word,
    reading: entry.reading,
    jlptLevel: existing.jlptLevel ?? DEFAULT_JLPT,
    frequency: existing.frequency ?? DEFAULT_FREQUENCY,
    partOfSpeech: entry.partOfSpeech ?? null,
    tags: entry.tags ?? [],
    notes: entry.notes ?? null,
    audioUrl: DEFAULT_AUDIO_URL,
    meanings,
    examples:
      existing.examples &&
      Array.isArray(existing.examples) &&
      existing.examples.length > 0
        ? (existing.examples as VocabularyPrismaData['examples'])
        : examples,
  };
}

function transformMeanings(
  meanings: Array<{ meaning: string; context?: string }>,
): VocabularyPrismaData['meanings'] {
  const unique: Array<{ key: string; meaning: string; context?: string }> = [];
  const seen = new Set<string>();

  for (const raw of meanings) {
    const m = raw.meaning.trim().replace(/\s+/g, ' ');
    if (!m) continue;
    const key = m.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ key, meaning: m, context: raw.context?.trim() });
  }

  if (unique.length === 0) {
    return [];
  }

  return unique.map((item, idx) => ({
    meaning: item.meaning,
    context: item.context ?? null,
    isPrimary: idx === 0,
    position: idx,
  }));
}

function transformExamples(
  examples: unknown[],
): VocabularyPrismaData['examples'] {
  if (!examples || examples.length === 0) return [];
  return [] as VocabularyPrismaData['examples'];
}

export const FOR_TESTING = {
  transformMeanings,
};
