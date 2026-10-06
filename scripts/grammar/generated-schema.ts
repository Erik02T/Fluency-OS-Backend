import { z } from 'zod';
import { RawJlptSchema } from './raw-schema';

/**
 * FASE 4 — Contrato rígido de geração (entrada).
 * A LLM só recebe pattern + jlpt — nunca um pedido livre.
 */
export const GrammarGenerateInputSchema = z
  .object({
    pattern: z.string().min(1),
    jlpt: RawJlptSchema,
  })
  .strict();

/**
 * FASE 4 — Contrato rígido de saída.
 * O gerador nunca aceita texto livre: só JSON que passa neste schema.
 */
export const GrammarExampleOutputSchema = z.object({
  japanese: z.string().min(1),
  reading: z.string().min(1).optional(),
  translation: z.string().min(1),
});

export const GrammarSchema = z.object({
  pattern: z.string().min(1),
  jlpt: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']),
  title: z.string().min(1),
  formalityLevel: z.enum(['casual', 'neutral', 'formal', 'written']),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string().min(1)).min(1),
  shortExplanation: z.string().min(1),
  detailedExplanation: z.string().min(1),
  examples: z.array(GrammarExampleOutputSchema).min(3).max(5),
});

/** Registro persistido em data/generated — schema + proveniência do normalizado. */
export const GeneratedGrammarRecordSchema = GrammarSchema.extend({
  id: z.string().regex(/^N[1-5]-\d{3}$/),
  position: z.number().int().min(1),
  source: z.string().min(1),
});

export const GeneratedGrammarListSchema = z.array(GeneratedGrammarRecordSchema);

export type GrammarGenerateInput = z.infer<typeof GrammarGenerateInputSchema>;
export type GrammarGenerated = z.infer<typeof GrammarSchema>;
export type GeneratedGrammarRecord = z.infer<typeof GeneratedGrammarRecordSchema>;
