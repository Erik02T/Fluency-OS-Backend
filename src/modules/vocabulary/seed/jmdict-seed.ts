import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { JMdict } from '@scriptin/jmdict-simplified-types';
import { parseJmdictDictionary } from './vocabulary-parser';
import { normalizeRawEntries } from './vocabulary-normalizer';
import {
  validateNormalizedEntries,
  dedupeByWordAndReading,
} from './vocabulary-validator';
import { selectTopVocabulary } from './vocabulary-selector';
import { transformToPrismaData } from './vocabulary-transformer';
import { DEFAULT_IMPORT_LIMIT } from './types';
import type { ImportSummary, VocabularyPrismaData } from './types';

export type { ImportSummary, VocabularyPrismaData };

export { DEFAULT_IMPORT_LIMIT };

export type LoadSeedVocabularyOptions = {
  datasetPath?: string;
  limit?: number;
};

export type PipelineResult = {
  prismaData: VocabularyPrismaData[];
  stats: {
    totalJmdictEntries: number;
    rawEntries: number;
    normalizedEntries: number;
    dedupedEntries: number;
    validEntries: number;
    invalidEntries: number;
    selectedEntries: number;
    skippedInvalid: number;
    skippedDuplicated: number;
  };
};

export function loadSeedVocabulary(
  options: LoadSeedVocabularyOptions = {},
): PipelineResult {
  const datasetPath = resolveDatasetPath(options.datasetPath);
  const limit = options.limit ?? 8000;

  const jmdict = loadJmdict(datasetPath);
  const totalJmdictEntries = jmdict.words.length;

  const raw = parseJmdictDictionary(jmdict);
  const rawEntries = raw.length;

  const normalized = normalizeRawEntries(raw);
  const normalizedEntries = normalized.length;

  const { deduped, duplicates } = dedupeByWordAndReading(normalized);
  const dedupedEntries = deduped.length;

  const { valid, invalid } = validateNormalizedEntries(deduped);
  const validEntries = valid.length;
  const invalidEntries = invalid.length;
  const skippedInvalid = invalidEntries;

  const selected = selectTopVocabulary(valid, limit);
  const selectedEntries = selected.length;

  const prismaData = transformToPrismaData(selected);

  return {
    prismaData,
    stats: {
      totalJmdictEntries,
      rawEntries,
      normalizedEntries,
      dedupedEntries,
      validEntries,
      invalidEntries,
      selectedEntries,
      skippedInvalid,
      skippedDuplicated: duplicates,
    },
  };
}

function resolveDatasetPath(customPath?: string): string {
  if (customPath) return customPath;

  const candidates = [
    join(
      process.cwd(),
      'prisma',
      'seed',
      'vocabulary',
      'raw',
      'jmdict-eng.json',
    ),
    join(
      process.cwd(),
      'prisma',
      'seed',
      'vocabulary',
      'raw',
      'jmdict-simplified-eng.json',
    ),
    join(
      process.cwd(),
      'prisma',
      'seed',
      'vocabulary',
      'raw',
      'jmdict-simplified.json',
    ),
    join(process.cwd(), 'prisma', 'seed', 'vocabulary', 'jmdict-eng.json'),
    join(
      process.cwd(),
      'prisma',
      'seed',
      'vocabulary',
      'jmdict-simplified.json',
    ),
    join(process.cwd(), 'data', 'jmdict-eng.json'),
    join(process.cwd(), 'data', 'jmdict-eng-3.6.2.json'),
    join(process.cwd(), 'data', 'jmdict-simplified.json'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    [
      '[vocabulary-seed] JMdict dataset not found. Expected one of:',
      ...candidates.map((p) => `  - ${p}`),
      '',
      'Download the latest jmdict-simplified-eng.json from:',
      '  https://github.com/scriptin/jmdict-simplified/releases',
      'Then rename/move it to the path above.',
    ].join('\n'),
  );
}

function loadJmdict(path: string): JMdict {
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw) as JMdict & {
    words?: unknown[];
    dictDate?: unknown;
  };

  if (!parsed || !Array.isArray(parsed.words)) {
    throw new Error(
      '[vocabulary-seed] Invalid JMdict JSON: expected root.words array.',
    );
  }

  return parsed;
}
