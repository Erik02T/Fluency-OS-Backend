/**
 * FASE 0 — Testes do Contrato Zod
 * Garante que o schema GrammarPointSchema valida corretamente
 * os dados que entrarão no sistema (Fases 2, 3 e 7).
 */

import {
  GrammarPointSchema,
  GrammarPointSeedInputSchema,
  ReviewStatusSchema,
  GrammarExampleSchema,
} from '../schemas/grammar-point.schema';

describe('GrammarPointSchema (Zod — FASE 0)', () => {
  const validBase = {
    pattern: '〜ている',
    jlptLevel: 'N5',
    title: 'Ação contínua / progressiva',
    formalityLevel: 'neutral',
    difficulty: 1,
    position: 1,
    tags: ['verb', 'te-form'],
    shortExplanation: 'Indica que uma ação está em andamento.',
    detailedExplanation: 'Explicação detalhada...',
    examples: [
      {
        japanese: '食べている',
        reading: 'たべている',
        translation: 'Estou comendo',
        isNatural: true,
        position: 0,
      },
    ],
    source: 'pdf-n5',
    sourceId: 'GrammarList.N5.p12',
    contentVersion: 1,
    reviewStatus: 'PENDING',
  };

  // ─── ReviewStatus ────────────────────────────────────────────────────────────
  describe('ReviewStatusSchema', () => {
    it('should accept all valid statuses', () => {
      const statuses = [
        'PENDING',
        'GENERATED',
        'VALIDATED',
        'REVIEWED',
        'PUBLISHED',
      ];
      for (const status of statuses) {
        expect(() => ReviewStatusSchema.parse(status)).not.toThrow();
      }
    });

    it('should reject unknown status', () => {
      expect(() => ReviewStatusSchema.parse('DRAFT')).toThrow();
      expect(() => ReviewStatusSchema.parse('')).toThrow();
    });
  });

  // ─── GrammarExample ───────────────────────────────────────────────────────────
  describe('GrammarExampleSchema', () => {
    it('should accept valid example', () => {
      const result = GrammarExampleSchema.parse({
        japanese: '食べている',
        translation: 'Estou comendo',
      });
      expect(result.isNatural).toBe(true);
      expect(result.position).toBe(0);
    });

    it('should reject example without japanese', () => {
      expect(() =>
        GrammarExampleSchema.parse({ translation: 'Estou comendo' }),
      ).toThrow();
    });

    it('should reject example without translation', () => {
      expect(() =>
        GrammarExampleSchema.parse({ japanese: '食べている' }),
      ).toThrow();
    });
  });

  // ─── GrammarPointSchema ───────────────────────────────────────────────────────
  describe('GrammarPointSchema', () => {
    it('should parse a complete valid grammar point', () => {
      const result = GrammarPointSchema.parse(validBase);
      expect(result.pattern).toBe('〜ている');
      expect(result.jlptLevel).toBe('N5');
      expect(result.reviewStatus).toBe('PENDING');
      expect(result.contentVersion).toBe(1);
    });

    it('should apply defaults when optional fields are omitted', () => {
      const minimal = {
        pattern: '〜たい',
        jlptLevel: 'N5',
        title: 'Desejo',
        shortExplanation: 'Expressa desejo de fazer algo.',
      };
      const result = GrammarPointSchema.parse(minimal);
      expect(result.formalityLevel).toBe('neutral');
      expect(result.difficulty).toBe(1);
      expect(result.position).toBe(0);
      expect(result.tags).toEqual([]);
      expect(result.examples).toEqual([]);
      expect(result.reviewStatus).toBe('PENDING');
      expect(result.contentVersion).toBe(1);
    });

    it('should reject difficulty outside 1-5', () => {
      expect(() =>
        GrammarPointSchema.parse({ ...validBase, difficulty: 0 }),
      ).toThrow();
      expect(() =>
        GrammarPointSchema.parse({ ...validBase, difficulty: 6 }),
      ).toThrow();
    });

    it('should reject invalid jlptLevel', () => {
      expect(() =>
        GrammarPointSchema.parse({ ...validBase, jlptLevel: 'N6' }),
      ).toThrow();
    });

    it('should reject invalid formalityLevel', () => {
      expect(() =>
        GrammarPointSchema.parse({ ...validBase, formalityLevel: 'slang' }),
      ).toThrow();
    });

    it('should reject contentHash with wrong length', () => {
      expect(() =>
        GrammarPointSchema.parse({ ...validBase, contentHash: 'abc123' }),
      ).toThrow();
    });

    it('should accept a 64-char hex string as contentHash', () => {
      const hash = 'a'.repeat(64);
      const result = GrammarPointSchema.parse({
        ...validBase,
        contentHash: hash,
      });
      expect(result.contentHash).toBe(hash);
    });

    it('should reject missing pattern', () => {
      const { pattern: _pattern, ...rest } = validBase;
      expect(() => GrammarPointSchema.parse(rest)).toThrow();
    });

    it('should reject missing shortExplanation', () => {
      const { shortExplanation: _shortExplanation, ...rest } = validBase;
      expect(() => GrammarPointSchema.parse(rest)).toThrow();
    });
  });

  // ─── GrammarPointSeedInputSchema ──────────────────────────────────────────────
  describe('GrammarPointSeedInputSchema', () => {
    it('should parse seed input without contentHash and reviewedAt', () => {
      const seedInput = { ...validBase };
      const result = GrammarPointSeedInputSchema.parse(seedInput);
      expect(result.reviewStatus).toBe('PENDING');
      // contentHash is omitted from seed schema — should not appear
      expect('contentHash' in result).toBe(false);
    });

    it('should default reviewStatus to PENDING in seed input', () => {
      const { reviewStatus: _reviewStatus, ...rest } = validBase;
      const result = GrammarPointSeedInputSchema.parse(rest);
      expect(result.reviewStatus).toBe('PENDING');
    });
  });
});
