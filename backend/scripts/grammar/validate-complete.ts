/**
 * FASE 28 — Validação completa
 *
 * Valida o dataset inteiro de gramática (GrammarPoint:
 *   pattern ✅ | jlpt ✅ | position ✅
 * Example:
 *   japanese ✅ | reading ✅ | sourceId ✅
 * Relação:
 *   GrammarPoint → Examples ✅
 *
 * Rejeita:
 *   pattern vazio, example vazio, duplicação, reading vazio,
 *   source inexistente, JLPT inválido.
 *
 * Saída:
 *   data/validated/grammar/  (registros válidos)
 *   data/rejected/grammar/   (registros rejeitados com motivo)
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  assertPipelineDirs,
  seedGrammarFile,
  validatedGrammarFile,
  rejectedGrammarFile,
} from '../utils';
import type { JlptLevelDir } from '../utils';
import { validateSeedDataset } from './seed-record-validation';

interface LevelValidationStats {
  total: number;
  valid: number;
  rejected: number;
  reasons: Record<string, number>;
}

async function validateLevel(level: JlptLevelDir): Promise<LevelValidationStats> {
  const inputPath = seedGrammarFile(level);
  if (!fs.existsSync(inputPath)) {
    console.log(`  [SKIP] Arquivo de seed não encontrado: ${inputPath}`);
    return { total: 0, valid: 0, rejected: 0, reasons: {} };
  }

  const rawData: unknown = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const result = validateSeedDataset(rawData, JLPT_LEVEL_LABEL[level]);

  if (result.valid.length > 0) {
    const outPath = validatedGrammarFile(level);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(result.valid, null, 2)}\n`, 'utf8');
  }

  if (result.rejected.length > 0) {
    const outPath = rejectedGrammarFile(level);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(result.rejected, null, 2)}\n`, 'utf8');
  }

  console.log(
    `✔ [${JLPT_LEVEL_LABEL[level]}] ${result.valid.length} válidos | ` +
      `${result.rejected.length} rejeitados (total ${result.total})`,
  );

  return {
    total: result.total,
    valid: result.valid.length,
    rejected: result.rejected.length,
    reasons: result.reasons,
  };
}

interface CliOptions {
  level?: JlptLevelDir;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--level') {
      const value = argv[++i]?.toLowerCase();
      if (!value || !JLPT_LEVELS.includes(value as JlptLevelDir)) {
        throw new Error(`--level inválido. Use: ${JLPT_LEVELS.join('|')}`);
      }
      opts.level = value as JlptLevelDir;
    }
  }
  return opts;
}

async function main(): Promise<void> {
  assertPipelineDirs();
  const opts = parseArgs(process.argv.slice(2));

  console.log('═'.repeat(70));
  console.log('FASE 28 — Validação completa do dataset de gramática');
  console.log('═'.repeat(70));

  const levels = opts.level ? [opts.level] : [...JLPT_LEVELS];

  const totals = { total: 0, valid: 0, rejected: 0 };
  const allReasons: Record<string, number> = {};

  for (const level of levels) {
    const stats = await validateLevel(level);
    totals.total += stats.total;
    totals.valid += stats.valid;
    totals.rejected += stats.rejected;
    for (const [reason, count] of Object.entries(stats.reasons)) {
      allReasons[reason] = (allReasons[reason] || 0) + count;
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('RESUMO GERAL');
  console.log('═'.repeat(70));
  console.log(`Total de registros analisados: ${totals.total}`);
  console.log(`Válidos:    ${totals.valid}`);
  console.log(`Rejeitados: ${totals.rejected}`);
  if (Object.keys(allReasons).length > 0) {
    console.log('\nMotivos de rejeição (contagem):');
    const sortedReasons = Object.entries(allReasons).sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of sortedReasons) {
      console.log(`  ${count.toString().padStart(4)}x  ${reason}`);
    }
  }
  console.log('═'.repeat(70));
  console.log(`\nSaídas:`);
  console.log(`  Válidos:   data/validated/grammar/{n5..n1}.json`);
  console.log(`  Rejeitados: data/rejected/grammar/{n5..n1}.json`);
  console.log('═'.repeat(70));
}

main().catch((error: unknown) => {
  console.error('[FASE 28] Erro:', error instanceof Error ? error.message : error);
  process.exit(1);
});
