/**
 * FASE 27 — Estruturar GrammarPoint
 *
 * Junta:
 *   Pattern (de readings)  +  JLPT  +  Position  +  Examples  +  Reading
 *
 * E gera a estrutura consolidada.
 *
 * Regras:
 *   - Não inventar dados para: title, shortExplanation, detailedExplanation, translation, tags
 *   - Campos ausentes → "PENDING"  (ou [] para array)
 *   - Normalização Unicode NFC OBRIGATÓRIA em todos os textos japoneses
 *   - Idempotente: pode ser executado múltiplas vezes
 *   - Validação Zod ANTES de persistir (após de gravar)
 *
 * Entrada: data/processed/sentences/readings/{n5..n1}.json
 *   (contêm pattern + jlpt + position + source + examples[com reading calculado na FASE 26.6]
 *
 * Saída:   seed/grammar/{n5..n1}.json
 *           data/generated/{n5..n1}.json
 *   (formato compatível com seed-grammar.ts e pipeline enrich.ts)
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  SEED_GRAMMAR_ROOT,
  GENERATED_ROOT,
  REJECTED_ROOT,
  assertPipelineDirs,
  readingsFile,
  readingFailuresFile,
  seedGrammarFile,
  generatedFile,
  translationCacheFile,
} from '../utils';
import type { JlptLevelDir } from '../utils';
import {
  StructuredGrammarPointListSchema,
  StructuredGrammarPointSchema,
  type StructuredGrammarPoint,
  type StructuredExample,
} from './structured-schema';

const PENDING = 'PENDING';

interface CliOptions {
  level?: JlptLevelDir;
  limit?: number;
  id?: string;
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
    } else if (arg === '--limit') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('--limit deve ser inteiro >= 1');
      }
      opts.limit = value;
    } else if (arg === '--id') {
      opts.id = argv[++i];
      if (!opts.id) throw new Error('--id requer valor (ex: N5-014)');
    }
  }
  return opts;
}

/**
 * Normaliza texto japonês para Unicode NFC.
 * Regra do projeto: evita duplicatas falsas por variação de codepoint.
 */
function nfc(value: string): string {
  return value.normalize('NFC').trim();
}

/**
 * Carrega o cache de traduções, se existir.
 * Chave: `${grammarPointId}:${sourceId}`
 */
