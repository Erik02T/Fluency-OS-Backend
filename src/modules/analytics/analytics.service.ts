import { Injectable } from '@nestjs/common';
import { SRSItemType } from '@prisma/client';
import { logStructured } from '../../common/logging/structured-log';
import {
  AnalyticsGranularity,
  AnalyticsOverviewQueryDto,
  AnalyticsOverviewResponseDto,
  AnalyticsPeriod,
  AnalyticsSummaryDto,
  ImmersionBreakdownPointDto,
  StudySeriesPointDto,
} from './dto';
import { AnalyticsRepository } from './repositories';
import { eachDayKey, periodStartDate, toDateKey } from './analytics-date.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async getOverview(
    userId: string,
    query: AnalyticsOverviewQueryDto,
  ): Promise<AnalyticsOverviewResponseDto> {
    const period: AnalyticsPeriod = query.period ?? '30d';
    const granularity: AnalyticsGranularity = query.granularity ?? 'day';
    const now = new Date();
    const since = periodStartDate(period, now);

    const [
      summaryRaw,
      kanjiAdded,
      vocabularyAdded,
      grammarStudied,
      reviews,
      immersion,
      immersionBreakdown,
    ] = await Promise.all([
      this.repository.getSummary(userId),
      this.repository.findKanjiAddedSince(userId, since),
      this.repository.findVocabularyAddedSince(userId, since),
      this.repository.findGrammarStudiedSince(userId, since),
      this.repository.findReviewsSince(userId, since),
      this.repository.findImmersionSince(userId, since),
      this.repository.getImmersionBreakdown(userId, since),
    ]);

    const studyTimeSeries = this.buildSeries(
      granularity,
      since,
      now,
      kanjiAdded.map((r) => r.addedAt),
      vocabularyAdded.map((r) => r.addedAt),
      grammarStudied
        .map((r) => r.studiedAt)
        .filter((value): value is Date => value !== null),
      reviews,
      immersion,
    );

    const summary: AnalyticsSummaryDto = {
      totalKanji: summaryRaw.totalKanji,
      masteredKanji: summaryRaw.masteredKanji,
      totalVocabulary: summaryRaw.totalVocabulary,
      masteredVocabulary: summaryRaw.masteredVocabulary,
      totalGrammar: summaryRaw.totalGrammar,
      studiedGrammar: summaryRaw.studiedGrammar,
      totalReviews: summaryRaw.totalReviews,
      accuracyRate:
        summaryRaw.totalReviews > 0
          ? Math.round(
              (summaryRaw.correctReviews / summaryRaw.totalReviews) * 100,
            )
          : null,
      totalImmersionMinutes: summaryRaw.totalImmersionMinutes,
      currentStreakDays: summaryRaw.currentStreakDays,
      longestStreakDays: summaryRaw.longestStreakDays,
    };

    const breakdown: ImmersionBreakdownPointDto[] = immersionBreakdown
      .filter((point) => point.totalMinutes > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    logStructured('info', 'AnalyticsService', 'analytics.overview.success', {
      userId,
      period,
      granularity,
      seriesPoints: studyTimeSeries.length,
    });

    return {
      summary,
      studyTimeSeries,
      immersionBreakdown: breakdown,
    };
  }

  private buildSeries(
    granularity: AnalyticsGranularity,
    since: Date,
    now: Date,
    kanjiAdded: Date[],
    vocabularyAdded: Date[],
    grammarStudied: Date[],
    reviews: { itemType: SRSItemType; answeredAt: Date }[],
    immersion: { loggedAt: Date; durationMinutes: number }[],
  ): StudySeriesPointDto[] {
    // Para granularidade diária geramos todos os buckets do período; para
    // semanal, agregamos os buckets diários em chaves de semana.
    const dayKeys = eachDayKey(since, now);

    const buckets = new Map<string, StudySeriesPointDto>();
    const ensure = (key: string): StudySeriesPointDto => {
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          date: key,
          kanjiAdded: 0,
          vocabularyAdded: 0,
          grammarStudied: 0,
          kanjiReviewed: 0,
          vocabularyReviewed: 0,
          immersionMinutes: 0,
        };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    const bucketKeyFor = (date: Date): string => toDateKey(date, granularity);

    // Pré-cria todos os buckets do período (inclusive os sem atividade) para
    // que o gráfico do frontend tenha pontos contínuos.
    const seriesKeys =
      granularity === 'week'
        ? Array.from(new Set(dayKeys.map((key) => this.weekKeyOf(key))))
        : dayKeys;
    for (const key of seriesKeys) {
      ensure(key);
    }

    for (const date of kanjiAdded) {
      ensure(bucketKeyFor(date)).kanjiAdded += 1;
    }
    for (const date of vocabularyAdded) {
      ensure(bucketKeyFor(date)).vocabularyAdded += 1;
    }
    for (const date of grammarStudied) {
      ensure(bucketKeyFor(date)).grammarStudied += 1;
    }
    for (const review of reviews) {
      const bucket = ensure(bucketKeyFor(review.answeredAt));
      if (review.itemType === SRSItemType.KANJI) {
        bucket.kanjiReviewed += 1;
      } else if (review.itemType === SRSItemType.VOCABULARY) {
        bucket.vocabularyReviewed += 1;
      }
    }
    for (const log of immersion) {
      ensure(bucketKeyFor(log.loggedAt)).immersionMinutes +=
        log.durationMinutes;
    }

    return Array.from(buckets.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
  }

  private weekKeyOf(dayKey: string): string {
    const [y, m, d] = dayKey.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const dow = date.getUTCDay();
    const weekStart = new Date(date.getTime() - dow * 86_400_000);
    return weekStart.toISOString().slice(0, 10);
  }
}
