import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { z } from 'zod';

const TatoebaSentenceSchema = z
  .object({
    sentenceId: z.string().regex(/^[1-9]\d*$/, 'sentence_id deve ser positivo'),
    language: z.literal('jpn'),
    japanese: z.string().refine((value) => value.trim().length > 0, {
      message: 'text não pode estar vazio',
    }),
  })
  .strict();

const IndexMetadataSchema = z
  .object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.number().int().positive(),
    recordCount: z.number().int().positive(),
  })
  .strict();

export type TatoebaSentence = z.infer<typeof TatoebaSentenceSchema>;
export type SentenceIndexMetadata = z.infer<typeof IndexMetadataSchema>;

export function parseTatoebaTsv(tsv: string): TatoebaSentence[] {
  const lines = tsv.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();

  if (lines.length === 0) {
    throw new Error('O TSV de frases está vazio.');
  }

  const sentenceIds = new Set<string>();
  return lines.map((line, index) => {
    const fields = line.split('\t');
    if (fields.length !== 3) {
      throw new Error(`Linha ${index + 1}: esperado TSV com exatamente 3 colunas.`);
    }

    const parsed = TatoebaSentenceSchema.safeParse({
      sentenceId: fields[0],
      language: fields[1],
      japanese: fields[2],
    });

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw new Error(`Linha ${index + 1}: ${details}`);
    }

    if (sentenceIds.has(parsed.data.sentenceId)) {
      throw new Error(`Linha ${index + 1}: sentence_id duplicado ${parsed.data.sentenceId}.`);
    }

    sentenceIds.add(parsed.data.sentenceId);
    return parsed.data;
  });
}

export function createSentenceIndex(
  indexPath: string,
  sentences: readonly TatoebaSentence[],
  metadata: SentenceIndexMetadata,
): number {
  const validatedMetadata = IndexMetadataSchema.parse(metadata);
  if (sentences.length !== validatedMetadata.recordCount) {
    throw new Error(
      `Contagem divergente: metadado ${validatedMetadata.recordCount}, dados ${sentences.length}.`,
    );
  }

  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  const database = new Database(indexPath);

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS sentences (
        sentence_id TEXT PRIMARY KEY,
        language TEXT NOT NULL CHECK (language = 'jpn'),
        japanese TEXT NOT NULL CHECK (length(trim(japanese)) > 0)
      );
      CREATE INDEX IF NOT EXISTS sentences_language_idx ON sentences(language);
      CREATE VIRTUAL TABLE IF NOT EXISTS sentence_search USING fts5(
        sentence_id UNINDEXED,
        language UNINDEXED,
        japanese,
        tokenize = 'trigram'
      );
      CREATE TABLE IF NOT EXISTS index_metadata (
        name TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const insertSentence = database.prepare(
      'INSERT INTO sentences (sentence_id, language, japanese) VALUES (?, ?, ?)',
    );
    const insertSearchText = database.prepare(
      'INSERT INTO sentence_search (sentence_id, language, japanese) VALUES (?, ?, ?)',
    );
    const insertMetadata = database.prepare(
      'INSERT INTO index_metadata (name, value) VALUES (?, ?)',
    );

    const rebuild = database.transaction(() => {
      database.exec(
        'DELETE FROM sentence_search; DELETE FROM sentences; DELETE FROM index_metadata;',
      );

      for (const sentence of sentences) {
        insertSentence.run(
          sentence.sentenceId,
          sentence.language,
          sentence.japanese,
        );
        insertSearchText.run(
          sentence.sentenceId,
          sentence.language,
          sentence.japanese,
        );
      }

      insertMetadata.run('index_version', '1');
      insertMetadata.run('source_sha256', validatedMetadata.sha256);
      insertMetadata.run('source_size_bytes', String(validatedMetadata.sizeBytes));
      insertMetadata.run('record_count', String(validatedMetadata.recordCount));
    });

    rebuild();
    return sentences.length;
  } finally {
    database.close();
  }
}