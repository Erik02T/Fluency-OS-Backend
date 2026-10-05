import { describe, expect, it } from 'vitest';
import {
  hasTranslationModelArtifact,
  matchTranslationResponse,
  TranslationBatchResponseSchema,
} from '../../scripts/grammar/translation-schema';

describe('FASE 26.5 — Contrato do tradutor OPUS local', () => {
  it('valida traduções e exige correspondência exata dos sourceIds', () => {
    const response = {
      translations: [
        { sourceId: '2', translation: 'Tradução dois.' },
        { sourceId: '1', translation: 'Tradução um.' },
      ],
    };

    expect(matchTranslationResponse(['1', '2'], response)).toEqual(
      new Map([
        ['2', 'Tradução dois.'],
        ['1', 'Tradução um.'],
      ]),
    );
    expect(() =>
      matchTranslationResponse(['1', '2'], {
        translations: [{ sourceId: '1', translation: 'Somente uma.' }],
      }),
    ).toThrow(/sourceIds/);
    expect(() =>
      TranslationBatchResponseSchema.parse({
        translations: [{ sourceId: '1', translation: '  ' }],
      }),
    ).toThrow();
    expect(hasTranslationModelArtifact('> pab É preciso traduzir.')).toBe(true);
    expect(hasTranslationModelArtifact('Preciso traduzir.')).toBe(false);
  });
});
