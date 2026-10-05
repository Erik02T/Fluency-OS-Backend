/**
 * FASE 7 — Seed/Import
 * Importa pontos validados para o PostgreSQL via Prisma.
 * Lê data/validated/{level}.json, mapeia para GrammarPoint/GrammarExample e insere no banco.
 *
 * FASE 13 — Importação por ambiente
 * Adiciona validação de ambiente e safeguards específicos por ambiente.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, JLPTLevel, ReviewStatus } from '@prisma/client';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  assertPipelineDirs,
  validatedFile,
  formatDryRunLog,
  createDryRunContext,
  createDatabaseSnapshot,
  rollbackDatabase,
  listRollbacks,
  type RollbackMetadata,
} from '../utils';
import type { JlptLevelDir } from '../utils';
import {
  EnrichedGrammarListSchema,
  type EnrichedGrammarRecord,
} from './enriched-schema';
import {
  GrammarEnrichmentDataSchema,
  type ImportResult,
} from './import-schema';

const prisma = new PrismaClient();

type Environment = 'development' | 'staging' | 'production';

interface EnvironmentConfig {
  batchSize: number;
  requireConfirmation: boolean;
  allowOverwrite: boolean;
  maxRetries: number;
  timeoutMs: number;
}

const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  development: {
    batchSize: 50,
    requireConfirmation: false,
    allowOverwrite: true,
    maxRetries: 3,
    timeoutMs: 30000,
  },
  staging: {
    batchSize: 100,
    requireConfirmation: true,
    allowOverwrite: false,
    maxRetries: 5,
    timeoutMs: 60000,
  },
  production: {
    batchSize: 200,
    requireConfirmation: true,
    allowOverwrite: false,
    maxRetries: 10,
    timeoutMs: 120000,
  },
};

function getEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}

function validateEnvironment(env: Environment): void {
  if (env === 'production' && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL é obrigatório em produção');
  }

  if (env === 'production' && process.env.DATABASE_URL?.includes('localhost')) {
    throw new Error('DATABASE_URL não deve apontar para localhost em produção');
  }
}

interface CliOptions {
  level?: JlptLevelDir;
  dryRun?: boolean;
  skipExisting?: boolean;
  environment?: Environment;
  force?: boolean;
  rollback?: string;
  listRollbacks?: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { skipExisting: true };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--level') {
      const value = argv[++i]?.toLowerCase();
      if (!value || !JLPT_LEVELS.includes(value as JlptLevelDir)) {
        throw new Error(`--level inválido. Use: ${JLPT_LEVELS.join('|')}`);
      }
      opts.level = value as JlptLevelDir;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--force') {
      opts.skipExisting = false;
      opts.force = true;
    } else if (arg === '--env') {
      const value = argv[++i]?.toLowerCase();
      if (value && ['development', 'staging', 'production'].includes(value)) {
        opts.environment = value as Environment;
      }
    } else if (arg === '--rollback') {
      opts.rollback = argv[++i];
    } else if (arg === '--list-rollbacks') {
      opts.listRollbacks = true;
    }
  }

  return opts;
}

/**
 * Mapeia JLPTLevel do script para enum do Prisma.
 */
function mapJlptLevel(jlpt: string): JLPTLevel {
  const mapping: Record<string, JLPTLevel> = {
    N5: 'N5',
    N4: 'N4',
    N3: 'N3',
    N2: 'N2',
    N1: 'N1',
  };
  const result = mapping[jlpt];
  if (!result) {
    throw new Error(`JLPT level inválido: ${jlpt}`);
  }
  return result;
}

/**
 * Extrai dados de enriquecimento para armazenamento JSON.
 */
function extractEnrichmentData(record: EnrichedGrammarRecord) {
  return {
    metadata: record.enrichmentMetadata,
    furigana: {
      patternFurigana: record.patternFurigana,
      exampleFurigana: record.examples.map((ex) => ex.furigana),
    },
    kanjiBreakdown: {
      patternKanjiBreakdown: record.patternKanjiBreakdown,
      exampleKanjiBreakdown: record.examples.map((ex) => ex.kanjiBreakdown),
    },
  };
}

/**
 * Importa um único registro gramatical.
 */
