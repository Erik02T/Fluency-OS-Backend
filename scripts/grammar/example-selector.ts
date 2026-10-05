import { z } from 'zod';
import type { PatternMatchCandidate } from './pattern-matcher';
import { createPatternPredicate } from './pattern-matcher';

const SelectionOptionsSchema = z.object({
  minExamples: z.number().int().min(1).max(5).default(3),
  maxExamples: z.number().int().min(1).max(5).default(5),
});

export const SelectedExampleSchema = z.object({
  sourceId: z.string().regex(/^[1-9]\d*$/),
  japanese: z.string().min(1),
  rankingScore: z.number().int().min(0).max(100),
  reviewStatus: z.literal('PENDING'),
});

export type SelectedExample = z.infer<typeof SelectedExampleSchema>;

export interface ExampleSelectionResult {
  status: 'COMPLETE' | 'INSUFFICIENT_CANDIDATES';
  candidateCount: number;
  eligibleCandidateCount: number;
  examples: SelectedExample[];
}

const MIN_SENTENCE_LENGTH = 6;
const MAX_SENTENCE_LENGTH = 120;
const JAPANESE_CHAR_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const JAPANESE_CHAR_GLOBAL_RE =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
const LATIN_CHAR_RE = /[A-Za-z]/g;
const EXTERNAL_NOISE_RE = /https?:\/\/|<[^>]*>|\[[^\]]*\]/i;

function normalizeForDeduplication(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[～∼⁓~]/g, '〜')
    .replace(/下さい/g, 'ください')
    .replace(/\s+/g, '');
}

function rankingScore(text: string): number {
  const length = Array.from(text).length;
  const latinCount = text.match(LATIN_CHAR_RE)?.length ?? 0;
  const punctuationCount = text.match(/[。！？!?]/g)?.length ?? 0;
  const lengthPenalty = Math.round(Math.abs(length - 28) * 1.4);
  const latinPenalty = Math.min(24, latinCount * 4);
  const punctuationPenalty = Math.max(0, punctuationCount - 1) * 8;

  return Math.max(0, 100 - lengthPenalty - latinPenalty - punctuationPenalty);
}

function compareSentenceIds(left: string, right: string): number {
  const leftId = BigInt(left);
  const rightId = BigInt(right);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export function selectExamples(
  pattern: string,
  candidates: readonly PatternMatchCandidate[],
  options: z.input<typeof SelectionOptionsSchema> = {},
): ExampleSelectionResult {
  const { minExamples, maxExamples } = SelectionOptionsSchema.parse(options);
  if (minExamples > maxExamples) {
    throw new Error('minExamples não pode ser maior que maxExamples.');
  }

  const matchesPattern = createPatternPredicate(pattern, 'regex');
  const seenIds = new Set<string>();
  const seenSentences = new Set<string>();
  const eligible: SelectedExample[] = [];

  for (const candidate of candidates) {
    const sentence = candidate.japanese.trim();
    const sentenceLength = Array.from(sentence).length;
    if (
      !sentence ||
      sentenceLength < MIN_SENTENCE_LENGTH ||
      sentenceLength > MAX_SENTENCE_LENGTH ||
      !JAPANESE_CHAR_RE.test(sentence) ||
      EXTERNAL_NOISE_RE.test(sentence) ||
      !matchesPattern(sentence)
    ) {
      continue;
    }

    const normalizedSentence = normalizeForDeduplication(sentence);
    if (
      seenIds.has(candidate.sentenceId) ||
      seenSentences.has(normalizedSentence)
    ) {
      continue;
    }

    seenIds.add(candidate.sentenceId);
    seenSentences.add(normalizedSentence);

    const japaneseCharacterCount =
      sentence.match(JAPANESE_CHAR_GLOBAL_RE)?.length ?? 0;
    const latinCharacterCount = sentence.match(LATIN_CHAR_RE)?.length ?? 0;
    if (latinCharacterCount > Math.max(8, japaneseCharacterCount * 0.4)) {
      continue;
    }

    eligible.push({
      sourceId: candidate.sentenceId,
      japanese: candidate.japanese,
      rankingScore: rankingScore(sentence),
      reviewStatus: 'PENDING',
    });
  }

  eligible.sort(
    (left, right) =>
      right.rankingScore - left.rankingScore ||
      compareSentenceIds(left.sourceId, right.sourceId),
  );

  const examples = eligible.slice(0, maxExamples);
  return {
    status:
      examples.length >= minExamples ? 'COMPLETE' : 'INSUFFICIENT_CANDIDATES',
    candidateCount: candidates.length,
    eligibleCandidateCount: eligible.length,
    examples,
  };
}
