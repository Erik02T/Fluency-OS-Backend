import { JLPTLevel, Prisma, PrismaClient, ReviewStatus } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  SEED_GRAMMAR_ROOT,
  VALIDATED_GRAMMAR_ROOT,
  validatedGrammarFile,
  seedGrammarFile,
} from '../scripts/utils';
import type { JlptLevelDir } from '../scripts/utils';

const CHUNK_SIZE = 20;

export interface SeedGrammarExample {
  japanese: string;
  reading?: string;
  translation: string;
  notes?: string;
  isNatural?: boolean;
  position?: number;
  sourceId?: string;
  rankingScore?: number;
  reviewStatus?: string;
  furigana?: unknown;
  kanjiBreakdown?: unknown;
  characterCount?: number;
  wordCount?: number;
}

export interface SeedGrammarRecord {
  id: string;
  pattern: string;
  jlpt: string;
  position: number;
  source?: string;
  sourceId?: string;
  title?: string;
  shortExplanation?: string;
  detailedExplanation?: string;
  formalityLevel?: string;
  difficulty?: number;
  tags?: string[];
  reviewStatus?: string;
  examples: SeedGrammarExample[];
  patternFurigana?: unknown;
  patternKanjiBreakdown?: unknown;
  enrichmentData?: unknown;
  enrichmentMetadata?: unknown;
  validationMetadata?: {
    validatedAt?: string;
    contentHash?: string;
    warnings?: string[];
  };
}

export interface SeedLevelResult {
  level: JlptLevelDir;
  created: number;
  updated: number;
  failed: number;
  loaded: number;
}

export interface SeedGrammarResult {
  totals: { created: number; updated: number; failed: number; loaded: number };
  byLevel: SeedLevelResult[];
}

function normalizeText(value: string): string {
  return value.normalize('NFC').trim();
}

function normalizeOptionalText(value: string | undefined | null): string | undefined {
  if (value == null) return undefined;
  const normalized = String(value).normalize('NFC').trim();
  return normalized.length === 0 ? undefined : normalized;
}

export function loadSeedGrammar(level: JlptLevelDir): SeedGrammarRecord[] {
  const validatedPath = validatedGrammarFile(level);
  const seedPath = seedGrammarFile(level);

  let chosenPath: string | undefined;
  if (fs.existsSync(validatedPath)) {
    chosenPath = validatedPath;
    console.log(`  [Fonte] data/validated/grammar/${level}.json`);
  } else if (fs.existsSync(seedPath)) {
    chosenPath = seedPath;
    console.log(`  [Fonte] seed/grammar/${level}.json (fallback — valide com FASE 28)`);
  } else {
    console.log(`  [WARN] Nenhum arquivo encontrado para ${JLPT_LEVEL_LABEL[level]}`);
    return [];
  }

  try {
    const content = fs.readFileSync(chosenPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`  [ERROR] Falha ao ler ${chosenPath}:`, error);
    return [];
  }
}

function buildGrammarPointUpsertData(
  record: SeedGrammarRecord,
): Prisma.GrammarPointUncheckedCreateInput {
  const pattern = normalizeText(record.pattern);
  const title = normalizeOptionalText(record.title) || pattern;
  const shortExplanation =
    normalizeOptionalText(record.shortExplanation) ||
    `Ponto gramatical ${pattern} (${record.jlpt})`;

  return {
    pattern,
    jlptLevel: record.jlpt as JLPTLevel,
    position: record.position,
    title,
    shortExplanation,
    detailedExplanation: normalizeOptionalText(record.detailedExplanation),
    formalityLevel: normalizeOptionalText(record.formalityLevel) || 'neutral',
    difficulty: record.difficulty ?? 1,
    tags: Array.isArray(record.tags) ? record.tags : [],
    source: normalizeOptionalText(record.source),
    sourceId: normalizeOptionalText(record.sourceId ?? record.id),
    contentHash: record.validationMetadata?.contentHash,
    reviewStatus: ReviewStatus.VALIDATED,
    reviewedAt: record.validationMetadata?.validatedAt
      ? new Date(record.validationMetadata.validatedAt)
      : new Date(),
    enrichmentData: (record.enrichmentData ?? record.enrichmentMetadata) as Prisma.InputJsonValue | undefined,
    patternFurigana: record.patternFurigana as Prisma.InputJsonValue | undefined,
    patternKanjiBreakdown: record.patternKanjiBreakdown as Prisma.InputJsonValue | undefined,
  };
}

async function syncGrammarExamples(
  tx: Prisma.TransactionClient,
  grammarPointId: string,
  examples: SeedGrammarExample[],
): Promise<void> {
  await tx.grammarExample.deleteMany({ where: { grammarPointId } });

  if (examples.length === 0) return;

  const normalizedExamples = examples.map((ex, position) => ({
    grammarPointId,
    japanese: normalizeText(ex.japanese),
    reading: normalizeOptionalText(ex.reading),
    translation: normalizeText(ex.translation || ''),
    notes: normalizeOptionalText(ex.notes),
    isNatural: ex.isNatural ?? true,
    position: ex.position ?? position,
    furigana: ex.furigana as Prisma.InputJsonValue | undefined,
    kanjiBreakdown: ex.kanjiBreakdown as Prisma.InputJsonValue | undefined,
    characterCount: ex.characterCount,
    wordCount: ex.wordCount,
  }));

  await tx.grammarExample.createMany({ data: normalizedExamples });
}

