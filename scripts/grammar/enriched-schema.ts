import { z } from 'zod';
import { GrammarSchema, GrammarExampleOutputSchema } from './generated-schema';

/**
 * FASE 6 — Contrato de enriquecimento.
 * Adiciona furigana, breakdown de kanji e metadados estruturais.
 */

/** Furigana segmentado para texto japonês. */
export const FuriganaSegmentSchema = z.object({
  text: z.string().min(1),
  reading: z.string().min(1),
});

export const FuriganaSegmentsSchema = z.array(FuriganaSegmentSchema);

/** Informação de um kanji encontrado no texto. */
export const KanjiInfoSchema = z.object({
  character: z.string().length(1),
  reading: z.string().optional(), // Placeholder - será preenchido via KANJIDIC
  meaning: z.string().optional(),
  jlpt: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']).optional(),
});

/** Breakdown de kanji em um texto. */
export const KanjiBreakdownSchema = z.object({
  uniqueKanji: z.array(KanjiInfoSchema),
  totalKanjiCount: z.number().int().min(0),
});

/** Exemplo enriquecido com furigana e metadados. */
export const EnrichedExampleSchema = GrammarExampleOutputSchema.extend({
  furigana: FuriganaSegmentsSchema,
  kanjiBreakdown: KanjiBreakdownSchema,
  characterCount: z.number().int().min(1),
  wordCount: z.number().int().min(1),
});

/** Gramática enriquecida completa. */
export const EnrichedGrammarSchema = GrammarSchema.extend({
  /** Furigana do pattern gramatical. */
  patternFurigana: FuriganaSegmentsSchema,
  /** Breakdown de kanji do pattern. */
  patternKanjiBreakdown: KanjiBreakdownSchema,
  /** Exemplos enriquecidos. */
  examples: z.array(EnrichedExampleSchema).min(3).max(5),
  /** Metadados de enriquecimento. */
  enrichmentMetadata: z.object({
    enrichedAt: z.string().datetime(),
    enricherVersion: z.string(),
    totalUniqueKanji: z.number().int().min(0),
  }),
});

/** Metadados de validação adicionados na FASE 6. */
export const ValidationMetadataSchema = z.object({
  validatedAt: z.string().datetime(),
  contentHash: z.string(),
  warnings: z.array(z.string()),
});

/** Registro persistido em data/enriched — schema + proveniência do gerado. */
export const EnrichedGrammarRecordSchema = EnrichedGrammarSchema.extend({
  id: z.string().regex(/^N[1-5]-\d{3}$/),
  position: z.number().int().min(1),
  source: z.string().min(1),
  validationMetadata: ValidationMetadataSchema.optional(),
}).passthrough(); // Permite campos adicionais

export const EnrichedGrammarListSchema = z.array(EnrichedGrammarRecordSchema);

export type FuriganaSegment = z.infer<typeof FuriganaSegmentSchema>;
export type KanjiInfo = z.infer<typeof KanjiInfoSchema>;
export type KanjiBreakdown = z.infer<typeof KanjiBreakdownSchema>;
export type EnrichedExample = z.infer<typeof EnrichedExampleSchema>;
export type EnrichedGrammar = z.infer<typeof EnrichedGrammarSchema>;
export type EnrichedGrammarRecord = z.infer<typeof EnrichedGrammarRecordSchema>;
export type ValidationMetadata = z.infer<typeof ValidationMetadataSchema>;
