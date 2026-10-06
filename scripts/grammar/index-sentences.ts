import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { decode } from 'seek-bzip';
import { z } from 'zod';
import {
  SENTENCE_INDEX_FILE,
  SOURCE_MANIFEST_FILE,
  TATOEBA_SENTENCES_FILE,
} from '../utils';
import { createSentenceIndex, parseTatoebaTsv } from './sentence-index';

const TatoebaManifestSourceSchema = z.object({
  id: z.literal('tatoeba-japanese-sentences'),
  file: z.literal('sentences/jpn_sentences.tsv.bz2'),
  format: z.literal('UTF-8 TSV compressed with bzip2'),
  columns: z.tuple([
    z.literal('sentence_id'),
    z.literal('language'),
    z.literal('text'),
  ]),
  language: z.literal('jpn'),
  recordCount: z.number().int().positive(),
  malformedRecordCount: z.literal(0),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const SourceManifestSchema = z.object({
  sources: z.array(z.unknown()),
});

function loadTatoebaManifestSource(): z.infer<typeof TatoebaManifestSourceSchema> {
  const manifest = SourceManifestSchema.parse(
    JSON.parse(fs.readFileSync(SOURCE_MANIFEST_FILE, 'utf8')),
  );
  const rawSource = manifest.sources.find(
    (source) =>
      typeof source === 'object' &&
      source !== null &&
      'id' in source &&
      source.id === 'tatoeba-japanese-sentences',
  );

  if (!rawSource) {
    throw new Error('Fonte Tatoeba não encontrada em data/raw/source-manifest.json.');
  }

  return TatoebaManifestSourceSchema.parse(rawSource);
}

function main(): void {
  const compressed = fs.readFileSync(TATOEBA_SENTENCES_FILE);
  const source = loadTatoebaManifestSource();
  const sha256 = createHash('sha256').update(compressed).digest('hex');

  if (compressed.length !== source.sizeBytes || sha256 !== source.sha256) {
    throw new Error('O arquivo Tatoeba não corresponde ao tamanho/hash do manifesto.');
  }

  const decompressed = new TextDecoder('utf-8', { fatal: true }).decode(
    decode(compressed),
  );
  const sentences = parseTatoebaTsv(decompressed);

  if (sentences.length !== source.recordCount) {
    throw new Error(
      `Contagem divergente: manifesto ${source.recordCount}, TSV ${sentences.length}.`,
    );
  }

  const indexed = createSentenceIndex(SENTENCE_INDEX_FILE, sentences, {
    sha256,
    sizeBytes: compressed.length,
    recordCount: sentences.length,
  });

  console.log(`✔ Tatoeba: ${indexed} frases japonesas indexadas`);
  console.log(`  · SQLite: ${SENTENCE_INDEX_FILE}`);
  console.log('  · Busca FTS5 trigram: sentence_search.japanese');
}

try {
  main();
} catch (error: unknown) {
  console.error('[grammar:index-sentences] Erro:', error);
  process.exitCode = 1;
}