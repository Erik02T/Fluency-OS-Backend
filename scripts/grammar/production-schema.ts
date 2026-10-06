import { z } from 'zod';
import { EnrichedGrammarRecordSchema } from './enriched-schema';

/**
 * FASE 10 — Contrato de exportação para produção.
 * JSON final consolidado com metadados de versão e integridade.
 */

/** Metadados do dataset de produção. */
export const ProductionMetadataSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Formato: X.Y.Z'),
  exportedAt: z.string().datetime(),
  exportSource: z.string(), // 'validated' | 'database'
  totalRecords: z.number().int().min(0),
  contentHash: z.string().length(64), // SHA-256 hex
  pipelineVersion: z.string(), // Versão do pipeline de gramática
  levels: z.array(z.enum(['N5', 'N4', 'N3', 'N2', 'N1'])),
});

/** Registro gramatical de produção (limpo e otimizado). */
export const ProductionGrammarRecordSchema = z.object({
  // Identificação
  id: z.string().min(1), // Aceita tanto padrão N[1-5]-\d{3} quanto CUID do banco
  sourceId: z.string().regex(/^N[1-5]-\d{3}$/).optional(), // ID original da fonte
  pattern: z.string().min(1),
  jlpt: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']),
  position: z.number().int().min(1),

  // Conteúdo principal
  title: z.string().min(1),
  shortExplanation: z.string().min(1),
  detailedExplanation: z.string().min(1),
  formalityLevel: z.enum(['casual', 'neutral', 'formal', 'written']),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string().min(1)),

  // Exemplos
  examples: z.array(
    z.object({
      japanese: z.string().min(1),
      reading: z.string().optional(),
      translation: z.string().min(1),
      furigana: z.array(
        z.object({
          text: z.string().min(1),
          reading: z.string().min(1),
        }),
      ),
      kanjiBreakdown: z.object({
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
      characterCount: z.number().int().min(1),
      wordCount: z.number().int().min(1),
    }),
  ),

  // Enriquecimento do pattern
  patternFurigana: z.array(
    z.object({
      text: z.string().min(1),
      reading: z.string().min(1),
    }),
  ),
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

  // Proveniência
  source: z.string().min(1),
  enrichedAt: z.string().datetime(),
  enricherVersion: z.string(),
  validatedAt: z.string().datetime(),
  contentHash: z.string().length(64),
});

/** Dataset completo de produção. */
export const ProductionDatasetSchema = z.object({
  metadata: ProductionMetadataSchema,
  data: z.array(ProductionGrammarRecordSchema),
});

export type ProductionMetadata = z.infer<typeof ProductionMetadataSchema>;
export type ProductionGrammarRecord = z.infer<typeof ProductionGrammarRecordSchema>;
export type ProductionDataset = z.infer<typeof ProductionDatasetSchema>;
