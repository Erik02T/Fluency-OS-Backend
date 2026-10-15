import { Injectable } from '@nestjs/common';
import { SRSItemType } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';

export interface AnalyticsSummaryRaw {
  totalKanji: number;
  masteredKanji: number;
  totalVocabulary: number;
  masteredVocabulary: number;
  totalGrammar: number;
  studiedGrammar: number;
  totalReviews: number;
  correctReviews: number;
  totalImmersionMinutes: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export interface KanjiAddedRecord {
  addedAt: Date;
}

export interface VocabularyAddedRecord {
  addedAt: Date;
}

export interface GrammarStudiedRecord {
  studiedAt: Date | null;
}

export interface ReviewRecord {
  itemType: SRSItemType;
  answeredAt: Date;
}

export interface ImmersionRecord {
  loggedAt: Date;
  durationMinutes: number;
  type: string;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Resumo (agregados de ciclo de vida) ─────────────────────────────────

  async getSummary(userId: string): Promise<AnalyticsSummaryRaw> {
    const [
      totalKanji,
      masteredKanji,
      totalVocabulary,
      masteredVocabulary,
      totalGrammar,
      studiedGrammar,
      kanjiReviewAgg,
      vocabReviewAgg,
      immersionAgg,
      streak,
    ] = await Promise.all([
      this.prisma.userKanjiProgress.count({ where: { userId } }),
      this.prisma.userKanjiProgress.count({
        where: { userId, isMastered: true },
      }),
      this.prisma.userVocabularyProgress.count({ where: { userId } }),
      this.prisma.userVocabularyProgress.count({
        where: { userId, isMastered: true },
      }),
      this.prisma.grammarPoint.count(),
      this.prisma.userGrammarProgress.count({
        where: { userId, isStudied: true },
      }),
      this.prisma.userKanjiProgress.aggregate({
        where: { userId },
        _sum: { totalReviews: true, correctReviews: true },
      }),
      this.prisma.userVocabularyProgress.aggregate({
        where: { userId },
        _sum: { totalReviews: true, correctReviews: true },
      }),
      this.prisma.immersionLog.aggregate({
        where: { userId, isActive: true },
        _sum: { durationMinutes: true },
      }),
      this.prisma.streak.findUnique({ where: { userId } }),
    ]);

    const totalReviews =
      (kanjiReviewAgg._sum.totalReviews ?? 0) +
      (vocabReviewAgg._sum.totalReviews ?? 0);
    const correctReviews =
      (kanjiReviewAgg._sum.correctReviews ?? 0) +
      (vocabReviewAgg._sum.correctReviews ?? 0);

    return {
      totalKanji,
      masteredKanji,
      totalVocabulary,
      masteredVocabulary,
      totalGrammar,
      studiedGrammar,
      totalReviews,
      correctReviews,
      totalImmersionMinutes: immersionAgg._sum.durationMinutes ?? 0,
      currentStreakDays: streak?.currentStreak ?? 0,
      longestStreakDays: streak?.longestStreak ?? 0,
    };
  }

  // ─── Série temporal de estudo ────────────────────────────────────────────

  findKanjiAddedSince(
    userId: string,
    since: Date,
  ): Promise<KanjiAddedRecord[]> {
    return this.prisma.userKanjiProgress.findMany({
      where: { userId, addedAt: { gte: since } },
      select: { addedAt: true },
    });
  }

  findVocabularyAddedSince(
    userId: string,
    since: Date,
  ): Promise<VocabularyAddedRecord[]> {
    return this.prisma.userVocabularyProgress.findMany({
      where: { userId, addedAt: { gte: since } },
      select: { addedAt: true },
    });
  }

  findGrammarStudiedSince(
    userId: string,
    since: Date,
  ): Promise<GrammarStudiedRecord[]> {
    return this.prisma.userGrammarProgress.findMany({
      where: { userId, isStudied: true, studiedAt: { gte: since } },
      select: { studiedAt: true },
    });
  }

  findReviewsSince(userId: string, since: Date): Promise<ReviewRecord[]> {
    return this.prisma.reviewAnswer.findMany({
      where: { session: { userId }, answeredAt: { gte: since } },
      select: { itemType: true, answeredAt: true },
    });
  }

  // ─── Imersão ─────────────────────────────────────────────────────────────

  findImmersionSince(userId: string, since: Date): Promise<ImmersionRecord[]> {
    return this.prisma.immersionLog.findMany({
      where: { userId, isActive: true, loggedAt: { gte: since } },
      select: { loggedAt: true, durationMinutes: true, type: true },
    });
  }

  async getImmersionBreakdown(
    userId: string,
    since: Date,
  ): Promise<{ type: string; totalMinutes: number }[]> {
    const grouped = await this.prisma.immersionLog.groupBy({
      by: ['type'],
      where: { userId, isActive: true, loggedAt: { gte: since } },
      _sum: { durationMinutes: true },
    });

    return grouped.map((row) => ({
      type: row.type,
      totalMinutes: row._sum.durationMinutes ?? 0,
    }));
  }
}
