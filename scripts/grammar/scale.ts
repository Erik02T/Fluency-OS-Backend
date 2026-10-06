/**
 * FASE 8 — Escala N5→N1
 * Orquestra o pipeline completo para múltiplos níveis JLPT.
 * Executa: extract → normalize → generate → enrich → validate → import
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  assertPipelineDirs,
  formatDryRunLog,
  createDryRunContext,
} from '../utils';
import type { JlptLevelDir } from '../utils';

const execAsync = promisify(exec);

interface PipelinePhase {
  name: string;
  script: string;
  description: string;
}

const PIPELINE_PHASES: PipelinePhase[] = [
  {
    name: 'extract',
    script: 'npm run grammar:extract',
    description: 'Extração de dados brutos dos PDFs Tanos',
  },
  {
    name: 'normalize',
    script: 'npm run grammar:normalize',
    description: 'Normalização e padronização dos patterns',
  },
  {
    name: 'generate',
    script: 'npm run grammar:generate',
    description: 'Geração de conteúdo via LLM',
  },
  {
    name: 'enrich',
    script: 'npm run grammar:enrich',
    description: 'Enriquecimento com furigana e metadados',
  },
  {
    name: 'validate',
    script: 'npm run grammar:validate',
    description: 'Validação de qualidade e hashes',
  },
  {
    name: 'import',
    script: 'npm run grammar:import',
    description: 'Importação para PostgreSQL via Prisma',
  },
];

interface ScaleOptions {
  levels: JlptLevelDir[];
  phases: string[];
  parallel: boolean;
  dryRun: boolean;
  stopOnError: boolean;
}

function parseArgs(argv: string[]): ScaleOptions {
  const opts: ScaleOptions = {
    levels: [...JLPT_LEVELS],
    phases: PIPELINE_PHASES.map((p) => p.name),
    parallel: false,
    dryRun: false,
    stopOnError: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--level') {
      const value = argv[++i]?.toLowerCase();
      if (!value || !JLPT_LEVELS.includes(value as JlptLevelDir)) {
        throw new Error(`--level inválido. Use: ${JLPT_LEVELS.join('|')}`);
      }
      opts.levels = [value as JlptLevelDir];
    } else if (arg === '--levels') {
      const values = argv[++i]?.toLowerCase().split(',') || [];
      const validLevels = values.filter((v) =>
        JLPT_LEVELS.includes(v as JlptLevelDir),
      );
      if (validLevels.length === 0) {
        throw new Error(`--levels inválido. Use: ${JLPT_LEVELS.join(',')}`);
      }
      opts.levels = validLevels as JlptLevelDir[];
    } else if (arg === '--phase') {
      const value = argv[++i]?.toLowerCase();
      const validPhase = PIPELINE_PHASES.find((p) => p.name === value);
      if (!validPhase) {
        throw new Error(
          `--phase inválido. Use: ${PIPELINE_PHASES.map((p) => p.name).join('|')}`,
        );
      }
      opts.phases = [value];
    } else if (arg === '--phases') {
      const values = argv[++i]?.toLowerCase().split(',') || [];
      const validPhases = values.filter((v) =>
        PIPELINE_PHASES.some((p) => p.name === v),
      );
      if (validPhases.length === 0) {
        throw new Error(
          `--phases inválido. Use: ${PIPELINE_PHASES.map((p) => p.name).join(',')}`,
        );
      }
      opts.phases = validPhases;
    } else if (arg === '--parallel') {
      opts.parallel = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--continue-on-error') {
      opts.stopOnError = false;
    }
  }

  return opts;
}

/**
 * Executa um comando de fase do pipeline.
 */
async function runPhase(
  phase: PipelinePhase,
  level: JlptLevelDir,
  opts: ScaleOptions,
): Promise<{ success: boolean; output: string; error: string }> {
  const command = `${phase.script} --level ${level}`;

  if (opts.dryRun) {
    const context = createDryRunContext(phase.name, level);
    console.log(formatDryRunLog(context, command));
    return { success: true, output: '', error: '' };
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
    });
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return {
      success: false,
      output: err.stdout || '',
      error: err.stderr || err.message || 'Unknown error',
    };
  }
}

