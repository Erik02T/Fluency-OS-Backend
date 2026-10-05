import { z } from 'zod';
import { EnrichedGrammarRecordSchema } from './enriched-schema';

/**
 * FASE 7 — Contrato de importação para Prisma.
 * Mapeamento de dados validados para o schema do banco de dados.
 */

/** Metadados de enriquecimento armazenados como JSON no banco. */
export const EnrichmentMetadataSchema = z.object({
  enrichedAt: z.string().datetime(),
  enricherVersion: z.string(),
  totalUniqueKanji: z.number().int().min(0),
});

/** Furigana segmentado armazenado como JSON. */
export const FuriganaDataSchema = z.object({
  patternFurigana: z.array(
    z.object({
      text: z.string(),
      reading: z.string(),
    }),
  ),
  exampleFurigana: z.array(
    z.array(
      z.object({
        text: z.string(),
        reading: z.string(),
      }),
    ),
  ),
});

/** Breakdown de kanji armazenado como JSON. */
export const KanjiBreakdownDataSchema = z.object({
  patternKanjiBreakdown: z.object({
    uniqueKanji: z.array(
      z.object({
        character: z.string().length(1),
        reading: z.string().optional(),
        meaning: z.string().optional(),
        jlpt: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']).optional(),
      }),
    ),
    totalKanjiCount: z.number().int().min(0),
  }),
  exampleKanjiBreakdown: z.array(
    z.object({
      uniqueKanji: z.array(
        z.object({
          character: z.string().length(1),
          reading: z.string().optional(),
          meaning: z.string().optional(),
          jlpt: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']).optional(),
        }),
      ),
      totalKanjiCount: z.number().int().min(0),
    }),
  ),
});

/** Dados enriquecidos completos para armazenamento no campo JSON. */
export const GrammarEnrichmentDataSchema = z.object({
  metadata: EnrichmentMetadataSchema,
  furigana: FuriganaDataSchema,
  kanjiBreakdown: KanjiBreakdownDataSchema,
});

/** Registro de importação resultado. */
export const ImportResultSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  pattern: z.string(),
  jlptLevel: z.string(),
  title: z.string(),
  examplesCount: z.number().int(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const ImportResultListSchema = z.array(ImportResultSchema);

export type EnrichmentMetadata = z.infer<typeof EnrichmentMetadataSchema>;
export type FuriganaData = z.infer<typeof FuriganaDataSchema>;
export type KanjiBreakdownData = z.infer<typeof KanjiBreakdownDataSchema>;
export type GrammarEnrichmentData = z.infer<typeof GrammarEnrichmentDataSchema>;
export type ImportResult = z.infer<typeof ImportResultSchema>;
