import { describe, expect, it } from 'vitest';
import { JapaneseReadingGenerator } from '../../scripts/grammar/reading-generator';

describe('FASE 26 — Geração de readings', () => {
  it('converte japonês para hiragana usando Kuroshiro/Kuromoji', async () => {
    const generator = new JapaneseReadingGenerator();
    const reading = await generator.toHiragana('私は眠らなければなりません。');

    expect(reading).toBe('わたしはねむらなければなりません。');
  });

  it('rejeita texto japonês vazio', async () => {
    const generator = new JapaneseReadingGenerator();

    await expect(generator.toHiragana('  ')).rejects.toThrow();
  });
});
