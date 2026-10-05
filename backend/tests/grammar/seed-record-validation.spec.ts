import { describe, expect, it } from 'vitest';
import {
  validateSeedDataset,
  type GrammarSeedRecord,
} from '../../scripts/grammar/seed-record-validation';

function sampleRecord(
  overrides: Partial<GrammarSeedRecord> = {},
): GrammarSeedRecord {
  return {
    id: 'N5-001',
    pattern: 'です',
    jlpt: 'N5',
    position: 1,
    source: 'tanos',
    examples: [
      {
        japanese: 'これは本です。',
        reading: 'これはほんです。',
        sourceId: '1',
        translation: 'Isto é um livro.',
      },
    ],
    ...overrides,
  };
}

describe('seed-record-validation', () => {
  it('aceita dataset vazio (bootstrap)', () => {
    const result = validateSeedDataset([], 'N5');
    expect(result.total).toBe(0);
    expect(result.valid).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  it('aceita registros estruturalmente válidos do nível esperado', () => {
    const result = validateSeedDataset([sampleRecord()], 'N5');
    expect(result.rejected).toEqual([]);
    expect(result.valid).toHaveLength(1);
  });

  it('rejeita JLPT incompatível com o arquivo', () => {
    const result = validateSeedDataset([sampleRecord({ jlpt: 'N4' })], 'N5');
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reasons.some((r) => r.includes('difere'))).toBe(
      true,
    );
  });

  it('rejeita duplicação de pattern e example sem reading', () => {
    const result = validateSeedDataset(
      [
        sampleRecord(),
        sampleRecord({
          id: 'N5-002',
          examples: [{ japanese: 'はい。', sourceId: '2' }],
        }),
      ],
      'N5',
    );
    expect(result.rejected.length).toBeGreaterThanOrEqual(1);
    const allReasons = result.rejected.flatMap((r) => r.reasons);
    expect(allReasons).toContain('duplicação de pattern');
    expect(allReasons.some((r) => r.includes('reading vazio'))).toBe(true);
  });

  it('rejeita payload que não é array', () => {
    const result = validateSeedDataset({ not: 'an array' }, 'N5');
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reasons[0]).toBe('dataset não é um array JSON');
  });
});
