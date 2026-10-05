/**
 * FASE 10 — Criar o JSON final de produção
 * Consolida dados validados em JSON de produção com versionamento e hash.
 * Exporta para data/production/grammar-{version}.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient, JLPTLevel } from '@prisma/client';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  PRODUCTION_ROOT,
  assertPipelineDirs,
  validatedFile,
} from '../utils';
import type { JlptLevelDir } from '../utils';
import {
  EnrichedGrammarListSchema,
  type EnrichedGrammarRecord,
} from './enriched-schema';
import {
  ProductionDatasetSchema,
  type ProductionDataset,
  type ProductionGrammarRecord,
  type ProductionMetadata,
} from './production-schema';

const prisma = new PrismaClient();
const PIPELINE_VERSION = '1.0.0';

/**
 * Gera hash SHA-256 de um objeto.
 */
function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

interface ExportOptions {
  source: 'validated' | 'database';
  level?: JlptLevelDir;
  version?: string;
  output?: string;
}

function parseArgs(argv: string[]): ExportOptions {
  const opts: ExportOptions = {
    source: 'validated',
    version: '1.0.0',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') {
      const value = argv[++i]?.toLowerCase();
      if (value === 'validated' || value === 'database') {
        opts.source = value;
      }
    } else if (arg === '--level') {
      const value = argv[++i]?.toLowerCase();
      if (value && JLPT_LEVELS.includes(value as JlptLevelDir)) {
        opts.level = value as JlptLevelDir;
      }
    } else if (arg === '--version') {
      opts.version = argv[++i] || '1.0.0';
    } else if (arg === '--output') {
      opts.output = argv[++i];
    }
  }

  return opts;
}

/**
 * Transforma registro enriquecido para formato de produção.
 */
function transformToProduction(
  record: EnrichedGrammarRecord,
): ProductionGrammarRecord {
  return {
    id: record.id,
    sourceId: record.id,
    pattern: record.pattern,
    jlpt: record.jlpt,
    position: record.position,
    title: record.title,
    shortExplanation: record.shortExplanation,
    detailedExplanation: record.detailedExplanation,
    formalityLevel: record.formalityLevel,
    difficulty: record.difficulty,
    tags: record.tags,
    examples: record.examples.map((ex) => ({
      japanese: ex.japanese,
      reading: ex.reading,
      translation: ex.translation,
      furigana: ex.furigana,
      kanjiBreakdown: ex.kanjiBreakdown,
      characterCount: ex.characterCount,
      wordCount: ex.wordCount,
    })),
    patternFurigana: record.patternFurigana,
    patternKanjiBreakdown: record.patternKanjiBreakdown,
    source: record.source,
    enrichedAt: record.enrichmentMetadata.enrichedAt,
    enricherVersion: record.enrichmentMetadata.enricherVersion,
    validatedAt: record.validationMetadata?.validatedAt || new Date().toISOString(),
    contentHash: record.validationMetadata?.contentHash || hashObject(record),
  };
}

/**
 * Exporta dados validados para produção.
 */
async function exportFromValidated(
  opts: ExportOptions,
): Promise<ProductionDataset> {
  const levels = opts.level ? [opts.level] : [...JLPT_LEVELS];
  const allRecords: ProductionGrammarRecord[] = [];
  const levelsExported: string[] = [];

  for (const level of levels) {
    const validatedPath = validatedFile(level);
    if (!fs.existsSync(validatedPath)) {
      console.log(`[WARN] Validado ausente para ${JLPT_LEVEL_LABEL[level]}, pulando...`);
      continue;
    }

    const items = EnrichedGrammarListSchema.parse(
      JSON.parse(fs.readFileSync(validatedPath, 'utf8')),
    );

    const transformed = items.map(transformToProduction);
    allRecords.push(...transformed);
    levelsExported.push(JLPT_LEVEL_LABEL[level]);
  }

  const metadata: ProductionMetadata = {
    version: opts.version || '1.0.0',
    exportedAt: new Date().toISOString(),
    exportSource: 'validated',
    totalRecords: allRecords.length,
    contentHash: '', // Será preenchido após compilação
    pipelineVersion: PIPELINE_VERSION,
    levels: levelsExported as JLPTLevel[],
  };

  return { metadata, data: allRecords };
}

/**
 * Exporta dados do banco de dados para produção.
 */
