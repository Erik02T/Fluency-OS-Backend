import { SRSItemType } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './repositories';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const repository = {
    getSummary: jest.fn(),
    findKanjiAddedSince: jest.fn(),
    findVocabularyAddedSince: jest.fn(),
    findGrammarStudiedSince: jest.fn(),
    findReviewsSince: jest.fn(),
    findImmersionSince: jest.fn(),
    getImmersionBreakdown: jest.fn(),
  };

  const summaryRaw = {
    totalKanji: 10,
    masteredKanji: 4,
    totalVocabulary: 20,
    masteredVocabulary: 8,
    totalGrammar: 100,
    studiedGrammar: 5,
    totalReviews: 50,
    correctReviews: 41,
    totalImmersionMinutes: 300,
    currentStreakDays: 3,
    longestStreakDays: 7,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(
      repository as unknown as AnalyticsRepository,
    );
    repository.getSummary.mockResolvedValue(summaryRaw);
    repository.findKanjiAddedSince.mockResolvedValue([]);
    repository.findVocabularyAddedSince.mockResolvedValue([]);
    repository.findGrammarStudiedSince.mockResolvedValue([]);
    repository.findReviewsSince.mockResolvedValue([]);
    repository.findImmersionSince.mockResolvedValue([]);
    repository.getImmersionBreakdown.mockResolvedValue([]);
  });

  it('calcula accuracyRate arredondado a partir do resumo', async () => {
    const result = await service.getOverview('user-123', { period: '7d' });

    expect(result.summary.accuracyRate).toBe(82);
    expect(result.summary.totalReviews).toBe(50);
    expect(result.summary.currentStreakDays).toBe(3);
  });

  it('accuracyRate é null quando não há revisões', async () => {
    repository.getSummary.mockResolvedValue({
      ...summaryRaw,
      totalReviews: 0,
      correctReviews: 0,
    });

    const result = await service.getOverview('user-123', {});
    expect(result.summary.accuracyRate).toBeNull();
  });

  it('aplica defaults period=30d e granularity=day', async () => {
    const result = await service.getOverview('user-123', {});

    // 30 dias => 30 pontos diários na série.
    expect(result.studyTimeSeries).toHaveLength(30);
  });

  it('7d produz 7 pontos diários', async () => {
    const result = await service.getOverview('user-123', {
      period: '7d',
      granularity: 'day',
    });
    expect(result.studyTimeSeries).toHaveLength(7);
  });

  it('agrega atividade nos buckets corretos', async () => {
    const day = new Date();
    day.setUTCHours(12, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);

    repository.findKanjiAddedSince.mockResolvedValue([{ addedAt: day }]);
    repository.findVocabularyAddedSince.mockResolvedValue([{ addedAt: day }]);
    repository.findGrammarStudiedSince.mockResolvedValue([{ studiedAt: day }]);
    repository.findReviewsSince.mockResolvedValue([
      { itemType: SRSItemType.KANJI, answeredAt: day },
      { itemType: SRSItemType.VOCABULARY, answeredAt: day },
    ]);
    repository.findImmersionSince.mockResolvedValue([
      { loggedAt: day, durationMinutes: 25 },
    ]);

    const result = await service.getOverview('user-123', {
      period: '7d',
      granularity: 'day',
    });

    const point = result.studyTimeSeries.find((p) => p.date === key);
    expect(point).toBeDefined();
    expect(point?.kanjiAdded).toBe(1);
    expect(point?.vocabularyAdded).toBe(1);
    expect(point?.grammarStudied).toBe(1);
    expect(point?.kanjiReviewed).toBe(1);
    expect(point?.vocabularyReviewed).toBe(1);
    expect(point?.immersionMinutes).toBe(25);
  });

  it('ordena e filtra o breakdown de imersão', async () => {
    repository.getImmersionBreakdown.mockResolvedValue([
      { type: 'ANIME', totalMinutes: 100 },
      { type: 'MANGA', totalMinutes: 0 },
      { type: 'GAME', totalMinutes: 200 },
    ]);

    const result = await service.getOverview('user-123', { period: '30d' });

    expect(result.immersionBreakdown).toEqual([
      { type: 'GAME', totalMinutes: 200 },
      { type: 'ANIME', totalMinutes: 100 },
    ]);
  });

  it('granularity semanal gera menos buckets que diária', async () => {
    const weekly = await service.getOverview('user-123', {
      period: '30d',
      granularity: 'week',
    });
    // 30 dias => ~5 semanas.
    expect(weekly.studyTimeSeries.length).toBeLessThanOrEqual(6);
    expect(weekly.studyTimeSeries.length).toBeGreaterThanOrEqual(4);
  });
});
