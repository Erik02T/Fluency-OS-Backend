import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  rawPatternsFile,
  tanosGrammarPdf,
} from '../../scripts/utils';
import {
  parseTanosPatternLines,
  parseTanosPdfPatterns,
  isPatternLine,
} from '../../scripts/grammar/parse-tanos';
import {
  RawGrammarPatternListSchema,
  RawGrammarPatternSchema,
} from '../../scripts/grammar/raw-schema';
import { validateRawPatterns } from '../../scripts/grammar/validate-raw';

describe('FASE 21 — Extração dos PDFs', () => {
  it('rejeita headers e ruído do PDF Tanos', () => {
    expect(isPatternLine('JLPT N5 Grammar List')).toBe(false);
    expect(isPatternLine('JLPT Resources – http://www.tanos.co.uk/jlpt/')).toBe(false);
    expect(isPatternLine('This is not a cumulative list.')).toBe(false);
    expect(isPatternLine('1')).toBe(false);
    expect(isPatternLine('～てください')).toBe(true);
    expect(isPatternLine('stem + たいです')).toBe(true);
  });

  it('parseia somente linhas de padrão do texto Tanos', () => {
    const text = `
JLPT Resources – http://www.tanos.co.uk/jlpt/
1
JLPT N5 Grammar List
です
～てください
2
ないでください
-- 1 of 3 --
`;
    expect(parseTanosPatternLines(text)).toEqual(['です', '～てください', 'ないでください']);
  });

  it('exige título do nível esperado e pelo menos um pattern extraível', () => {
    expect(() =>
      parseTanosPdfPatterns('JLPT N4 Grammar List\n～し', 'N5'),
    ).toThrow('Título JLPT N5 ausente ou incorreto no PDF.');
    expect(() => parseTanosPdfPatterns('JLPT N5 Grammar List\n', 'N5')).toThrow(
      'Nenhum pattern extraído do PDF JLPT N5.',
    );
    expect(
      parseTanosPdfPatterns('JLPT N5 Grammar List\n～てください', 'N5'),
    ).toEqual(['～てください']);
  });

  it('valida schema Zod do pattern bruto', () => {
    const ok = RawGrammarPatternSchema.safeParse({
      pattern: '〜てください',
      jlpt: 'N5',
      source: 'tanos',
      sourceId: 'n5-001',
      position: 1,
    });
    expect(ok.success).toBe(true);

    const empty = RawGrammarPatternSchema.safeParse({
      pattern: '',
      jlpt: 'N5',
      source: 'tanos',
      sourceId: 'n5-001',
      position: 1,
    });
    expect(empty.success).toBe(false);

    const badJlpt = RawGrammarPatternSchema.safeParse({
      pattern: 'です',
      jlpt: 'N6',
      source: 'tanos',
      sourceId: 'n5-001',
      position: 1,
    });
    expect(badJlpt.success).toBe(false);

    const badPos = RawGrammarPatternSchema.safeParse({
      pattern: 'です',
      jlpt: 'N5',
      source: 'tanos',
      sourceId: 'n5-001',
      position: 0,
    });
    expect(badPos.success).toBe(false);
  });

  it('detecta pattern vazio, JLPT inválido e duplicação em posições diferentes', () => {
    const invalidJlpt = validateRawPatterns(['です'], 'N9', 'tanos');
    expect(invalidJlpt.issues.some((i) => i.code === 'INVALID_JLPT')).toBe(true);
    expect(invalidJlpt.accepted).toEqual([]);

    const empty = validateRawPatterns(['', 'です'], 'N5', 'tanos');
    expect(empty.issues.some((i) => i.code === 'EMPTY_PATTERN')).toBe(true);
    expect(empty.accepted.map((p) => p.pattern)).toEqual(['です']);

    const dup = validateRawPatterns(['～が早いか', '～なり', '～が早いか'], 'N1', 'tanos');
    expect(dup.accepted.map((p) => p.pattern)).toEqual(['～が早いか', '～なり']);
    expect(dup.rejected).toHaveLength(1);
    expect(dup.issues.some((i) => i.code === 'DUPLICATE_PATTERN')).toBe(true);
    expect(dup.issues.find((i) => i.code === 'DUPLICATE_PATTERN')?.previousPosition).toBe(1);
    expect(dup.issues.find((i) => i.code === 'DUPLICATE_PATTERN')?.position).toBe(3);
  });

  it('gera sourceId e position estáveis', () => {
    const { accepted } = validateRawPatterns(['です', 'も'], 'N5', 'tanos');
    expect(accepted[0]).toMatchObject({
      pattern: 'です',
      jlpt: 'N5',
      source: 'tanos',
      sourceId: 'n5-001',
      position: 1,
    });
    expect(accepted[1]).toMatchObject({
      sourceId: 'n5-002',
      position: 2,
    });
  });

  it('persiste patterns.json por nível a partir dos PDFs Tanos (sem inventar dados)', () => {
    for (const level of JLPT_LEVELS) {
      expect(fs.existsSync(tanosGrammarPdf(level))).toBe(true);

      const file = rawPatternsFile(level);
      expect(fs.existsSync(file)).toBe(true);

      const parsed = RawGrammarPatternListSchema.parse(
        JSON.parse(fs.readFileSync(file, 'utf8')),
      );
      expect(parsed.length).toBeGreaterThan(0);

      const jlpt = JLPT_LEVEL_LABEL[level];
      for (const item of parsed) {
        expect(item.jlpt).toBe(jlpt);
        expect(item.source).toBe('tanos');
        expect(item.pattern.trim().length).toBeGreaterThan(0);
      }

      const unique = new Set(parsed.map((p) => p.pattern));
      expect(unique.size).toBe(parsed.length);
    }
  });
});
