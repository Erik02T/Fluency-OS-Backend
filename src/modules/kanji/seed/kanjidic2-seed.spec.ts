import {
  countUniqueSeedKanjiCharacters,
  loadSeedKanjis,
} from './kanjidic2-seed';

describe('Kanjidic2 seed data', () => {
  it('should provide at least 2000 unique kanjis', async () => {
    jest.setTimeout(60000);

    const kanjis = await loadSeedKanjis();
    const uniqueCount = countUniqueSeedKanjiCharacters(kanjis);

    expect(kanjis.length).toBeGreaterThanOrEqual(2000);
    expect(uniqueCount).toBe(kanjis.length);
  });
});
