import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  createSentenceIndex,
  parseTatoebaTsv,
} from '../../scripts/grammar/sentence-index';

describe('FASE 23 — Indexação das frases Tatoeba', () => {
  it('parseia as três colunas e preserva o texto japonês', () => {
    expect(
      parseTatoebaTsv('1297\tjpn\tきみにちょっとしたものをもってきたよ。\n'),
    ).toEqual([
      {
        sentenceId: '1297',
        language: 'jpn',
        japanese: 'きみにちょっとしたものをもってきたよ。',
      },
    ]);
  });

  it.each([
    ['colunas inválidas', '12\tjpn'],
    ['ID inválido', 'abc\tjpn\t日本語'],
    ['idioma inesperado', '12\teng\tJapanese'],
    ['texto vazio', '12\tjpn\t  '],
    ['ID duplicado', '12\tjpn\t日本語\n12\tjpn\t別の文'],
  ])('rejeita registros com %s', (_caseName, tsv) => {
    expect(() => parseTatoebaTsv(tsv)).toThrow();
  });

  it('cria índice SQLite pesquisável e pode ser reconstruído sem duplicar', () => {
    const sentences = parseTatoebaTsv(
      '12\tjpn\t日本語の文章です。\n13\tjpn\t別の日本語です。\n',
    );
    const temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fluency-sentence-index-'),
    );
    const indexPath = path.join(temporaryDirectory, 'sentences.sqlite');
    const metadata = {
      sha256: 'a'.repeat(64),
      sizeBytes: 100,
      recordCount: sentences.length,
    };

    try {
      expect(createSentenceIndex(indexPath, sentences, metadata)).toBe(2);
      expect(createSentenceIndex(indexPath, sentences, metadata)).toBe(2);

      const database = new Database(indexPath);
      try {
        expect(
          database.prepare('SELECT COUNT(*) AS count FROM sentences').get(),
        ).toEqual({ count: 2 });
        expect(
          database
            .prepare(
              'SELECT sentence_id FROM sentence_search WHERE japanese MATCH ?',
            )
            .get('日本語'),
        ).toEqual({ sentence_id: '12' });
        expect(
          database
            .prepare("SELECT value FROM index_metadata WHERE name = 'source_sha256'")
            .get(),
        ).toEqual({ value: 'a'.repeat(64) });
      } finally {
        database.close();
      }
    } finally {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});