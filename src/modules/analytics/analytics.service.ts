import { Injectable } from '@nestjs/common';
import { ImmersionType } from '@prisma/client';
import { PrismaService } from '../auth/repositories/prisma.service';
import {
  AnalyticsGranularity,
  AnalyticsPeriod,
  AnalyticsSummary,
  ImmersionBreakdownPoint,
  StudySeriesPoint,
} from './types/analytics.types';
import { AnalyticsOverviewResponseDto, AnalyticsQueryDto } from './dto';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function toDateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolvePeriodStart(period: AnalyticsPeriod, today: Date): Date | null {
  const base = startOfDay(today);
  switch (period) {
    case '7d':
      return new Date(base.getTime() - 6 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(base.getTime() - 29 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(base.getTime() - 89 * 24 * 60 * 60 * 1000);
    case 'all':
      return null;
    default:
      return new Date(base.getTime() - 29 * 24 * 60 * 60 * 1000);
  }
}

function buildDateSpan(start: Date | null, end: Date): string[] {
  const days: string[] = [];
  const effectiveStart =
    start ?? startOfDay(new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000));
  const cursor = startOfDay(effectiveStart);
  const last = startOfDay(end);
  while (cursor.getTime() <= last.getTime()) {
    days.push(toDateStamp(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function emptySeriesPoint(date: string): StudySeriesPoint {
  return {
    date,
    kanjiAdded: 0,
    vocabularyAdded: 0,
    grammarStudied: 0,
    kanjiReviewed: 0,
    vocabularyReviewed: 0,
    immersionMinutes: 0,
  };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    userId: string,
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsOverviewResponseDto> {
    const today = new Date();
    const periodStart = resolvePeriodStart(query.period ?? '30d', today);

    const [
      immersionLogs,
      streakHistory,
      kanjiProgress,
      vocabProgress,
      grammarProgress,
      streakRecord,
      totalGrammarPoints,
    ] = await Promise.all([
      this.prisma.immersionLog.findMany({
        where: {
          userId,
          ...(periodStart ? { loggedAt: { gte: periodStart } } : {}),
        },
        select: {
          type: true,
          durationMinutes: true,
          loggedAt: true,
        },
        orderBy: { loggedAt: 'asc' },
      }),
      this.prisma.streakHistory.findMany({
        where: {
          userId,
          ...(periodStart
            ? { activityDate: { gte: toDateStamp(periodStart) } }
            : {}),
        },
        select: {
          activityDate: true,
          kanjiReviewed: true,
          vocabReviewed: true,
          immersionMins: true,
          totalReviews: true,
        },
        orderBy: { activityDate: 'asc' },
      }),
      this.prisma.userKanjiProgress.findMany({
        where: {
          userId,
          ...(periodStart ? { addedAt: { gte: periodStart } } : {}),
        },
        select: {
          addedAt: true,
          masteredAt: true,
          totalReviews: true,
          correctReviews: true,
        },
      }),
      this.prisma.userVocabularyProgress.findMany({
        where: {
          userId,
          ...(periodStart ? { addedAt: { gte: periodStart } } : {}),
        },
        select: {
          addedAt: true,
          masteredAt: true,
          totalReviews: true,
          correctReviews: true,
        },
      }),
      this.prisma.userGrammarProgress.findMany({
        where: {
          userId,
          ...(periodStart ? { studiedAt: { gte: periodStart } } : {}),
        },
        select: {
          studiedAt: true,
          isStudied: true,
        },
      }),
      this.prisma.streak.findUnique({
        where: { userId },
        select: {
          currentStreak: true,
          longestStreak: true,
        },
      }),
      this.prisma.grammarPoint.count(),
    ]);

    const summary = await this.buildSummary(
      userId,
      kanjiProgress,
      vocabProgress,
      grammarProgress,
      totalGrammarPoints,
      streakRecord,
    );

    const studyTimeSeries = this.buildTimeSeries(
      periodStart,
      today,
      query.granularity ?? 'day',
      immersionLogs,
      streakHistory,
      kanjiProgress,
      vocabProgress,
      grammarProgress,
    );

    const immersionBreakdown = this.buildImmersionBreakdown(immersionLogs);

    return {
      summary,
      studyTimeSeries,
      immersionBreakdown,
    };
  }

  private async buildSummary(
    userId: string,
    kanjiProgressPeriod: Array<{
      totalReviews: number;
      correctReviews: number;
      masteredAt: Date | null;
    }>,
    vocabProgressPeriod: Array<{
      totalReviews: number;
      correctReviews: number;
      masteredAt: Date | null;
    }>,
    _grammarProgressPeriod: Array<{ isStudied: boolean }>,
    totalGrammarPoints: number,
    streakRecord: { currentStreak: number; longestStreak: number } | null,
  ): Promise<AnalyticsSummary> {
    void _grammarProgressPeriod;
    const [
      totalKanji,
      totalVocabulary,
      masteredKanjiTotal,
      masteredVocabTotal,
      studiedGrammarTotal,
    ] = await Promise.all([
      this.prisma.userKanjiProgress.count({ where: { userId } }),
      this.prisma.userVocabularyProgress.count({ where: { userId } }),
      this.prisma.userKanjiProgress.count({
        where: { userId, isMastered: true },
      }),
      this.prisma.userVocabularyProgress.count({
        where: { userId, isMastered: true },
      }),
      this.prisma.userGrammarProgress.count({
        where: { userId, isStudied: true },
      }),
    ]);

    const totalReviewsPeriod =
      kanjiProgressPeriod.reduce((acc, p) => acc + p.totalReviews, 0) +
      vocabProgressPeriod.reduce((acc, p) => acc + p.totalReviews, 0);

    const correctReviewsPeriod =
      kanjiProgressPeriod.reduce((acc, p) => acc + p.correctReviews, 0) +
      vocabProgressPeriod.reduce((acc, p) => acc + p.correctReviews, 0);

    const accuracyRate =
      totalReviewsPeriod > 0
        ? Math.round((correctReviewsPeriod / totalReviewsPeriod) * 1000) / 10
        : null;

    const totalImmersionMinutes = await this.prisma.immersionLog.aggregate({
      where: { userId, isActive: true },
      _sum: { durationMinutes: true },
    });

    return {
      totalKanji,
      masteredKanji: masteredKanjiTotal,
      totalVocabulary,
      masteredVocabulary: masteredVocabTotal,
      totalGrammar: totalGrammarPoints,
      studiedGrammar: studiedGrammarTotal,
      totalReviews: totalReviewsPeriod,
      accuracyRate,
      totalImmersionMinutes: totalImmersionMinutes._sum.durationMinutes ?? 0,
      currentStreakDays: streakRecord?.currentStreak ?? 0,
      longestStreakDays: streakRecord?.longestStreak ?? 0,
    };
  }

  private buildTimeSeries(
    periodStart: Date | null,
    today: Date,
    granularity: AnalyticsGranularity,
    immersionLogs: Array<{
      type: ImmersionType;
      durationMinutes: number;
      loggedAt: Date;
    }>,
    streakHistory: Array<{
      activityDate: string;
      kanjiReviewed: number;
      vocabReviewed: number;
      immersionMins: number;
      totalReviews: number;
    }>,
    kanjiProgress: Array<{ addedAt: Date; masteredAt: Date | null }>,
    vocabProgress: Array<{ addedAt: Date; masteredAt: Date | null }>,
    grammarProgress: Array<{ studiedAt: Date | null; isStudied: boolean }>,
  ): StudySeriesPoint[] {
    const dateSpan = buildDateSpan(periodStart, today);
    const pointsByDate = new Map<string, StudySeriesPoint>();
    for (const d of dateSpan) {
      pointsByDate.set(d, emptySeriesPoint(d));
    }

    for (const log of immersionLogs) {
      const key = toDateStamp(log.loggedAt);
      const pt = pointsByDate.get(key);
      if (pt) {
        pt.immersionMinutes += log.durationMinutes;
      }
    }

    for (const sh of streakHistory) {
      const pt = pointsByDate.get(sh.activityDate);
      if (pt) {
        pt.kanjiReviewed += sh.kanjiReviewed ?? 0;
        pt.vocabularyReviewed += sh.vocabReviewed ?? 0;
        if ((sh.immersionMins ?? 0) > pt.immersionMinutes) {
          pt.immersionMinutes = sh.immersionMins ?? 0;
        }
      }
    }

    for (const kp of kanjiProgress) {
      const key = toDateStamp(kp.addedAt);
      const pt = pointsByDate.get(key);
      if (pt) pt.kanjiAdded += 1;
    }

    for (const vp of vocabProgress) {
      const key = toDateStamp(vp.addedAt);
      const pt = pointsByDate.get(key);
      if (pt) pt.vocabularyAdded += 1;
    }

    for (const gp of grammarProgress) {
      if (!gp.isStudied || !gp.studiedAt) continue;
      const key = toDateStamp(gp.studiedAt);
      const pt = pointsByDate.get(key);
      if (pt) pt.grammarStudied += 1;
    }

    const daySeries = dateSpan.map((d) => pointsByDate.get(d)!).filter(Boolean);

    if (granularity === 'week') {
      return this.aggregateByWeek(daySeries);
    }

    return daySeries;
  }

  private aggregateByWeek(daily: StudySeriesPoint[]): StudySeriesPoint[] {
    const byWeekStart = new Map<string, StudySeriesPoint>();
    for (const point of daily) {
      const [y, m, d] = point.date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const weekStart = startOfWeek(date);
      const key = toDateStamp(weekStart);
      let acc = byWeekStart.get(key);
      if (!acc) {
        acc = emptySeriesPoint(key);
        byWeekStart.set(key, acc);
      }
      acc.kanjiAdded += point.kanjiAdded;
      acc.vocabularyAdded += point.vocabularyAdded;
      acc.grammarStudied += point.grammarStudied;
      acc.kanjiReviewed += point.kanjiReviewed;
      acc.vocabularyReviewed += point.vocabularyReviewed;
      acc.immersionMinutes += point.immersionMinutes;
    }
    return Array.from(byWeekStart.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  private buildImmersionBreakdown(
    immersionLogs: Array<{
      type: ImmersionType;
      durationMinutes: number;
    }>,
  ): ImmersionBreakdownPoint[] {
    const byType = new Map<string, number>();
    for (const log of immersionLogs) {
      byType.set(log.type, (byType.get(log.type) ?? 0) + log.durationMinutes);
    }
    return Array.from(byType.entries())
      .map(([type, totalMinutes]) => ({ type, totalMinutes }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes);
  }
}
