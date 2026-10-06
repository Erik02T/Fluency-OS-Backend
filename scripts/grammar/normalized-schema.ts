import { z } from 'zod';
import { RawJlptSchema } from './raw-schema';

/**
 * FASE 3 — Contrato canônico pós-normalização.
 */
export const NormalizedGrammarPatternSchema = z.object({
  id: z.string().regex(/^N[1-5]-\d{3}$/, 'id determinístico inválido'),
  pattern: z.string().min(1, 'pattern vazio'),
  jlpt: RawJlptSchema,
  position: z.number().int().min(1, 'posição inválida'),
  source: z.string().min(1),
});

export const NormalizedGrammarPatternListSchema = z.array(
  NormalizedGrammarPatternSchema,
);

export type NormalizedGrammarPattern = z.infer<
  typeof NormalizedGrammarPatternSchema
>;
