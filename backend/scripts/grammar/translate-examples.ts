import { config as loadDotenv } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import {
  JLPT_LEVEL_LABEL,
  JLPT_LEVELS,
  readingsFile,
  rejectedTranslationPreviewFile,
  rejectedTranslationsFile,
  translationCacheFile,
  translationPreviewFile,
  validatedTranslationsFile,
} from '../utils';
import { ReadingPatternsSchema, type ReadingPattern } from './reading-schema';
import {
  matchTranslationResponse,
  hasTranslationModelArtifact,
  RejectedTranslationPatternsSchema,
  TranslatedGrammarPatternsSchema,
  TranslationCacheSchema,
  type RejectedTranslationPattern,
  type TranslationCacheEntry,
  type TranslationBatchInput,
  type TranslatedGrammarPattern,
} from './translation-schema';
import type { JlptLevelDir } from '../utils';
import {
  DEFAULT_LOCAL_TRANSLATION_MODEL,
  LocalTranslationWorker,
} from './local-translation-client';

type TranslateBatch = (input: TranslationBatchInput) => Promise<unknown>;

interface CliOptions {
  level?: JlptLevelDir;
  limit?: number;
}

function parseCliOptions(argv: string[]): CliOptions {
  const { values } = parseNodeArgs({
    args: argv,
    options: {
      level: { type: 'string' },
      limit: { type: 'string' },
    },
    strict: true,
  });
  let level: JlptLevelDir | undefined;

  if (values.level) {
    const normalizedLevel = values.level.toLowerCase();
    if (!JLPT_LEVELS.includes(normalizedLevel as JlptLevelDir)) {
      throw new Error(`--level inválido. Use: ${JLPT_LEVELS.join('|')}`);
    }
    level = normalizedLevel as JlptLevelDir;
  }

  if (
    values.limit !== undefined &&
    (!Number.isInteger(Number(values.limit)) || Number(values.limit) < 1)
  ) {
    throw new Error('--limit deve ser inteiro >= 1');
  }

  return {
    level,
    limit: values.limit === undefined ? undefined : Number(values.limit),
  };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadCache(filePath: string): Map<string, TranslationCacheEntry> {
  if (!fs.existsSync(filePath)) return new Map();

  const entries = TranslationCacheSchema.parse(
    JSON.parse(fs.readFileSync(filePath, 'utf8')),
  );
  const cache = new Map<string, TranslationCacheEntry>();

  for (const entry of entries) {
    const key = `${entry.grammarPointId}:${entry.sourceId}`;
    if (cache.has(key)) {
      throw new Error(`Cache de tradução contém chave duplicada: ${key}`);
    }
    cache.set(key, entry);
  }

  return cache;
}

function saveCache(
  filePath: string,
  cache: Map<string, TranslationCacheEntry>,
): void {
  const entries = [...cache.values()].sort((left, right) => {
    const idOrder = left.grammarPointId.localeCompare(right.grammarPointId);
    if (idOrder !== 0) return idOrder;

    const leftSourceId = BigInt(left.sourceId);
    const rightSourceId = BigInt(right.sourceId);
    return leftSourceId < rightSourceId
      ? -1
      : leftSourceId > rightSourceId
        ? 1
        : 0;
  });
  writeJson(filePath, TranslationCacheSchema.parse(entries));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function matchesCache(
  cached: TranslationCacheEntry | undefined,
  pattern: ReadingPattern,
  example: ReadingPattern['examples'][number],
  model: string,
): cached is TranslationCacheEntry {
  return (
    cached !== undefined &&
    cached.grammarPointId === pattern.id &&
    cached.pattern === pattern.pattern &&
    cached.model === model &&
    cached.sourceId === example.sourceId &&
    cached.japanese === example.japanese &&
    !hasTranslationModelArtifact(cached.translation)
  );
}

async function translatePattern(
  translateBatch: TranslateBatch,
  model: string,
  pattern: ReadingPattern,
  cache: Map<string, TranslationCacheEntry>,
): Promise<{
  translated?: TranslatedGrammarPattern;
  rejected?: RejectedTranslationPattern;
}> {
  const translations = new Map<string, string>();
  const missingExamples: ReadingPattern['examples'] = [];

  for (const example of pattern.examples) {
    const key = `${pattern.id}:${example.sourceId}`;
    const cached = cache.get(key);
    if (matchesCache(cached, pattern, example, model)) {
      translations.set(example.sourceId, cached.translation);
    } else {
      missingExamples.push(example);
    }
  }

  let failedExamples: RejectedTranslationPattern['failedExamples'] = [];
  if (missingExamples.length > 0) {
    try {
      const input: TranslationBatchInput = {
        pattern: pattern.pattern,
        jlpt: pattern.jlpt,
        examples: missingExamples.map(({ sourceId, japanese }) => ({
          sourceId,
          japanese,
        })),
      };
      const response = await translateBatch(input);
      const batch = matchTranslationResponse(
        missingExamples.map((example) => example.sourceId),
        response,
      );

      for (const example of missingExamples) {
        const translation = batch.get(example.sourceId);
        if (!translation) {
          throw new Error(
            `Tradução ausente para sourceId ${example.sourceId}.`,
          );
        }
        if (hasTranslationModelArtifact(translation)) {
          failedExamples.push({
            sourceId: example.sourceId,
            japanese: example.japanese,
            error: 'A tradução contém marcador interno do modelo.',
          });
          continue;
        }
        translations.set(example.sourceId, translation);
        cache.set(`${pattern.id}:${example.sourceId}`, {
          grammarPointId: pattern.id,
          pattern: pattern.pattern,
          model,
          sourceId: example.sourceId,
          japanese: example.japanese,
          translation,
        });
      }
    } catch (error: unknown) {
      const reason = errorMessage(error);
      if (failedExamples.length === 0) {
        failedExamples = missingExamples.map((example) => ({
          sourceId: example.sourceId,
          japanese: example.japanese,
          error: reason,
        }));
      }
    }
  }

  if (failedExamples.length > 0) {
    return {
      rejected: {
        id: pattern.id,
        pattern: pattern.pattern,
        jlpt: pattern.jlpt,
        reviewStatus: 'PENDING',
        failedExamples,
      },
    };
  }

  return {
    translated: {
      ...pattern,
      examples: pattern.examples.map((example) => ({
        ...example,
        translation: translations.get(example.sourceId) ?? '',
      })),
    },
  };
}

async function main(): Promise<void> {
  loadDotenv();
  const options = parseCliOptions(process.argv.slice(2));
  const localModel =
    process.env.GRAMMAR_LOCAL_TRANSLATION_MODEL?.trim() ||
    DEFAULT_LOCAL_TRANSLATION_MODEL;
  const localWorker = new LocalTranslationWorker(localModel);
  const model = `local:${localModel}`;
  const translateBatch: TranslateBatch = async (input) =>
    JSON.parse(await localWorker.translateBatch(input)) as unknown;

  const levels = options.level ? [options.level] : JLPT_LEVELS;
  let totalFailures = 0;

  try {
    for (const level of levels) {
      const input = ReadingPatternsSchema.parse(
        JSON.parse(fs.readFileSync(readingsFile(level), 'utf8')),
      );
      const cachePath = translationCacheFile(level);
      const cache = loadCache(cachePath);
      const validated: TranslatedGrammarPattern[] = [];
      const rejected: RejectedTranslationPattern[] = [];
      const patterns = options.limit ? input.slice(0, options.limit) : input;

      for (const pattern of patterns) {
        const result = await translatePattern(
          translateBatch,
          model,
          pattern,
          cache,
        );
        if (result.translated) validated.push(result.translated);
        if (result.rejected) {
          rejected.push(result.rejected);
          totalFailures += result.rejected.failedExamples.length;
          for (const failure of result.rejected.failedExamples) {
            console.error(
              `[grammar:translate-examples] ${result.rejected.id}/${failure.sourceId}: ${failure.error}`,
            );
          }
        }

        saveCache(cachePath, cache);
      }

      const validatedFile = options.limit
        ? translationPreviewFile(level)
        : validatedTranslationsFile(level);
      const rejectedFile = options.limit
        ? rejectedTranslationPreviewFile(level)
        : rejectedTranslationsFile(level);
      writeJson(
        validatedFile,
        TranslatedGrammarPatternsSchema.parse(validated),
      );
      writeJson(rejectedFile, RejectedTranslationPatternsSchema.parse(rejected));

      const translatedExamples = validated.reduce(
        (total, pattern) => total + pattern.examples.length,
        0,
      );
      console.log(
        `${JLPT_LEVEL_LABEL[level]}: ${validated.length} patterns, ${translatedExamples} exemplos traduzidos, ${rejected.length} patterns rejeitados`,
      );
    }
  } finally {
    await localWorker.close();
  }

  if (totalFailures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    '[grammar:translate-examples] Erro:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