function loadTranslationCache(
  level: JlptLevelDir,
): Map<string, string> {
  const cacheFile = translationCacheFile(level);
  if (!fs.existsSync(cacheFile)) {
    return new Map();
  }

  try {
    const entries = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Array<{
      grammarPointId: string;
      sourceId: string;
      translation: string;
    }>;

    const map = new Map<string, string>();
    for (const e of entries) {
      if (e.grammarPointId && e.sourceId && e.translation) {
        const key = `${e.grammarPointId}:${e.sourceId}`;
        map.set(key, e.translation);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Carrega e valida o arquivo de readings (entrada da FASE 27.
 */
function loadReadingsInput(
  level: JlptLevelDir,
): Array<{
  id: string;
  pattern: string;
  jlpt: string;
  position: number;
  source: string;
  reviewStatus?: string;
  examples: Array<{
    sourceId?: string;
    japanese: string;
    reading?: string;
    rankingScore?: number;
    reviewStatus?: string;
  }>;
}> {
  const inputPath = readingsFile(level);

  if (!fs.existsSync(inputPath)) {
    throw new Error(
      `Readings ausente: ${inputPath}. Execute npm run grammar:generate-readings antes.`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`Formato inválido em ${inputPath}: esperado array`);
  }

  return raw;
}

/**
 * Estrutura um exemplo: une japonês + reading + tradução do cache.
 */
function buildExample(
  grammarPointId: string,
  rawEx: {
    sourceId?: string;
    japanese: string;
    reading?: string;
    rankingScore?: number;
    reviewStatus?: string;
  },
  translationCache: Map<string, string>,
  position: number,
): StructuredExample {
  const cacheKey = `${grammarPointId}:${rawEx.sourceId ?? ''}`;
  const cachedTranslation = rawEx.sourceId ? translationCache.get(cacheKey) : undefined;
  const japanese = nfc(rawEx.japanese);
  const reading = rawEx.reading ? nfc(rawEx.reading) : undefined;
  const translation = cachedTranslation ? nfc(cachedTranslation) : PENDING;

  return {
    japanese,
    reading: reading && reading.length > 0 ? reading : undefined,
    translation,
    sourceId: rawEx.sourceId,
    rankingScore: rawEx.rankingScore,
    reviewStatus: (rawEx.reviewStatus as StructuredExample['reviewStatus']) ?? 'PENDING',
    position,
  };
}

/**
 * Estrutura um GrammarPoint: Pattern + JLPT + Position + Examples + Reading
 */
function buildGrammarPoint(
  raw: {
    id: string;
    pattern: string;
    jlpt: string;
    position: number;
    source: string;
    reviewStatus?: string;
    examples: Array<any>;
  },
  translationCache: Map<string, string>,
): StructuredGrammarPoint {
  const pattern = nfc(raw.pattern);

  const examples = raw.examples.map((ex, idx) =>
    buildExample(raw.id, ex, translationCache, idx),
  );

  return {
    id: raw.id,
    pattern,
    jlpt: raw.jlpt as StructuredGrammarPoint['jlpt'],
    position: Number(raw.position),
    source: raw.source,
    sourceId: raw.id,

    title: PENDING,
    shortExplanation: PENDING,
    detailedExplanation: PENDING,
    formalityLevel: 'neutral',
    difficulty: 1,
    tags: [],
    reviewStatus: (raw.reviewStatus as StructuredGrammarPoint['reviewStatus']) ?? 'PENDING',

    examples,
  };
}

/**
 * Verifica e reporta rejeições da FASE 27.
 */
interface Rejection {
  id?: string;
  pattern?: string;
  reason: string;
}

/**
 * Processa um nível JLPT.
 */
function processLevel(
  level: JlptLevelDir,
  opts: CliOptions,
): {
  built: StructuredGrammarPoint[];
  rejected: Rejection[];
} {
  const input = loadReadingsInput(level);
  const translationCache = loadTranslationCache(level);

  let items = input;
  if (opts.id) {
    items = items.filter((it) => it.id === opts.id);
  }
  if (opts.limit !== undefined) {
    items = items.slice(0, opts.limit);
  }

  const built: StructuredGrammarPoint[] = [];
  const rejected: Rejection[] = [];

  for (const raw of items) {
    try {
      const structured = buildGrammarPoint(raw, translationCache);

      // Valida individualmente cada registro
      const parsed = StructuredGrammarPointSchema.parse(structured);

      // Regras adicionais FASE 27:
      // - Examples não podem ter japonês vazio
      // - Reading vazio é permitido apenas se não for possível (registrado em failures)
      // - Não pode haver duplicação de pattern no mesmo nível
      const hasEmptyExample = parsed.examples.some((ex) => !ex.japanese || ex.japanese.trim().length === 0);
      if (hasEmptyExample) {
        throw new Error('Exemplo com japonês vazio');
      }

      built.push(parsed);
    } catch (err) {
      rejected.push({
        id: raw.id,
        pattern: raw.pattern,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { built, rejected };
}

/**
 * Garante que não há patterns duplicados em um array.
 */
function assertNoDuplicatePatterns(items: StructuredGrammarPoint[]): void {
  const seen = new Map<string, string>();
  for (const it of items) {
    const key = it.pattern;
    if (seen.has(key)) {
      throw new Error(
        `Pattern duplicado: "${key}" em ${it.id} e ${seen.get(key)}`,
      );
    }
    seen.set(key, it.id);
  }
}

/**
 * Carrega falhas de reading do arquivo auxiliar failures.
 */
function loadReadingFailures(level: JlptLevelDir): number {
  const f = readingFailuresFile(level);
  if (!fs.existsSync(f)) return 0;
  try {
    const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Executa a FASE 27 para um nível.
 */
function structureLevel(
  level: JlptLevelDir,
  opts: CliOptions,
): { written: number; rejected: number; readingFailures: number; translationHits: number; translationMisses: number } {
  const { built, rejected } = processLevel(level, opts);
  const readingFailures = loadReadingFailures(level);

  // Verifica duplicatas ANTES de escrever
  assertNoDuplicatePatterns(built);

  // Valida o dataset completo com Zod (inclui todas as regras do schema)
  const validatedList = StructuredGrammarPointListSchema.parse(built);

  // Ordena por position (garante reprodutibilidade)
  validatedList.sort((a, b) => a.position - b.position);

  const jsonOutput = JSON.stringify(validatedList, null, 2) + '\n';

  // 1. Escreve em seed/grammar/{level}.json (entrada do seed-grammar.ts)
  const seedPath = seedGrammarFile(level);
  fs.mkdirSync(path.dirname(seedPath), { recursive: true });
  fs.writeFileSync(seedPath, jsonOutput, 'utf8');

  // 2. Escreve em data/generated/{level}.json (entrada do enrich.ts da FASE 6)
  const genPath = generatedFile(level);
  fs.mkdirSync(path.dirname(genPath), { recursive: true });
  fs.writeFileSync(genPath, jsonOutput, 'utf8');

  // 3. Grava rejeições, se houver
  if (rejected.length > 0) {
    const rejectedPath = path.join(REJECTED_ROOT, `${level}-structured.json`);
    fs.mkdirSync(path.dirname(rejectedPath), { recursive: true });
    fs.writeFileSync(
      rejectedPath,
      JSON.stringify(rejected, null, 2) + '\n',
      'utf8',
    );
  }

  // Estatísticas de tradução
  let translationHits = 0;
  let translationMisses = 0;
  for (const gp of validatedList) {
    for (const ex of gp.examples) {
      if (ex.translation === PENDING) {
        translationMisses += 1;
      } else {
        translationHits += 1;
      }
    }
  }

  console.log(
    `✔ ${JLPT_LEVEL_LABEL[level]}: ${validatedList.length} estruturados, ${rejected.length} rejeitados, ${readingFailures} reading failures, ${translationHits} traduções / ${translationMisses} PENDING`,
  );

  return {
    written: validatedList.length,
    rejected: rejected.length,
    readingFailures,
    translationHits,
    translationMisses,
  };
}

async function main(): Promise<void> {
  assertPipelineDirs();
  const opts = parseArgs(process.argv.slice(2));

  console.log('═'.repeat(70));
  console.log('FASE 27 — Estruturar GrammarPoint');
  console.log('═'.repeat(70));
  console.log('  · Junta: Pattern + JLPT + Position + Examples + Reading');
  console.log('  · Campos não confirmados → PENDING (title/shortExplanation/detailedExplanation/translation/tags)');
  console.log('  · Normalização: Unicode NFC');
  console.log('');

  const levels = opts.level ? [opts.level] : [...JLPT_LEVELS];

  const totals = {
    written: 0,
    rejected: 0,
    readingFailures: 0,
    translationHits: 0,
    translationMisses: 0,
  };

  for (const level of levels) {
    if (opts.id && !opts.id.toUpperCase().startsWith(JLPT_LEVEL_LABEL[level])) {
      continue;
    }
    const r = structureLevel(level, opts);
    totals.written += r.written;
    totals.rejected += r.rejected;
    totals.readingFailures += r.readingFailures;
    totals.translationHits += r.translationHits;
    totals.translationMisses += r.translationMisses;
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('RESUMO FASE 27');
  console.log('═'.repeat(70));
  console.log(`GrammarPoints estruturados : ${totals.written}`);
  console.log(`Rejeitados               : ${totals.rejected}`);
  console.log(`Reading failures (FASE 26) : ${totals.readingFailures}`);
  console.log(`Traduções em cache       : ${totals.translationHits}`);
  console.log(`Traduções PENDING        : ${totals.translationMisses}`);
  console.log(`Saídas: seed/grammar/*.json e data/generated/*.json`);
  console.log('═'.repeat(70));
}

main().catch((error: unknown) => {
  console.error('[grammar:structure] Erro:', error);
  process.exit(1);
});
