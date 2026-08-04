import { Injectable } from '@nestjs/common';
import { PrismaService } from '../auth/repositories/prisma.service';

export interface DashboardSummaryResponse {
  kanjiStudied: number;
  kanjiMastered: number;
  dueReviews: number;
  favoriteKanjis: number;
  totalReviews: number;
  accuracyRate: number;
  currentStreak: number;
  longestStreak: number;
  lastReviewAt: string | null;
}

@Injectable()
export class DashboardSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string): Promise<DashboardSummaryResponse> {
    const now = new Date();

    const [
      kanjiStudied,
      kanjiMastered,
      dueReviews,
      favoriteKanjis,
      reviewStats,
      recentProgress,
      streak,
    ] = await Promise.all([
      this.prisma.userKanjiProgress.count({ where: { userId } }),
      this.prisma.userKanjiProgress.count({
        where: { userId, isMastered: true },
      }),
      this.prisma.userKanjiProgress.count({
        where: {
          userId,
          isSuspended: false,
          isMastered: false,
          nextReviewAt: { lte: now },
        },
      }),
      this.prisma.userKanjiProgress.count({
        where: { userId, isFavorite: true },
      }),
      this.prisma.userKanjiProgress.aggregate({
        where: { userId },
        _sum: {
          totalReviews: true,
          correctReviews: true,
        },
      }),
      this.prisma.userKanjiProgress.findFirst({
        where: { userId },
        orderBy: { lastReviewAt: 'desc' },
        select: { lastReviewAt: true },
      }),
      this.prisma.streak.findUnique({
        where: { userId },
        select: {
          currentStreak: true,
          longestStreak: true,
        },
      }),
    ]);

    const totalReviews = reviewStats._sum.totalReviews ?? 0;
    const correctReviews = reviewStats._sum.correctReviews ?? 0;
    const accuracyRate =
      totalReviews > 0 ? Number(((correctReviews / totalReviews) * 100).toFixed(1)) : 0;

    return {
      kanjiStudied,
      kanjiMastered,
      dueReviews,
      favoriteKanjis,
      totalReviews,
      accuracyRate,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastReviewAt: recentProgress?.lastReviewAt
        ? recentProgress.lastReviewAt.toISOString()
        : null,
    };
  }
}