async function seedGrammarRecord(
  tx: Prisma.TransactionClient,
  record: SeedGrammarRecord,
): Promise<'created' | 'updated'> {
  const data = buildGrammarPointUpsertData(record);

  const existing = await tx.grammarPoint.findFirst({
    where: { sourceId: data.sourceId as string } as Prisma.GrammarPointWhereInput,
  });

  let grammarPoint;
  let action: 'created' | 'updated';

  if (existing) {
    grammarPoint = await tx.grammarPoint.update({
      where: { id: existing.id },
      data,
    });
    action = 'updated';
  } else {
    grammarPoint = await tx.grammarPoint.create({ data });
    action = 'created';
  }

  await syncGrammarExamples(tx, grammarPoint.id, record.examples);
  return action;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function seedLevelInternal(
  prisma: PrismaClient,
  level: JlptLevelDir,
): Promise<SeedLevelResult> {
  console.log(`\n[${JLPT_LEVEL_LABEL[level]}] Carregando registros...`);
  const records = loadSeedGrammar(level);
  if (records.length === 0) {
    console.log(`  Nenhum registro para processar`);
    return { level, created: 0, updated: 0, failed: 0, loaded: 0 };
  }
  console.log(`  ${records.length} registros carregados`);

  const chunks = chunkArray(records, CHUNK_SIZE);
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let c = 0; c < chunks.length; c += 1) {
    const chunk = chunks[c];
    try {
      const counts = await prisma.$transaction(async (tx) => {
        let cCreated = 0;
        let cUpdated = 0;
        for (const record of chunk) {
          try {
            const action = await seedGrammarRecord(tx, record);
            if (action === 'created') cCreated += 1;
            else cUpdated += 1;
          } catch (error) {
            const prismaError = error as { code?: string; message?: string };
            if (prismaError.code === 'P2002') {
              throw error;
            }
            console.error(
              `    [ERROR] ${record.id ?? '(sem id)'}: ${
                prismaError.message ?? String(error)
              }`,
            );
            failed += 1;
          }
        }
        return { cCreated, cUpdated };
      });
      created += counts.cCreated;
      updated += counts.cUpdated;
    } catch (error) {
      const prismaError = error as { code?: string; message?: string; meta?: unknown };
      if (prismaError.code === 'P2002') {
        console.warn(
          `  [WARN] Chunk ${c + 1}/${chunks.length}: Restrição única (P2002) detectada. ` +
            `Re-processando item por item...`,
        );
        for (const record of chunk) {
          try {
            await prisma.$transaction(async (tx) => {
              await seedGrammarRecord(tx, record);
            });
          } catch (innerError) {
            const innerPrisma = innerError as { code?: string; message?: string };
            if (innerPrisma.code === 'P2002') {
              console.warn(
                `    [SKIP] ${record.id ?? '(sem id)'}: Registro duplicado já persistido`,
              );
            } else {
              console.error(
                `    [ERROR] ${record.id ?? '(sem id)'}: ${
                  innerPrisma.message ?? String(innerError)
                }`,
              );
            }
            failed += 1;
          }
        }
      } else {
        console.error(
          `  [ERROR] Chunk ${c + 1}/${chunks.length} falhou: ` +
            `${prismaError.message ?? String(error)}`,
        );
        failed += chunk.length;
      }
    }

    const progress = Math.min((c + 1) * CHUNK_SIZE, records.length);
    console.log(
      `  Chunk ${c + 1}/${chunks.length} processado (${progress}/${records.length})`,
    );
  }

  console.log(
    `  Resultado: ${created} criados | ${updated} atualizados | ${failed} falhas`,
  );
  return { level, created, updated, failed, loaded: records.length };
}

export async function seedGrammar(
  prisma: PrismaClient,
  options: { levels?: JlptLevelDir[]; quiet?: boolean } = {},
): Promise<SeedGrammarResult> {
  const levels = options.levels ?? JLPT_LEVELS;
  const byLevel: SeedLevelResult[] = [];

  if (!options.quiet) {
    console.log('═'.repeat(70));
    console.log('Seed Idempotente de Gramática');
    console.log('═'.repeat(70));
    console.log(`Níveis: ${levels.map((l) => JLPT_LEVEL_LABEL[l]).join(', ')}`);
    console.log(`Tamanho do chunk: ${CHUNK_SIZE}`);
    console.log(`Transações: prisma.$transaction + deleteMany/createMany`);
  }

  for (const level of levels) {
    const result = await seedLevelInternal(prisma, level);
    byLevel.push(result);
  }

  const totals = byLevel.reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      updated: acc.updated + r.updated,
      failed: acc.failed + r.failed,
      loaded: acc.loaded + r.loaded,
    }),
    { created: 0, updated: 0, failed: 0, loaded: 0 },
  );

  if (!options.quiet) {
    console.log('\n' + '═'.repeat(70));
    console.log('RESUMO — GRAMÁTICA');
    console.log('═'.repeat(70));
    console.log(`Carregados:  ${totals.loaded}`);
    console.log(`Criados:     ${totals.created}`);
    console.log(`Atualizados: ${totals.updated}`);
    console.log(`Falhas:      ${totals.failed}`);
    console.log(
      `Processados: ${totals.created + totals.updated} de ${
        totals.created + totals.updated + totals.failed
      }`,
    );
    console.log('═'.repeat(70));
  }

  return { totals, byLevel };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedGrammar(prisma)
    .catch((error) => {
      console.error('Erro no seed de gramática:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
