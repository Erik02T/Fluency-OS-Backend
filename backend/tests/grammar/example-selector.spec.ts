import { describe, expect, it } from 'vitest';
import type { PatternMatchCandidate } from '../../scripts/grammar/pattern-matcher';
import { selectExamples } from '../../scripts/grammar/example-selector';

function candidate(
  sentenceId: string,
  japanese: string,
): PatternMatchCandidate {
  return { sentenceId, language: 'jpn', japanese, matchedBy: 'regex' };
}

describe('FASE 25 — Seleção de exemplos reais', () => {
  it('filtra duplicatas e escolhe até cinco candidatos válidos por ranking estável', () => {
    const selection = selectExamples('日本語', [
      candidate('15', '日本語の文章です。'),
      candidate('11', '私は日本語を勉強しています。'),
      candidate('12', '日本語が好きです。'),
      candidate('13', '日本語を学んでいます。'),
      candidate('14', '日本語が好きです。'),
      candidate('16', '英語の文章です。'),
      candidate('17', '日本語。'),
      candidate('18', `日本語${'あ'.repeat(125)}。`),
      candidate('19', `日本語${'あ'.repeat(85)}。`),
    ]);

    expect(selection.status).toBe('COMPLETE');
    expect(selection.candidateCount).toBe(9);
    expect(selection.eligibleCandidateCount).toBe(5);
    expect(selection.examples).toHaveLength(5);
    expect(selection.examples[0].rankingScore).toBeGreaterThanOrEqual(
      selection.examples[1].rankingScore,
    );
    expect(selection.examples[0].reviewStatus).toBe('PENDING');
    expect(
      new Set(selection.examples.map((example) => example.sourceId)).size,
    ).toBe(5);
  });

  it('não inventa exemplos e sinaliza menos de três candidatos elegíveis', () => {
    const selection = selectExamples('日本語', [
      candidate('21', '日本語の文章です。'),
      candidate('22', '日本語が好きです。'),
      candidate('23', '英語だけです。'),
    ]);

    expect(selection.status).toBe('INSUFFICIENT_CANDIDATES');
    expect(selection.eligibleCandidateCount).toBe(2);
    expect(selection.examples).toHaveLength(2);
  });

  it('revalida a presença do pattern antes de selecionar', () => {
    const selection = selectExamples('〜なければならない', [
      candidate('31', '日本語の文章です。'),
      candidate('32', '私は眠らなければなりません。'),
    ]);

    expect(selection.eligibleCandidateCount).toBe(1);
    expect(selection.examples[0].sourceId).toBe('32');
  });
});
