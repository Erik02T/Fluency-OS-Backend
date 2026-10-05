import { z } from 'zod';
import { RawJlptSchema } from './raw-schema';
import { ReadingPatternSchema } from './reading-schema';

export const TranslationBatchResponseSchema = z
  .object({
    translations: z
      .array(
        z
          .object({
            sourceId: z.string().regex(/^[1-9]\d*$/),
            translation: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const TranslationCacheEntrySchema = z
  .object({
    grammarPointId: z.string().regex(/^N[1-5]-\d{3}$/),
    pattern: z.string().min(1),
    model: z.string().min(1),
    sourceId: z.string().regex(/^[1-9]\d*$/),
    japanese: z.string().min(1),
    translation: z.string().trim().min(1),
  })
  .strict();

export const TranslationCacheSchema = z.array(TranslationCacheEntrySchema);

export const TranslatedExampleSchema =
  ReadingPatternSchema.shape.examples.element.extend({
    translation: z.string().trim().min(1),
  });

export const TranslatedGrammarPatternSchema = ReadingPatternSchema.extend({
  examples: z.array(TranslatedExampleSchema).min(3).max(5),
});

export const TranslatedGrammarPatternsSchema = z.array(
  TranslatedGrammarPatternSchema,
);

export const RejectedTranslationPatternSchema = z
  .object({
    id: z.string().regex(/^N[1-5]-\d{3}$/),
    pattern: z.string().min(1),
    jlpt: RawJlptSchema,
    reviewStatus: z.literal('PENDING'),
    failedExamples: z
      .array(
        z.object({
          sourceId: z.string().regex(/^[1-9]\d*$/),
          japanese: z.string().min(1),
          error: z.string().min(1),
        }),
      )
      .min(1),
  })
  .strict();

export const RejectedTranslationPatternsSchema = z.array(
  RejectedTranslationPatternSchema,
);

export type TranslationBatchResponse = z.infer<
  typeof TranslationBatchResponseSchema
>;
export type TranslationCacheEntry = z.infer<typeof TranslationCacheEntrySchema>;
export type TranslatedGrammarPattern = z.infer<
  typeof TranslatedGrammarPatternSchema
>;
export type RejectedTranslationPattern = z.infer<
  typeof RejectedTranslationPatternSchema
>;

export interface TranslationBatchInput {
  pattern: string;
  jlpt: z.infer<typeof RawJlptSchema>;
  examples: ReadonlyArray<{ sourceId: string; japanese: string }>;
}

export function matchTranslationResponse(
  expectedSourceIds: readonly string[],
  response: unknown,
): Map<string, string> {
  const parsed = TranslationBatchResponseSchema.parse(response);
  const expectedIds = new Set(expectedSourceIds);
  const receivedIds = new Set(parsed.translations.map((item) => item.sourceId));

  if (expectedIds.size !== expectedSourceIds.length) {
    throw new Error('sourceId duplicado na entrada de tradução.');
  }

  if (
    receivedIds.size !== parsed.translations.length ||
    expectedIds.size !== receivedIds.size ||
    [...expectedIds].some((sourceId) => !receivedIds.has(sourceId))
  ) {
    throw new Error(
      'A resposta do tradutor não corresponde aos sourceIds solicitados.',
    );
  }

  return new Map(
    parsed.translations.map((item) => [item.sourceId, item.translation]),
  );
}

export function hasTranslationModelArtifact(translation: string): boolean {
  return /(?:^|\s)>?\s*pab(?:\s|$)|>>pob<<|<unk>/i.test(translation);
}
