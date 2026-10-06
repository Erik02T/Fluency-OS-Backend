import { z } from 'zod';

/**
 * FASE 27 — Contrato de estruturação do GrammarPoint.
 *
 * Junta: Pattern + JLPT + Position + Examples (com reading).
 *
 * Campos NÃO inventados nesta fase (marcados PENDING):
 *   - title, shortExplanation, detailedExplanation, translation, tags
 *
 * Serão preenchidos em fases posteriores com LLM ou outra fonte confiável.
 */

const PENDING_LITERAL = 'PENDING' as const;

/** Exemplo estruturado com reading (FASE 26 + 27). */
export const StructuredExampleSchema = z.object({
  japanese: z.string().min(1),
  reading: z.string().min(1).optional(),
  translation: z.string().min(1).default(PENDING_LITERAL),
  sourceId: z.string().min(1).optional(),
  rankingScore: z.number().int().min(0).optional(),
  reviewStatus: z.enum(['PENDING', 'GENERATED', 'VALIDATED', 'REVIEWED', 'PUBLISHED'])
    .default('PENDING'),
  position: z.number().int().min(0).optional(),
});

/** Registro GrammarPoint estruturado (saída da FASE 27). */
export const StructuredGrammarPointSchema = z.object({
  id: z.string().regex(/^N[1-5]-\d{3}$/, 'Formato de ID: NX-YYY'),
  pattern: z.string().min(1, 'Pattern é obrigatório'),
  jlpt: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']),
  position: z.number().int().min(1, 'Position deve ser >= 1'),
  source: z.string().min(1, 'Source é obrigatório'),
  sourceId: z.string().regex(/^N[1-5]-\d{3}$/).optional(),

  title: z.string().min(1).default(PENDING_LITERAL),
  shortExplanation: z.string().min(1).default(PENDING_LITERAL),
  detailedExplanation: z.string().default(PENDING_LITERAL),
  formalityLevel: z.enum(['casual', 'neutral', 'formal', 'written']).default('neutral'),
  difficulty: z.number().int().min(1).max(5).default(1),
  tags: z.array(z.string().min(1)).default([]),
  reviewStatus: z.enum(['PENDING', 'GENERATED', 'VALIDATED', 'REVIEWED', 'PUBLISHED'])
    .default('PENDING'),

  examples: z.array(StructuredExampleSchema).min(1, 'Ao menos 1 exemplo é obrigatório'),

  enrichmentMetadata: z
    .object({
      enrichedAt: z.string().datetime().optional(),
      enricherVersion: z.string().optional(),
      totalUniqueKanji: z.number().int().min(0).optional(),
    })
    .optional(),

  validationMetadata: z
    .object({
      validatedAt: z.string().datetime().optional(),
      contentHash: z.string().optional(),
      warnings: z.array(z.string()).optional(),
    })
    .optional(),
});

export const StructuredGrammarPointListSchema = z.array(StructuredGrammarPointSchema);

export type StructuredExample = z.infer<typeof StructuredExampleSchema>;
export type StructuredGrammarPoint = z.infer<typeof StructuredGrammarPointSchema>;