async function importGrammarRecord(
  record: EnrichedGrammarRecord,
  opts: CliOptions,
  dryRunContext?: ReturnType<typeof createDryRunContext>,
): Promise<ImportResult> {
  const result: ImportResult = {
    id: record.id,
    sourceId: record.id,
    pattern: record.pattern,
    jlptLevel: record.jlpt,
    title: record.title,
    examplesCount: record.examples.length,
    success: false,
  };

  try {
    const jlptLevel = mapJlptLevel(record.jlpt);
    const enrichmentData = extractEnrichmentData(record);

    // Valida estrutura de enriquecimento
    GrammarEnrichmentDataSchema.parse(enrichmentData);

    // Dry-run: simula operação
    if (opts.dryRun) {
      const context = dryRunContext || createDryRunContext('import', record.id.substring(0, 3) as any);
      console.log(formatDryRunLog(context, `Import ${record.id}`));
      console.log(`  ${record.pattern} - ${record.title}`);
      console.log(`  Examples: ${record.examples.length}`);
      result.success = true;
      return result;
    }

    // Verifica se já existe (pelo sourceId)
    if (opts.skipExisting) {
      const existing = await prisma.grammarPoint.findFirst({
        where: { sourceId: record.id },
      });
      if (existing) {
        result.success = true;
        result.error = 'Já existe (skipExisting)';
        return result;
      }
    }

    // Importa em transação
    await prisma.$transaction(async (tx) => {
      // Cria GrammarPoint
      const grammarPoint = await tx.grammarPoint.create({
        data: {
          pattern: record.pattern,
          jlptLevel,
          title: record.title,
          shortExplanation: record.shortExplanation,
          detailedExplanation: record.detailedExplanation,
          formalityLevel: record.formalityLevel,
          difficulty: record.difficulty,
          position: record.position,
          tags: record.tags,
          source: record.source,
          sourceId: record.id,
          contentHash: record.validationMetadata?.contentHash,
          reviewStatus: ReviewStatus.VALIDATED,
          reviewedAt: record.validationMetadata?.validatedAt
            ? new Date(record.validationMetadata.validatedAt)
            : new Date(),
          // Campos de enriquecimento
          enrichmentData: enrichmentData as any, // Prisma.JsonValue
          patternFurigana: record.patternFurigana as any, // Prisma.JsonValue
          patternKanjiBreakdown: record.patternKanjiBreakdown as any, // Prisma.JsonValue
        },
      });

      // Cria GrammarExamples
      for (let i = 0; i < record.examples.length; i++) {
        const ex = record.examples[i];
        await tx.grammarExample.create({
          data: {
            grammarPointId: grammarPoint.id,
            japanese: ex.japanese,
            reading: ex.reading,
            translation: ex.translation,
            position: i,
            isNatural: true,
            // Campos de enriquecimento
            furigana: ex.furigana as any, // Prisma.JsonValue
            kanjiBreakdown: ex.kanjiBreakdown as any, // Prisma.JsonValue
            characterCount: ex.characterCount,
            wordCount: ex.wordCount,
          },
        });
      }
    });

    result.success = true;
    console.log(`  ✓ ${record.id}: ${record.pattern} - ${record.title}`);
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${record.id}: ${result.error}`);
  }

  return result;
}

async function importLevel(
  level: JlptLevelDir,
  opts: CliOptions,
): Promise<{ imported: number; skipped: number; failed: number }> {
  const validatedPath = validatedFile(level);
  if (!fs.existsSync(validatedPath)) {
    throw new Error(
      `Validado ausente: ${validatedPath}. Execute npm run grammar:validate.`,
    );
  }

  const items = EnrichedGrammarListSchema.parse(
    JSON.parse(fs.readFileSync(validatedPath, 'utf8')),
  );

  const results: ImportResult[] = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Cria contexto de dry-run se habilitado
  const dryRunContext = opts.dryRun ? createDryRunContext('import', level) : undefined;

  for (const item of items) {
    const result = await importGrammarRecord(item, opts, dryRunContext);
    results.push(result);

    if (result.success) {
      if (result.error?.includes('Já existe')) {
        skipped += 1;
      } else {
        imported += 1;
      }
    } else {
      failed += 1;
    }
  }

  console.log(
    `✔ ${JLPT_LEVEL_LABEL[level]}: ${imported} importados, ${skipped} pulados, ${failed} falharam`,
  );

  return { imported, skipped, failed };
}

async function main(): Promise<void> {
  assertPipelineDirs();
  const opts = parseArgs(process.argv.slice(2));

  // Lista rollbacks disponíveis
  if (opts.listRollbacks) {
    console.log('[grammar:import] Rollbacks disponíveis:');
    console.log('═'.repeat(70));
    const rollbacks = listRollbacks();
    if (rollbacks.length === 0) {
      console.log('Nenhum rollback disponível');
    } else {
      for (const rb of rollbacks) {
        console.log(`ID: ${rb.id}`);
        console.log(`  Timestamp: ${rb.timestamp}`);
        console.log(`  Fase: ${rb.phase}`);
        console.log(`  Nível: ${rb.level || 'Todos'}`);
        console.log(`  Tipo: ${rb.type}`);
        console.log(`  Status: ${rb.success ? 'Sucesso' : 'Falha'}`);
        if (rb.databaseSnapshot) {
          console.log(`  Registros: ${rb.databaseSnapshot.records}`);
        }
        console.log('─'.repeat(70));
      }
    }
    await prisma.$disconnect();
    return;
  }

  // Executa rollback específico
  if (opts.rollback) {
    console.log(`[grammar:import] Executando rollback: ${opts.rollback}`);
    console.log('═'.repeat(70));
    try {
      const result = await rollbackDatabase(opts.rollback, {
        dryRun: opts.dryRun,
        force: opts.force,
      });
      console.log(`[grammar:import] Rollback concluído: ${result.id}`);
    } catch (error) {
      console.error('[grammar:import] Erro no rollback:', error);
      process.exit(1);
    }
    await prisma.$disconnect();
    return;
  }

  // Determina ambiente
  const environment = opts.environment || getEnvironment();
  const config = ENVIRONMENT_CONFIGS[environment];

  console.log('[grammar:import] Iniciando importação...');
  console.log(`[grammar:import] Ambiente: ${environment}`);
  console.log(`[grammar:import] Dry-run: ${opts.dryRun ? 'SIM' : 'NÃO'}`);
  console.log(`[grammar:import] Skip existing: ${opts.skipExisting ? 'SIM' : 'NÃO'}`);
  console.log(`[grammar:import] Batch size: ${config.batchSize}`);
  console.log(`[grammar:import] Allow overwrite: ${config.allowOverwrite ? 'SIM' : 'NÃO'}`);

  // Valida ambiente
  if (!opts.dryRun) {
    validateEnvironment(environment);
  }

  // Verifica DATABASE_URL (apenas se não for dry-run)
  if (!opts.dryRun && !process.env.DATABASE_URL) {
    console.error('[grammar:import] ERRO: DATABASE_URL não está definido no .env');
    console.error('[grammar:import] Configure DATABASE_URL no .env para importar para o banco de dados');
    console.error('[grammar:import] Use --dry-run para testar sem conectar ao banco');
    process.exit(1);
  }

  // Confirmação em staging/production
  if (config.requireConfirmation && !opts.dryRun && !opts.force) {
    console.error(`[grammar:import] ERRO: Confirmação necessária para ambiente ${environment}`);
    console.error('[grammar:import] Use --force para confirmar a importação');
    process.exit(1);
  }

  // Verifica permissão de overwrite
  if (!config.allowOverwrite && !opts.skipExisting) {
    console.error(`[grammar:import] ERRO: Overwrite não permitido em ambiente ${environment}`);
    console.error('[grammar:import] Use --skip-existing para pular registros existentes');
    process.exit(1);
  }

  // Cria snapshot antes da importação (se não for dry-run)
  let rollbackId: string | undefined;
  if (!opts.dryRun) {
    const levels = opts.level ? [opts.level] : [...JLPT_LEVELS];
    for (const level of levels) {
      const snapshot = await createDatabaseSnapshot('import', level);
      if (snapshot.success) {
        rollbackId = snapshot.id;
        console.log(`[grammar:import] Snapshot criado: ${snapshot.id}`);
      }
    }
  }

  const levels = opts.level ? [opts.level] : [...JLPT_LEVELS];

  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const level of levels) {
    const result = await importLevel(level, opts);
    totalImported += result.imported;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  console.log('[grammar:import] Concluído.');
  console.log(
    `[grammar:import] Total: ${totalImported} importados, ${totalSkipped} pulados, ${totalFailed} falharam`,
  );

  if (rollbackId) {
    console.log(`[grammar:import] Rollback disponível: ${rollbackId}`);
    console.log(`[grammar:import] Use --rollback ${rollbackId} --force para reverter`);
  }

  await prisma.$disconnect();

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(async (error: unknown) => {
  console.error('[grammar:import] Erro:', error);
  await prisma.$disconnect();
  process.exit(1);
});
