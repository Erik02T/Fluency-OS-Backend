import { z } from 'zod';

/**
 * FASE 0 — Contrato Definitivo de Dados
 *
 * Zod schema que representa o contrato completo de um GrammarPoint.
 * É a fonte de verdade para validação de dados antes do Seed (Fase 7)
 * e durante a Extração (Fase 2) e Normalização (Fase 3).
 *
 * Ciclo de vida de reviewStatus:
 *   PENDING → GENERATED → VALIDATED → REVIEWED → PUBLISHED
 */

// ─── Enum: JLPT Level ─────────────────────────────────────────────────────────
export const JLPTLevelSchema = z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);

// ─── Enum: Formality Level ────────────────────────────────────────────────────
export const FormalityLevelSchema = z.enum([
  'casual',
  'neutral',
  'formal',
  'written',
]);

// ─── Enum: Review Status ──────────────────────────────────────────────────────
export const ReviewStatusSchema = z.enum([
  'PENDING', // criado, aguardando processamento
  'GENERATED', // gerado por script/IA, não revisado
  'VALIDATED', // passou por validação automática (schema + hash)
  'REVIEWED', // revisado manualmente por humano
  'PUBLISHED', // aprovado e visível para alunos
]);

// ─── Sub-schema: Example ──────────────────────────────────────────────────────
export const GrammarExampleSchema = z.object({
  japanese: z.string().min(1, 'Frase japonesa obrigatória'),
  reading: z.string().nullable().optional(),
  translation: z.string().min(1, 'Tradução obrigatória'),
  notes: z.string().nullable().optional(),
  isNatural: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
});

// ─── Main schema: GrammarPoint ────────────────────────────────────────────────
export const GrammarPointSchema = z.object({
  // Campos do formulário / cadastro
  pattern: z.string().min(1, 'Pattern obrigatório').max(200),
  jlptLevel: JLPTLevelSchema,
  title: z.string().min(1, 'Título obrigatório').max(200),
  formalityLevel: FormalityLevelSchema.default('neutral'),
  difficulty: z.number().int().min(1).max(5).default(1),
  position: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
  shortExplanation: z.string().min(1, 'Explicação curta obrigatória').max(500),
  detailedExplanation: z.string().nullable().optional(),
  examples: z.array(GrammarExampleSchema).default([]),

  // Campos técnicos (rastreabilidade e QA)
  source: z.string().max(200).nullable().optional(),
  sourceId: z.string().max(200).nullable().optional(),
  contentVersion: z.number().int().min(1).default(1),
  contentHash: z.string().length(64).nullable().optional(), // SHA-256 hex
  reviewStatus: ReviewStatusSchema.default('PENDING'),
  reviewedAt: z.date().nullable().optional(),
});

// ─── Schema para importação/seed (input externo) ──────────────────────────────
export const GrammarPointSeedInputSchema = GrammarPointSchema.omit({
  contentHash: true, // calculado automaticamente
  reviewedAt: true, // preenchido ao revisar
}).extend({
  // No seed, reviewStatus pode vir do arquivo externo ou usar PENDING como default
  reviewStatus: ReviewStatusSchema.default('PENDING'),
});

// ─── Tipos inferidos ──────────────────────────────────────────────────────────
export type JLPTLevel = z.infer<typeof JLPTLevelSchema>;
export type FormalityLevel = z.infer<typeof FormalityLevelSchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type GrammarExample = z.infer<typeof GrammarExampleSchema>;
export type GrammarPoint = z.infer<typeof GrammarPointSchema>;
export type GrammarPointSeedInput = z.infer<typeof GrammarPointSeedInputSchema>;
