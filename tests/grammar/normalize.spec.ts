import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CANONICAL_WAVE_DASH,
  canonicalizeJlpt,
  canonicalizePattern,
  deterministicId,
} from '../../scripts/grammar/canonicalize';
import { normalizeRawPatterns } from '../../scripts/grammar/normalize-patterns';
import { NormalizedGrammarPatternListSchema } from '../../scripts/grammar/normalized-schema';
import type { RawGrammarPattern } from '../../scripts/grammar/raw-schema';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  normalizedFile,
} from '../../scripts/utils';

describe('FASE 3 — Normalização', () => {
  it('padroniza 〜, espaços e 下さい', () => {
    expect(canonicalizePattern('～てください')).toBe(`${CANONICAL_WAVE_DASH}てください`);
    expect(canonicalizePattern('〜てください')).toBe(`${CANONICAL_WAVE_DASH}てください`);
    expect(canonicalizePattern('〜て下さい')).toBe(`${CANONICAL_WAVE_DASH}てください`);
    expect(canonicalizePattern('  ～く/ ～になる  ')).toBe(
      `${CANONICAL_WAVE_DASH}く/${CANONICAL_WAVE_DASH}になる`,
    );
    expect(canonicalizePattern('stem + たいです')).toBe('stem+たいです');
    expect(canonicalizePattern('～たり …～たりする')).toBe(
      `${CANONICAL_WAVE_DASH}たり…${CANONICAL_WAVE_DASH}たりする`,
    );
  });

  it('padroniza nomes JLPT', () => {
    expect(canonicalizeJlpt('n5')).toBe('N5');
    expect(canonicalizeJlpt('N4')).toBe('N4');
    expect(canonicalizeJlpt('jlpt N3')).toBe('N3');
    expect(canonicalizeJlpt('2')).toBe('N2');
    expect(() => canonicalizeJlpt('N6')).toThrow();
  });

  it('gera IDs determinísticos', () => {
    expect(deterministicId('N5', 12)).toBe('N5-012');
    expect(deterministicId('N5', 13)).toBe('N5-013');
    expect(deterministicId('N4', 1)).toBe('N4-001');
  });

  it('ordena, deduplica canônicos e reatribui position/id', () => {
    const raw: RawGrammarPattern[] = [
      {
        pattern: '～て下さい',
        jlpt: 'N5',
        source: 'tanos',
        sourceId: 'n5-002',
        position: 2,
      },
      {
        pattern: 'です',
        jlpt: 'N5',
        source: 'tanos',
        sourceId: 'n5-001',
        position: 1,
      },
      {
        pattern: '〜てください',
        jlpt: 'N5',
        source: 'tanos',
        sourceId: 'n5-003',
        position: 3,
      },
    ];

    const { accepted, rejected, issues } = normalizeRawPatterns(raw);

    expect(accepted).toEqual([
      {
        id: 'N5-001',
        pattern: 'です',
        jlpt: 'N5',
        position: 1,
        source: 'tanos',
      },
      {
        id: 'N5-002',
        pattern: `${CANONICAL_WAVE_DASH}てください`,
        jlpt: 'N5',
        position: 2,
        source: 'tanos',
      },
    ]);
    expect(rejected).toHaveLength(1);
    expect(issues.some((i) => i.code === 'DUPLICATE_PATTERN')).toBe(true);
  });

  it('persiste data/normalized/{level}.json canônicos sem duplicatas', () => {
    for (const level of JLPT_LEVELS) {
      const file = normalizedFile(level);
      expect(fs.existsSync(file)).toBe(true);

      const parsed = NormalizedGrammarPatternListSchema.parse(
        JSON.parse(fs.readFileSync(file, 'utf8')),
      );
      expect(parsed.length).toBeGreaterThan(0);

      const jlpt = JLPT_LEVEL_LABEL[level];
      const patterns = new Set<string>();

      parsed.forEach((item, index) => {
        expect(item.jlpt).toBe(jlpt);
        expect(item.position).toBe(index + 1);
        expect(item.id).toBe(`${jlpt}-${String(index + 1).padStart(3, '0')}`);
        expect(item.pattern.includes('～')).toBe(false);
        expect(item.pattern.includes('下さい')).toBe(false);
        expect(patterns.has(item.pattern)).toBe(false);
        patterns.add(item.pattern);
      });
    }
  });
});
