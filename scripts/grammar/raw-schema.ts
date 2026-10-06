import { z } from 'zod';

/**
 * FASE 2 — Contrato da fonte bruta (somente pattern + JLPT + provenance).
 * Sem explicações, exemplos ou conteúdo gerado.
 */
export const RawJlptSchema = z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);

export const RawGrammarPatternSchema = z.object({
  pattern: z.string().min(1, 'pattern vazio'),
  jlpt: RawJlptSchema,
  source: z.string().min(1),
  sourceId: z.string().min(1),
  position: z.number().int().min(1, 'posição inválida'),
});

export const RawGrammarPatternListSchema = z.array(RawGrammarPatternSchema);

export type RawJlpt = z.infer<typeof RawJlptSchema>;
export type RawGrammarPattern = z.infer<typeof RawGrammarPatternSchema>;
