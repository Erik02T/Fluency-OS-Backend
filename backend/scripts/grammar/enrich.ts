/**
 * FASE 6 — Enriquecimento
 * Enriquece dados gerados com furigana (Kuroshiro), breakdown de kanji e metadados.
 * Lê data/generated/{level}.json, processa com Kuroshiro e grava data/enriched/{level}.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import Kuroshiro from 'kuroshiro';
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';
import {
  JLPT_LEVELS,
  JLPT_LEVEL_LABEL,
  REJECTED_ROOT,
  ENRICHED_ROOT,
  assertPipelineDirs,
  generatedFile,
  enrichedFile,
} from '../utils';
import type { JlptLevelDir } from '../utils';
import {
  EnrichedGrammarListSchema,
  EnrichedGrammarRecordSchema,
  type EnrichedGrammarRecord,
  type FuriganaSegment,
  type KanjiInfo,
  type KanjiBreakdown,
  type EnrichedExample,
} from './enriched-schema';
import {
  GeneratedGrammarListSchema,
  type GeneratedGrammarRecord,
} from './generated-schema';

const ENRICHER_VERSION = '1.0.0';

interface CliOptions {
  level?: JlptLevelDir;
  limit?: number;
  force: boolean;
  id?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { force: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') opts.force = true;
    else if (arg === '--level') {
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
 * Inicializa Kuroshiro com analyzer Kuromoji.
 * Lazy initialization para evitar carregar o dicionário desnecessariamente.
 */
let kuroshiroInstance: Kuroshiro | null = null;

async function getKuroshiro(): Promise<Kuroshiro> {
  if (!kuroshiroInstance) {
    const analyzer = new KuromojiAnalyzer();
    kuroshiroInstance = new Kuroshiro();
    await kuroshiroInstance.init(analyzer);
  }
  return kuroshiroInstance;
}

/**
 * Converte texto japonês em segmentos de furigana usando Kuroshiro.
 */
async function convertToFurigana(
  text: string,
  kuroshiro: Kuroshiro,
): Promise<FuriganaSegment[]> {
  const result = await kuroshiro.convert(text, { mode: 'furigana' });

  // Parse do formato HTML de furigana do Kuroshiro
  // Formato: <ruby>漢字<rp>(</rp><rt>かんじ</rt><rp>)</rp></ruby>
  const segments: FuriganaSegment[] = [];
  const regex = /<ruby>([^<]+)<rp>\(<\/rp><rt>([^<]+)<\/rt><rp>\)<\/rp><\/ruby>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(result)) !== null) {
    // Adiciona texto antes do ruby
    if (match.index > lastIndex) {
      const plainText = result.slice(lastIndex, match.index);
      if (plainText.trim()) {
        segments.push({ text: plainText, reading: plainText });
      }
    }

    segments.push({ text: match[1], reading: match[2] });
    lastIndex = regex.lastIndex;
  }

  // Adiciona texto restante
  if (lastIndex < result.length) {
    const plainText = result.slice(lastIndex);
    if (plainText.trim()) {
      segments.push({ text: plainText, reading: plainText });
    }
  }

  return segments;
}

/**
 * Extrai kanji únicos de um texto.
 */
