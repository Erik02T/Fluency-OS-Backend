import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateSeedDataset } from '../../scripts/grammar/seed-record-validation';
import {
  GENERATED_ROOT,
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  NORMALIZED_ROOT,
  RAW_ROOT,
  REJECTED_ROOT,
  SEED_GRAMMAR_ROOT,
  VALIDATED_ROOT,
  assertPipelineDirs,
  rawLevelDir,
  seedGrammarFile,
} from '../../scripts/utils';

describe('FASE 1 — Ambiente do pipeline de gramática', () => {
  it('possui todas as pastas do pipeline', () => {
    const dirs = assertPipelineDirs();
    expect(dirs.length).toBeGreaterThan(0);
    expect(fs.existsSync(RAW_ROOT)).toBe(true);
    expect(fs.existsSync(NORMALIZED_ROOT)).toBe(true);
    expect(fs.existsSync(GENERATED_ROOT)).toBe(true);
    expect(fs.existsSync(VALIDATED_ROOT)).toBe(true);
    expect(fs.existsSync(REJECTED_ROOT)).toBe(true);
    expect(fs.existsSync(SEED_GRAMMAR_ROOT)).toBe(true);

    for (const level of JLPT_LEVELS) {
      expect(fs.existsSync(rawLevelDir(level))).toBe(true);
    }
  });

  it('possui arquivos de seed estruturalmente válidos por nível', () => {
    for (const level of JLPT_LEVELS) {
      const file = seedGrammarFile(level);
      expect(fs.existsSync(file)).toBe(true);

      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(Array.isArray(parsed)).toBe(true);

      // Vazio (bootstrap) ou preenchido pelo pipeline — ambos ok,
      // desde que registros existentes passem o contrato da FASE 28.
      const result = validateSeedDataset(parsed, JLPT_LEVEL_LABEL[level]);
      expect(
        result.rejected,
        `${level}: ${JSON.stringify(result.reasons)}`,
      ).toEqual([]);
      expect(result.total).toBe((parsed as unknown[]).length);
      expect(result.valid.length).toBe(result.total);
    }
  });

  it('possui stubs dos scripts do pipeline', () => {
    const scriptsDir = path.resolve(__dirname, '../../scripts/grammar');
    const expected = [
      'extract.ts',
      'normalize.ts',
      'enrich.ts',
      'validate.ts',
      'import.ts',
      'translate-examples.ts',
    ];

    for (const name of expected) {
      expect(fs.existsSync(path.join(scriptsDir, name))).toBe(true);
    }
  });

  it('resolve zod', async () => {
    const zod = await import('zod');
    expect(zod.z).toBeDefined();
  });

  it('resolve kuroshiro e analyzer kuromoji', async () => {
    const kuroshiro = await import('kuroshiro');
    const analyzer = await import('kuroshiro-analyzer-kuromoji');
    expect(kuroshiro.default ?? kuroshiro).toBeDefined();
    expect(analyzer.default ?? analyzer).toBeDefined();
  });
});
