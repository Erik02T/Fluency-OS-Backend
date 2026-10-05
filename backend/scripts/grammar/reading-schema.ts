import { z } from 'zod';
import { RawJlptSchema } from './raw-schema';

export const SelectedExampleForReadingSchema = z
  .object({
    sourceId: z.string().regex(/^[1-9]\d*$/),
    japanese: z.string().min(1),
    rankingScore: z.number().int().min(0).max(100),
    reviewStatus: z.literal('PENDING'),
  })
  .strict();

export const SelectedPatternForReadingSchema = z
  .object({
    id: z.string().regex(/^N[1-5]-\d{3}$/),
    pattern: z.string().min(1),
    jlpt: RawJlptSchema,
    position: z.number().int().positive(),
    source: z.string().min(1),
    reviewStatus: z.literal('PENDING'),
    examples: z.array(SelectedExampleForReadingSchema).min(3).max(5),
  })
  .strict();

export const SelectedPatternsForReadingSchema = z.array(
  SelectedPatternForReadingSchema,
);

export const ReadingExampleSchema = SelectedExampleForReadingSchema.extend({
  reading: z.string().min(1),
});

export const ReadingPatternSchema = SelectedPatternForReadingSchema.extend({
  examples: z.array(ReadingExampleSchema).min(3).max(5),
});

export const ReadingPatternsSchema = z.array(ReadingPatternSchema);

export const ReadingFailureSchema = z
  .object({
    id: z.string().regex(/^N[1-5]-\d{3}$/),
    pattern: z.string().min(1),
    jlpt: RawJlptSchema,
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

export const ReadingFailuresSchema = z.array(ReadingFailureSchema);

export type ReadingPattern = z.infer<typeof ReadingPatternSchema>;
export type ReadingFailure = z.infer<typeof ReadingFailureSchema>;