function extractKanji(text: string): string[] {
  const kanjiRegex = /[\u4e00-\u9faf]/g;
  const matches = text.match(kanjiRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Cria breakdown de kanji (placeholder - futura integração com KANJIDIC).
 */
function createKanjiBreakdown(text: string): KanjiBreakdown {
  const uniqueKanji = extractKanji(text);
  const kanjiInfo: KanjiInfo[] = uniqueKanji.map((char) => ({
    character: char,
    reading: undefined, // Placeholder - seria preenchido via KANJIDIC em versão futura
    meaning: undefined,
    jlpt: undefined,
  }));

  return {
    uniqueKanji: kanjiInfo,
    totalKanjiCount: (text.match(/[\u4e00-\u9faf]/g) || []).length,
  };
}

/**
 * Conta palavras japonesas (aproximação via segmentação).
 */
function countJapaneseWords(text: string): number {
  // Aproximação: conta segmentos separados por espaços ou partículas
  // Para maior precisão, usaríamos o tokenizer do Kuromoji
  const segments = text.split(/[\s\u3000]+/).filter((s) => s.trim());
  return segments.length;
}

/**
 * Enriquece um exemplo gramatical.
 */
async function enrichExample(
  example: { japanese: string; reading?: string; translation: string },
  kuroshiro: Kuroshiro,
): Promise<EnrichedExample> {
  const furigana = await convertToFurigana(example.japanese, kuroshiro);
  const kanjiBreakdown = createKanjiBreakdown(example.japanese);
  const characterCount = example.japanese.length;
  const wordCount = countJapaneseWords(example.japanese);

  return {
    japanese: example.japanese,
    reading: example.reading,
    translation: example.translation,
    furigana,
    kanjiBreakdown,
    characterCount,
    wordCount,
  };
}

/**
 * Enriquece um registro gramatical completo.
 */
async function enrichGrammarRecord(
  record: GeneratedGrammarRecord,
  kuroshiro: Kuroshiro,
): Promise<EnrichedGrammarRecord> {
  const patternFurigana = await convertToFurigana(record.pattern, kuroshiro);
  const patternKanjiBreakdown = createKanjiBreakdown(record.pattern);

  const enrichedExamples = await Promise.all(
    record.examples.map((ex) => enrichExample(ex, kuroshiro)),
  );

  const totalUniqueKanji = new Set<string>();
  enrichedExamples.forEach((ex) => {
    ex.kanjiBreakdown.uniqueKanji.forEach((k) => totalUniqueKanji.add(k.character));
  });
  patternKanjiBreakdown.uniqueKanji.forEach((k) =>
    totalUniqueKanji.add(k.character),
  );

  return {
    ...record,
    patternFurigana,
    patternKanjiBreakdown,
    examples: enrichedExamples,
    enrichmentMetadata: {
      enrichedAt: new Date().toISOString(),
      enricherVersion: ENRICHER_VERSION,
      totalUniqueKanji: totalUniqueKanji.size,
    },
  };
}

async function enrichLevel(
  level: JlptLevelDir,
  opts: CliOptions,
): Promise<{ written: number; skipped: number; rejected: number }> {
  const generatedPath = generatedFile(level);
  if (!fs.existsSync(generatedPath)) {
    throw new Error(
      `Gerado ausente: ${generatedPath}. Execute npm run grammar:generate.`,
    );
  }

  let items = GeneratedGrammarListSchema.parse(
    JSON.parse(fs.readFileSync(generatedPath, 'utf8')),
  );

  if (opts.id) {
    items = items.filter((item) => item.id === opts.id);
  }
  if (opts.limit !== undefined) {
    items = items.slice(0, opts.limit);
  }

  const enrichedPath = enrichedFile(level);
  const existing: EnrichedGrammarRecord[] = fs.existsSync(enrichedPath)
    ? EnrichedGrammarListSchema.parse(
        JSON.parse(fs.readFileSync(enrichedPath, 'utf8')),
      )
    : [];

  const byId = new Map(existing.map((item) => [item.id, item]));
  const rejected: unknown[] = [];

  let written = 0;
  let skipped = 0;

  const kuroshiro = await getKuroshiro();

  for (const item of items) {
    if (!opts.force && byId.has(item.id)) {
      skipped += 1;
      continue;
    }

    try {
      const enriched = await enrichGrammarRecord(item, kuroshiro);
      byId.set(item.id, enriched);
      written += 1;
      console.log(`  · ${item.id} enriquecido`);
    } catch (error) {
      rejected.push({
        id: item.id,
        pattern: item.pattern,
        jlpt: item.jlpt,
        rejectReason: error instanceof Error ? error.message : String(error),
      });
      console.log(
        `  · ${item.id} rejeitado: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  const merged = [...byId.values()].sort((a, b) => a.position - b.position);
  const validated = EnrichedGrammarListSchema.parse(merged);

  fs.mkdirSync(path.dirname(enrichedPath), { recursive: true });
  fs.writeFileSync(
    enrichedPath,
    `${JSON.stringify(validated, null, 2)}\n`,
    'utf8',
  );

  if (rejected.length > 0) {
    const rejectedFile = path.join(REJECTED_ROOT, `${level}-enrich.json`);
    fs.writeFileSync(
      rejectedFile,
      `${JSON.stringify(rejected, null, 2)}\n`,
      'utf8',
    );
  }

  console.log(
    `✔ ${JLPT_LEVEL_LABEL[level]}: ${written} enriquecidos, ${skipped} preservados, ${rejected.length} rejeitados`,
  );

  return { written, skipped, rejected: rejected.length };
}

async function main(): Promise<void> {
  assertPipelineDirs();
  const opts = parseArgs(process.argv.slice(2));

  console.log('[grammar:enrich] Iniciando enriquecimento...');
  console.log('[grammar:enrich] Provider: Kuroshiro + Kuromoji');

  const levels = opts.level ? [opts.level] : [...JLPT_LEVELS];

  for (const level of levels) {
    if (opts.id && !opts.id.toUpperCase().startsWith(JLPT_LEVEL_LABEL[level])) {
      continue;
    }
    await enrichLevel(level, opts);
  }

  console.log('[grammar:enrich] Concluído.');
}

main().catch((error: unknown) => {
  console.error('[grammar:enrich] Erro:', error);
  process.exit(1);
});
