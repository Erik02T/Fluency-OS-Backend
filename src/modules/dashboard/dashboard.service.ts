import { Injectable } from '@nestjs/common';
import { PrismaService } from '../auth/repositories/prisma.service';
import { DashboardSummaryResponse } from './dto';

/**
 * Agregação do dashboard unificado.
 *
 * Regras de cálculo confirmadas no projeto:
 * - kanjiStudied: existe linha em UserKanjiProgress para o usuário
 *   (o item entrou na fila SRS individual).
 * - kanjiMastered: flag isMastered (RN-K001 — srsLevel >= 5, mantida pelo
 *   SrsService/ReviewRepository).
 * - favoriteKanjis: flag isFavorite em UserKanjiProgress.
 * - dueReviews: mesma regra do ReviewRepository.countDueKanji/
 *   countDueVocabulary (isSuspended = false e nextReviewAt <= now),
 *   somando kanji + vocabulário — consistente com GET /review/queue/count.
 * - totalReviews/accuracyRate: soma de totalReviews/correctReviews de
 *   UserKanjiProgress + UserVocabularyProgress (mesma regra do
 *   AnalyticsRepository.getSummary). accuracyRate = corretas / total * 100
 *   com 1 casa decimal; 0 quando não há revisões.
 * - lastReviewAt: maior lastReviewAt não nulo entre kanji e vocabulário.
 * - vocabularyStudied/vocabularyMastered: UserVocabularyProgress e flag
 *   isMastered.
 * - grammarStudied: UserGrammarProgress com isStudied = true (critério
 *   definido pelo módulo de Gramática em POST /grammar/:id/progress).
 * - currentStreak/longestStreak: registro real em Streak; 0 somente quando
 *   o usuário não possui streak ativo registrado.
 *
 * Todas as consultas são filtradas pela identidade autenticada (userId),
 * garantindo isolamento entre usuários.
 */
@Injectable()
export class DashboardSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string): Promise<DashboardSummaryResponse> {
    const now = new Date();

    const [
      kanjiStudied,
      kanjiMastered,
      dueKanjiReviews,
      favoriteKanjis,
      kanjiReviewStats,
      vocabularyStudied,
      vocabularyMastered,
      dueVocabularyReviews,
      vocabularyReviewStats,
      lastKanjiProgress,
      lastVocabularyProgress,
      grammarStudied,
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
      this.prisma.userVocabularyProgress.count({ where: { userId } }),
      this.prisma.userVocabularyProgress.count({
        where: { userId, isMastered: true },
      }),
      this.prisma.userVocabularyProgress.count({
        where: {
          userId,
          isSuspended: false,
          nextReviewAt: { lte: now },
        },
      }),
      this.prisma.userVocabularyProgress.aggregate({
        where: { userId },
        _sum: {
          totalReviews: true,
          correctReviews: true,
        },
      }),
      this.prisma.userKanjiProgress.findFirst({
        where: { userId, lastReviewAt: { not: null } },
        orderBy: { lastReviewAt: 'desc' },
        select: { lastReviewAt: true },
      }),
      this.prisma.userVocabularyProgress.findFirst({
        where: { userId, lastReviewAt: { not: null } },
        orderBy: { lastReviewAt: 'desc' },
        select: { lastReviewAt: true },
      }),
      this.prisma.userGrammarProgress.count({
        where: { userId, isStudied: true },
      }),
      this.prisma.streak.findUnique({
        where: { userId },
        select: {
          currentStreak: true,
          longestStreak: true,
        },
      }),
    ]);

    const totalReviews =
      (kanjiReviewStats._sum.totalReviews ?? 0) +
      (vocabularyReviewStats._sum.totalReviews ?? 0);
    const correctReviews =
      (kanjiReviewStats._sum.correctReviews ?? 0) +
      (vocabularyReviewStats._sum.correctReviews ?? 0);
    const accuracyRate =
      totalReviews > 0
        ? Number(((correctReviews / totalReviews) * 100).toFixed(1))
        : 0;

    const lastReviewDates = [
      lastKanjiProgress?.lastReviewAt ?? null,
      lastVocabularyProgress?.lastReviewAt ?? null,
    ].filter((date): date is Date => date !== null);
    const lastReviewAt =
      lastReviewDates.length > 0
        ? new Date(Math.max(...lastReviewDates.map((date) => date.getTime())))
        : null;

    return {
      kanjiStudied,
      kanjiMastered,
      dueReviews: dueKanjiReviews + dueVocabularyReviews,
      favoriteKanjis,
      totalReviews,
      accuracyRate,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastReviewAt: lastReviewAt ? lastReviewAt.toISOString() : null,
      vocabularyStudied,
      vocabularyMastered,
      grammarStudied,
    };
  }
}