/**
 * Executa pipeline sequencialmente para um nível.
 */
async function runPipelineForLevel(
  level: JlptLevelDir,
  opts: ScaleOptions,
): Promise<{ level: string; total: number; success: number; failed: number }> {
  console.log(`\n[${JLPT_LEVEL_LABEL[level]}] Iniciando pipeline...`);

  let success = 0;
  let failed = 0;

  for (const phase of PIPELINE_PHASES) {
    if (!opts.phases.includes(phase.name)) {
      continue;
    }

    console.log(`  [${phase.name}] ${phase.description}...`);
    const result = await runPhase(phase, level, opts);

    if (result.success) {
      success += 1;
      console.log(`  ✓ ${phase.name} concluído`);
    } else {
      failed += 1;
      console.log(`  ✗ ${phase.name} falhou: ${result.error}`);
      if (opts.stopOnError) {
        break;
      }
    }
  }

  console.log(
    `[${JLPT_LEVEL_LABEL[level]}] Concluído: ${success} fases, ${failed} falhas`,
  );

  return { level: JLPT_LEVEL_LABEL[level], total: opts.phases.length, success, failed };
}

/**
 * Executa pipeline para múltiplos níveis em paralelo.
 */
async function runPipelineParallel(
  levels: JlptLevelDir[],
  opts: ScaleOptions,
): Promise<Array<{ level: string; total: number; success: number; failed: number }>> {
  console.log('\n[SCALE] Executando pipeline em paralelo...');

  const promises = levels.map((level) => runPipelineForLevel(level, opts));
  return Promise.all(promises);
}

/**
 * Executa pipeline para múltiplos níveis sequencialmente.
 */
async function runPipelineSequential(
  levels: JlptLevelDir[],
  opts: ScaleOptions,
): Promise<Array<{ level: string; total: number; success: number; failed: number }>> {
  console.log('\n[SCALE] Executando pipeline sequencialmente...');

  const results: Array<{
    level: string;
    total: number;
    success: number;
    failed: number;
  }> = [];

  for (const level of levels) {
    const result = await runPipelineForLevel(level, opts);
    results.push(result);
  }

  return results;
}

async function main(): Promise<void> {
  assertPipelineDirs();
  const opts = parseArgs(process.argv.slice(2));

  console.log('═'.repeat(60));
  console.log('FASE 8 — Escala N5→N1');
  console.log('═'.repeat(60));
  console.log(`Níveis: ${opts.levels.map((l) => JLPT_LEVEL_LABEL[l]).join(', ')}`);
  console.log(`Fases: ${opts.phases.join(', ')}`);
  console.log(`Modo: ${opts.parallel ? 'Paralelo' : 'Sequencial'}`);
  console.log(`Dry-run: ${opts.dryRun ? 'SIM' : 'NÃO'}`);
  console.log(`Parar em erro: ${opts.stopOnError ? 'SIM' : 'NÃO'}`);
  console.log('═'.repeat(60));

  const results = opts.parallel
    ? await runPipelineParallel(opts.levels, opts)
    : await runPipelineSequential(opts.levels, opts);

  console.log('\n' + '═'.repeat(60));
  console.log('[SCALE] Resumo');
  console.log('═'.repeat(60));

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const result of results) {
    console.log(
      `${result.level}: ${result.success}/${result.total} fases concluídas`,
    );
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  console.log('─'.repeat(60));
  console.log(`Total: ${totalSuccess} fases concluídas, ${totalFailed} falhas`);
  console.log('═'.repeat(60));

  if (totalFailed > 0 && opts.stopOnError) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('[SCALE] Erro:', error);
  process.exit(1);
});
