import path from 'node:path';

/**
 * Caminhos canônicos do pipeline de gramática (FASE 1).
 * Todos os scripts devem resolver paths a partir da raiz do backend.
 */
export const BACKEND_ROOT = path.resolve(__dirname, '../..');

export const DATA_ROOT = path.join(BACKEND_ROOT, 'data');
export const RAW_ROOT = path.join(DATA_ROOT, 'raw');
export const RAW_GRAMMAR_ROOT = path.join(RAW_ROOT, 'grammar');
export const RAW_SENTENCES_ROOT = path.join(RAW_ROOT, 'sentences');
export const SOURCE_MANIFEST_FILE = path.join(RAW_ROOT, 'source-manifest.json');
export const TATOEBA_SENTENCES_FILE = path.join(
  RAW_SENTENCES_ROOT,
  'jpn_sentences.tsv.bz2',
);
export const PROCESSED_ROOT = path.join(DATA_ROOT, 'processed');
export const PROCESSED_SENTENCES_ROOT = path.join(PROCESSED_ROOT, 'sentences');
export const TRANSLATION_CACHE_ROOT = path.join(
  PROCESSED_SENTENCES_ROOT,
  'translation-cache',
);
export const SENTENCE_INDEX_FILE = path.join(
  PROCESSED_SENTENCES_ROOT,
  'sentences.sqlite',
);
export const SELECTED_EXAMPLES_ROOT = path.join(
  PROCESSED_SENTENCES_ROOT,
  'selected-examples',
);
export const READINGS_ROOT = path.join(PROCESSED_SENTENCES_ROOT, 'readings');
export const NORMALIZED_ROOT = path.join(DATA_ROOT, 'normalized');
export const GENERATED_ROOT = path.join(DATA_ROOT, 'generated');
export const ENRICHED_ROOT = path.join(DATA_ROOT, 'enriched');
export const VALIDATED_ROOT = path.join(DATA_ROOT, 'validated');
export const PRODUCTION_ROOT = path.join(DATA_ROOT, 'production');
export const REJECTED_ROOT = path.join(DATA_ROOT, 'rejected');
export const VALIDATED_GRAMMAR_ROOT = path.join(VALIDATED_ROOT, 'grammar');
export const REJECTED_GRAMMAR_ROOT = path.join(REJECTED_ROOT, 'grammar');
export const VALIDATED_TRANSLATIONS_ROOT = path.join(
  VALIDATED_ROOT,
  'grammar-translations',
);
export const TRANSLATION_PREVIEW_ROOT = path.join(
  VALIDATED_TRANSLATIONS_ROOT,
  'pilot',
);
export const REJECTED_TRANSLATIONS_ROOT = path.join(
  REJECTED_ROOT,
  'grammar-translations',
);

export const SEED_GRAMMAR_ROOT = path.join(BACKEND_ROOT, 'seed', 'grammar');

/** PDFs de gramática Tanos arquivados em data/raw/grammar. */
export const TANOS_PDF_ROOT = RAW_GRAMMAR_ROOT;

export const JLPT_LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const;
export type JlptLevelDir = (typeof JLPT_LEVELS)[number];

export const JLPT_LEVEL_LABEL: Record<
  JlptLevelDir,
  'N5' | 'N4' | 'N3' | 'N2' | 'N1'
> = {
  n5: 'N5',
  n4: 'N4',
  n3: 'N3',
  n2: 'N2',
  n1: 'N1',
};

export function rawLevelDir(level: JlptLevelDir): string {
  return path.join(RAW_ROOT, level);
}

export function rawPatternsFile(level: JlptLevelDir): string {
  return path.join(rawLevelDir(level), 'patterns.json');
}

export function normalizedFile(level: JlptLevelDir): string {
  return path.join(NORMALIZED_ROOT, `${level}.json`);
}

export function selectedExamplesFile(level: JlptLevelDir): string {
  return path.join(SELECTED_EXAMPLES_ROOT, `${level}.json`);
}

export function insufficientExamplesFile(level: JlptLevelDir): string {
  return path.join(SELECTED_EXAMPLES_ROOT, `${level}-insufficient.json`);
}

export function readingsFile(level: JlptLevelDir): string {
  return path.join(READINGS_ROOT, `${level}.json`);
}

export function readingFailuresFile(level: JlptLevelDir): string {
  return path.join(READINGS_ROOT, `${level}-failures.json`);
}

export function translationCacheFile(level: JlptLevelDir): string {
  return path.join(TRANSLATION_CACHE_ROOT, `${level}.json`);
}

export function validatedTranslationsFile(level: JlptLevelDir): string {
  return path.join(VALIDATED_TRANSLATIONS_ROOT, `${level}.json`);
}

export function translationPreviewFile(level: JlptLevelDir): string {
  return path.join(TRANSLATION_PREVIEW_ROOT, `${level}.json`);
}

export function rejectedTranslationsFile(level: JlptLevelDir): string {
  return path.join(REJECTED_TRANSLATIONS_ROOT, `${level}.json`);
}

export function rejectedTranslationPreviewFile(level: JlptLevelDir): string {
  return path.join(TRANSLATION_PREVIEW_ROOT, `${level}-rejected.json`);
}

export function generatedFile(level: JlptLevelDir): string {
  return path.join(GENERATED_ROOT, `${level}.json`);
}

export function enrichedFile(level: JlptLevelDir): string {
  return path.join(ENRICHED_ROOT, `${level}.json`);
}

export function validatedFile(level: JlptLevelDir): string {
  return path.join(VALIDATED_ROOT, `${level}.json`);
}

export function tanosGrammarPdf(level: JlptLevelDir): string {
  return path.join(TANOS_PDF_ROOT, `${level}.pdf`);
}

export function validatedGrammarFile(level: JlptLevelDir): string {
  return path.join(VALIDATED_GRAMMAR_ROOT, `${level}.json`);
}

export function rejectedGrammarFile(level: JlptLevelDir): string {
  return path.join(REJECTED_GRAMMAR_ROOT, `${level}.json`);
}

export function seedGrammarFile(level: JlptLevelDir): string {
  return path.join(SEED_GRAMMAR_ROOT, `${level}.json`);
}
