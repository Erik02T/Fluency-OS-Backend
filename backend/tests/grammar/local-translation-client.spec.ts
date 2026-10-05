import { describe, expect, it } from 'vitest';
import { parseLocalWorkerReply } from '../../scripts/grammar/local-translation-client';

describe('Tradução local sem credenciais', () => {
  it('aceita somente resposta OPUS do requestId correspondente', () => {
    const line = JSON.stringify({
      requestId: 'translation-1',
      ok: true,
      response: '{"translations":[]}',
    });

    expect(parseLocalWorkerReply(line, 'translation-1')).toBe(
      '{"translations":[]}',
    );
    expect(() => parseLocalWorkerReply(line, 'translation-2')).toThrow(
      /não corresponde/,
    );
  });

  it('propaga erro individual do worker sem confundir com uma tradução', () => {
    const line = JSON.stringify({
      requestId: 'translation-3',
      ok: false,
      error: 'Falha de inferência',
    });

    expect(() => parseLocalWorkerReply(line, 'translation-3')).toThrow(
      'Falha de inferência',
    );
  });
});