import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  insufficientExamplesFile,
  JLPT_LEVEL_LABEL,
  JLPT_LEVELS,
  normalizedFile,
  selectedExamplesFile,
  SENTENCE_INDEX_FILE,
} from '../utils';
import { NormalizedGrammarPatternListSchema } from './normalized-schema';
import { PatternMatcher } from './pattern-matcher';
import { selectExamples, SelectedExampleSchema } from './example-selector';

const SelectedPatternSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  jlpt: z.string(),
  position: z.number().int().positive(),
  source: z.string(),
  reviewStatus: z.literal('PENDING'),
  examples: z.array(SelectedExampleSchema).min(3).max(5),
});

const InsufficientPatternSchema = z.object({
  id: z.string(),
  pattern: z.string(),
  jlpt: z.string(),
  position: z.number().int().positive(),
  source: z.string(),
  reviewStatus: z.literal('PENDING'),
  candidateCount: z.number().int().nonnegative(),
  eligibleCandidateCount: z.number().int().nonnegative(),
  availableCandidates: z.array(SelectedExampleSchema).max(2),
});

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function main(): void {
  const matcher = new PatternMatcher(SENTENCE_INDEX_FILE);
  try {
    for (const level of JLPT_LEVELS) {
      const patterns = NormalizedGrammarPatternListSchema.parse(
        JSON.parse(fs.readFileSync(normalizedFile(level), 'utf8')),
      );
      const selected: z.infer<typeof SelectedPatternSchema>[] = [];
      const insufficient: z.infer<typeof InsufficientPatternSchema>[] = [];

      for (const pattern of patterns) {
        const matched = matcher.search({
          pattern: pattern.pattern,
          mode: 'regex',
          limit: 1000,
        });
        const selection = selectExamples(pattern.pattern, matched.candidates);

        if (selection.status === 'COMPLETE') {
          selected.push(
            SelectedPatternSchema.parse({
              ...pattern,
              reviewStatus: 'PENDING',
              examples: selection.examples,
            }),
          );
        } else {
          insufficient.push(
            InsufficientPatternSchema.parse({
              ...pattern,
              reviewStatus: 'PENDING',
              candidateCount: selection.candidateCount,
              eligibleCandidateCount: selection.eligibleCandidateCount,
              availableCandidates: selection.examples,
            }),
          );
        }
      }

      writeJson(selectedExamplesFile(level), selected);
      writeJson(insufficientExamplesFile(level), insufficient);
      console.log(
        `${JLPT_LEVEL_LABEL[level]}: ${selected.length} patterns com 3–5 exemplos; ${insufficient.length} insuficientes`,
      );
    }
  } finally {
    matcher.close();
  }
}

try {
  main();
} catch (error: unknown) {
  console.error('[grammar:select-examples] Erro:', error);
  process.exitCode = 1;
}
