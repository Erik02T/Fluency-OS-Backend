/**
 * FASE 6 — Validação/QA
 * Valida schema Zod, hashes e regras de qualidade para dados enriquecidos.
 * Lê data/enriched/{level}.json, valida com Zod e grava data/validated/{level}.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  REJECTED_ROOT,
  VALIDATED_ROOT,
  assertPipelineDirs,
  enrichedFile,
  validatedFile,
} from '../utils';
import type { JlptLevelDir } from '../utils';
import {
  EnrichedGrammarListSchema,
  type EnrichedGrammarRecord,
  ValidationMetadataSchema,
} from './enriched-schema';

interface CliOptions {
  level?: JlptLevelDir;
  fix?: boolean;
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
    } else if (arg === '--fix') {
      opts.fix = true;
    }
  }

  return opts;
}

/**
 * Gera hash SHA-256 de um objeto JSON.
 */
function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Validações de qualidade específicas para gramática enriquecida.
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateQuality(record: EnrichedGrammarRecord): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Valida furigana
  if (record.patternFurigana.length === 0) {
    errors.push('patternFurigana está vazio');
  }

  // Valida exemplos
  if (record.examples.length < 3) {
    errors.push('Deve ter pelo menos 3 exemplos');
  }

  for (let i = 0; i < record.examples.length; i++) {
    const ex = record.examples[i];
    if (ex.furigana.length === 0) {
      errors.push(`Exemplo ${i + 1}: furigana está vazio`);
    }
    if (ex.characterCount !== ex.japanese.length) {
      errors.push(`Exemplo ${i + 1}: characterCount não coincide com comprimento do texto`);
    }
    if (ex.wordCount < 1) {
      errors.push(`Exemplo ${i + 1}: wordCount deve ser >= 1`);
    }
  }

  // Valida metadados
  if (!record.enrichmentMetadata.enrichedAt) {
    errors.push('enrichmentMetadata.enrichedAt está ausente');
  }
  if (!record.enrichmentMetadata.enricherVersion) {
    errors.push('enrichmentMetadata.enricherVersion está ausente');
  }

  // Warnings (não bloqueantes)
  if (record.patternKanjiBreakdown.totalKanjiCount === 0) {
    warnings.push('pattern não contém kanji');
  }

  // Verifica se readings de kanji estão vazios (placeholder)
  const emptyReadings = record.patternKanjiBreakdown.uniqueKanji.filter(
    (k) => !k.reading,
  ).length;
  if (emptyReadings > 0) {
    warnings.push(`${emptyReadings} kanji sem reading (placeholder KANJIDIC)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

async function validateLevel(
  level: JlptLevelDir,
  opts: CliOptions,
): Promise<{ passed: number; failed: number; warnings: number }> {
  const enrichedPath = enrichedFile(level);
  if (!fs.existsSync(enrichedPath)) {
    throw new Error(
      `Enriquecido ausente: ${enrichedPath}. Execute npm run grammar:enrich.`,
    );
  }

  let items = EnrichedGrammarListSchema.parse(
    JSON.parse(fs.readFileSync(enrichedPath, 'utf8')),
  );

  const passed: EnrichedGrammarRecord[] = [];
  const failed: unknown[] = [];
  let warningCount = 0;

  for (const item of items) {
    const quality = validateQuality(item);

    if (quality.valid) {
      const hash = hashObject(item);
      const validatedItem = {
        ...item,
        validationMetadata: ValidationMetadataSchema.parse({
          validatedAt: new Date().toISOString(),
          contentHash: hash,
          warnings: quality.warnings,
        }),
      };
      passed.push(validatedItem);
      warningCount += quality.warnings.length;
    } else {
      failed.push({
        id: item.id,
        pattern: item.pattern,
        jlpt: item.jlpt,
        errors: quality.errors,
        warnings: quality.warnings,
      });
      console.log(`  ✗ ${item.id}: ${quality.errors.join(', ')}`);
    }
  }

  if (passed.length > 0) {
    const validatedPath = validatedFile(level);
    fs.mkdirSync(path.dirname(validatedPath), { recursive: true });
    fs.writeFileSync(
      validatedPath,
      `${JSON.stringify(passed, null, 2)}\n`,
      'utf8',
    );
  }

  if (failed.length > 0) {
    const rejectedFile = path.join(REJECTED_ROOT, `${level}-validate.json`);
    fs.writeFileSync(
      rejectedFile,
      `${JSON.stringify(failed, null, 2)}\n`,
      'utf8',
    );
  }

  console.log(
    `✔ ${JLPT_LEVEL_LABEL[level]}: ${passed.length} passaram, ${failed.length} falharam, ${warningCount} avisos`,
  );

  return { passed: passed.length, failed: failed.length, warnings: warningCount };
}

async function main(): Promise<void> {
  assertPipelineDirs();
  const opts = parseArgs(process.argv.slice(2));

  console.log('[grammar:validate] Iniciando validação...');
  console.log('[grammar:validate] Schema: Zod + quality checks');

  const levels = opts.level ? [opts.level] : [...JLPT_LEVELS];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;

  for (const level of levels) {
    const result = await validateLevel(level, opts);
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalWarnings += result.warnings;
  }

  console.log('[grammar:validate] Concluído.');
  console.log(`[grammar:validate] Total: ${totalPassed} passaram, ${totalFailed} falharam, ${totalWarnings} avisos`);

  if (totalFailed > 0 && !opts.fix) {
    console.log('[grammar:validate] Use --fix para tentar corrigir problemas automaticamente (não implementado nesta fase)');
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('[grammar:validate] Erro:', error);
  process.exit(1);
});