async function exportFromDatabase(
  opts: ExportOptions,
): Promise<ProductionDataset> {
  const where: any = {};
  if (opts.level) {
    where.jlptLevel = JLPT_LEVEL_LABEL[opts.level] as JLPTLevel;
  }

  const grammarPoints = await prisma.grammarPoint.findMany({
    where,
    include: {
      examples: {
        orderBy: { position: 'asc' },
      },
    },
    orderBy: [{ jlptLevel: 'asc' }, { position: 'asc' }],
  });

  // Transforma dados do banco para formato de produção
  // Nota: Os dados de enriquecimento (furigana, kanji breakdown) não estão no banco
  // Esta é uma exportação básica dos dados principais
  const allRecords: ProductionGrammarRecord[] = grammarPoints.map((gp) => {
    // Normaliza formalityLevel
    const formalityLevel = ['casual', 'neutral', 'formal', 'written'].includes(gp.formalityLevel)
      ? gp.formalityLevel as 'casual' | 'neutral' | 'formal' | 'written'
      : 'neutral';

    // Normaliza contentHash (se vazio, gera hash do conteúdo)
    const contentHash = gp.contentHash || hashObject({
      pattern: gp.pattern,
      title: gp.title,
      shortExplanation: gp.shortExplanation,
    });

    return {
      id: gp.id,
      sourceId: gp.sourceId || undefined,
      pattern: gp.pattern,
      jlpt: gp.jlptLevel,
      position: gp.position,
      title: gp.title,
      shortExplanation: gp.shortExplanation,
      detailedExplanation: gp.detailedExplanation || '',
      formalityLevel,
      difficulty: gp.difficulty,
      tags: gp.tags,
      examples: gp.examples.map((ex) => ({
        japanese: ex.japanese,
        reading: ex.reading || undefined,
        translation: ex.translation,
        furigana: [], // Não disponível no banco
        kanjiBreakdown: { uniqueKanji: [], totalKanjiCount: 0 },
        characterCount: ex.japanese.length,
        wordCount: 1,
      })),
      patternFurigana: [], // Não disponível no banco
      patternKanjiBreakdown: { uniqueKanji: [], totalKanjiCount: 0 },
      source: gp.source || 'database',
      enrichedAt: gp.createdAt.toISOString(),
      enricherVersion: 'N/A',
      validatedAt: gp.reviewedAt?.toISOString() || gp.createdAt.toISOString(),
      contentHash,
    };
  });

  const levelsExported = [
    ...new Set(grammarPoints.map((gp) => gp.jlptLevel)),
  ] as JLPTLevel[];

  const metadata: ProductionMetadata = {
    version: opts.version || '1.0.0',
    exportedAt: new Date().toISOString(),
    exportSource: 'database',
    totalRecords: allRecords.length,
    contentHash: '',
    pipelineVersion: PIPELINE_VERSION,
    levels: levelsExported,
  };

  return { metadata, data: allRecords };
}

async function main(): Promise<void> {
  assertPipelineDirs();
  const opts = parseArgs(process.argv.slice(2));

  console.log('═'.repeat(70));
  console.log('FASE 10 — Criar JSON Final de Produção');
  console.log('═'.repeat(70));
  console.log(`Fonte: ${opts.source}`);
  console.log(`Nível: ${opts.level ? JLPT_LEVEL_LABEL[opts.level] : 'Todos'}`);
  console.log(`Versão: ${opts.version}`);
  console.log('═'.repeat(70));

  let dataset: ProductionDataset;

  if (opts.source === 'validated') {
    dataset = await exportFromValidated(opts);
  } else {
    if (!process.env.DATABASE_URL) {
      console.error('ERRO: DATABASE_URL não está definido no .env');
      process.exit(1);
    }
    dataset = await exportFromDatabase(opts);
  }

  // Calcula hash do conteúdo
  dataset.metadata.contentHash = hashObject(dataset.data);

  // Valida schema
  const validated = ProductionDatasetSchema.parse(dataset);

  // Determina caminho de saída
  const outputFilename = opts.output || `grammar-${opts.version}.json`;
  const outputPath = path.join(PRODUCTION_ROOT, outputFilename);

  // Escreve arquivo
  fs.mkdirSync(PRODUCTION_ROOT, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(validated, null, 2)}\n`, 'utf8');

  console.log('\n✓ Exportação concluída com sucesso');
  console.log(`  Arquivo: ${outputPath}`);
  console.log(`  Registros: ${validated.metadata.totalRecords}`);
  console.log(`  Níveis: ${validated.metadata.levels.join(', ')}`);
  console.log(`  Hash: ${validated.metadata.contentHash}`);
  console.log('═'.repeat(70));

  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error('Erro:', error);
  await prisma.$disconnect();
  process.exit(1);
});
