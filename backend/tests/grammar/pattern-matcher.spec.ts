import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createSentenceIndex,
  parseTatoebaTsv,
} from '../../scripts/grammar/sentence-index';
import { PatternMatcher } from '../../scripts/grammar/pattern-matcher';

function withMatcher<T>(tsv: string, run: (matcher: PatternMatcher) => T): T {
  const sentences = parseTatoebaTsv(tsv);
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fluency-pattern-matcher-'),
  );
  const indexPath = path.join(temporaryDirectory, 'sentences.sqlite');
  createSentenceIndex(indexPath, sentences, {
    sha256: 'a'.repeat(64),
    sizeBytes: 100,
    recordCount: sentences.length,
  });

  const matcher = new PatternMatcher(indexPath);
  try {
    return run(matcher);
  } finally {
    matcher.close();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

const SAMPLE_SENTENCES = [
  '100\tjpn\t日本語の文章です。',
  '101\tjpn\t私は眠らなければなりません。',
  '102\tjpn\t本ばかり読んでいる。',
  '103\tjpn\t私も行く。',
  '104\tjpn\tそれを下さい。',
  '105\tjpn\t学校へ向かいます。',
  '106\tjpn\t日本語を学ぶのが好きです。',
  '107\tjpn\t今日は猫を飼いたいです。',
  '108\tjpn\t食べるとお腹がいっぱいになる。',
  '109\tjpn\t彼は見るや否や走り出した。',
  '110\tjpn\t泳いだり走ったりする。',
  '111\tjpn\t一体どうしたの。',
  '112\tjpn\tこの中で彼が一番好きです。',
  '113\tjpn\t寝ている間に電話が来た。',
  '114\tjpn\t彼は転居を余儀なくされた。',
].join('\n');

describe('FASE 24 — Engine de matching de patterns', () => {
  it('faz busca literal pelo índice FTS5', () => {
    const result = withMatcher(SAMPLE_SENTENCES, (matcher) =>
      matcher.search({ pattern: '日本語', mode: 'literal' }),
    );

    expect(result.usedFts).toBe(true);
    expect(result.candidates.map((candidate) => candidate.sentenceId)).toEqual([
      '100',
      '106',
    ]);
  });

  it('normaliza a variação 下さい/ください antes de comparar', () => {
    const result = withMatcher(SAMPLE_SENTENCES, (matcher) =>
      matcher.search({ pattern: '下さい', mode: 'normalized' }),
    );

    expect(result.candidates.map((candidate) => candidate.sentenceId)).toEqual([
      '104',
    ]);
  });

  it('interpreta 〜 como variável e reconhece a forma polida なりません', () => {
    const result = withMatcher(SAMPLE_SENTENCES, (matcher) =>
      matcher.search({ pattern: '〜なければならない', mode: 'regex' }),
    );

    expect(result.candidates).toContainEqual({
      sentenceId: '101',
      language: 'jpn',
      japanese: '私は眠らなければなりません。',
      matchedBy: 'regex',
    });
    expect(result.usedFts).toBe(true);
  });

  it('interpreta placeholders Tanos e usa fallback para padrões curtos', () => {
    const result = withMatcher(SAMPLE_SENTENCES, (matcher) => ({
      placeholder: matcher.search({ pattern: 'N+ばかり', mode: 'regex' }),
      short: matcher.search({ pattern: 'も', mode: 'literal' }),
    }));

    expect(
      result.placeholder.candidates.map((candidate) => candidate.sentenceId),
    ).toEqual(['102']);
    expect(result.short.usedFts).toBe(false);
    expect(
      result.short.candidates.map((candidate) => candidate.sentenceId),
    ).toEqual(['103']);
  });

  it('expande alternativas, placeholders e variantes ortográficas Tanos', () => {
    const result = withMatcher(SAMPLE_SENTENCES, (matcher) => ({
      slash: matcher.search({ pattern: 'に/へ', mode: 'regex' }),
      kanaKanji: matcher.search({ pattern: '〜のがすきです', mode: 'regex' }),
      stem: matcher.search({ pattern: 'stem+たいです', mode: 'regex' }),
      dictionary: matcher.search({
        pattern: 'Dictionary form+と',
        mode: 'regex',
      }),
      parenthetical: matcher.search({
        pattern: '〜や否や（いなや）',
        mode: 'regex',
      }),
      kanjiParenthetical: matcher.search({
        pattern: 'いったい（一体）',
        mode: 'regex',
      }),
      ellipsis: matcher.search({
        pattern: '〜たり…〜たりする',
        mode: 'regex',
      }),
      lexicalVariants: matcher.search({
        pattern: '〜のなかで〜がいちばん〜',
        mode: 'regex',
      }),
      commaAndKana: matcher.search({
        pattern: '〜ているあいだに,〜',
        mode: 'regex',
      }),
      conjugation: matcher.search({
        pattern: '〜を余儀なくされる',
        mode: 'regex',
      }),
    }));

    expect(
      result.slash.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('105');
    expect(
      result.kanaKanji.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('106');
    expect(
      result.stem.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('107');
    expect(
      result.dictionary.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('108');
    expect(
      result.parenthetical.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('109');
    expect(
      result.kanjiParenthetical.candidates.map(
        (candidate) => candidate.sentenceId,
      ),
    ).toContain('111');
    expect(
      result.ellipsis.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('110');
    expect(
      result.lexicalVariants.candidates.map(
        (candidate) => candidate.sentenceId,
      ),
    ).toContain('112');
    expect(
      result.commaAndKana.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('113');
    expect(
      result.conjugation.candidates.map((candidate) => candidate.sentenceId),
    ).toContain('114');
  });
});
