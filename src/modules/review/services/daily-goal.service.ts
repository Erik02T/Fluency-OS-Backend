import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';

@Injectable()
export class DailyGoalService {
  private readonly logger = new Logger(DailyGoalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtém a data no formato YYYY-MM-DD para o timezone especificado
   */
  getLocalDateString(
    date: Date = new Date(),
    timezone: string = 'America/Sao_Paulo',
  ): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(date);
    } catch {
      return date.toISOString().split('T')[0];
    }
  }

  /**
   * Registra progresso de revisão na meta diária
   */
  async recordReviewProgress(
    userId: string,
    itemType: string = 'kanji',
    customTimezone?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    isCompleted: boolean;
    completedReviews: number;
    targetReviews: number;
  }> {
    const db = tx ?? this.prisma;

    // Buscar preferências do usuário
    const prefs = await db.userPreferences.findUnique({
      where: { userId },
    });

    const timezone = customTimezone || prefs?.timezone || 'America/Sao_Paulo';
    const goalDate = this.getLocalDateString(new Date(), timezone);

    const targetKanji = prefs?.dailyKanjiGoal ?? 10;
    const targetVocab = prefs?.dailyVocabGoal ?? 20;
    const targetReviews = prefs?.dailyReviewGoal ?? 50;
    const targetImmersionMins = prefs?.dailyImmersionGoal ?? 30;

    const isKanji = itemType.toLowerCase() === 'kanji';
    const isVocab = itemType.toLowerCase() === 'vocabulary';

    // Buscar ou criar o registro DailyGoal de hoje
    let dailyGoal = await db.dailyGoal.findUnique({
      where: {
        userId_goalDate: {
          userId,
          goalDate,
        },
      },
    });

    if (!dailyGoal) {
      dailyGoal = await db.dailyGoal.create({
        data: {
          userId,
          goalDate,
          timezone,
          targetKanji,
          targetVocab,
          targetReviews,
          targetImmersionMins,
          completedKanji: isKanji ? 1 : 0,
          completedVocab: isVocab ? 1 : 0,
          completedReviews: 1,
          completedImmersionMins: 0,
        },
      });
    } else {
      const newCompletedKanji = dailyGoal.completedKanji + (isKanji ? 1 : 0);
      const newCompletedVocab = dailyGoal.completedVocab + (isVocab ? 1 : 0);
      const newCompletedReviews = dailyGoal.completedReviews + 1;

      // Meta é considerada concluída quando atinge targetReviews OU as metas específicas de kanji/vocab
      const reachedTarget =
        newCompletedReviews >= dailyGoal.targetReviews ||
        (newCompletedKanji >= dailyGoal.targetKanji &&
          newCompletedVocab >= dailyGoal.targetVocab);

      const isCompleted = dailyGoal.isCompleted || reachedTarget;
      const completedAt =
        !dailyGoal.isCompleted && isCompleted
          ? new Date()
          : dailyGoal.completedAt;

      dailyGoal = await db.dailyGoal.update({
        where: { id: dailyGoal.id },
        data: {
          completedKanji: newCompletedKanji,
          completedVocab: newCompletedVocab,
          completedReviews: newCompletedReviews,
          isCompleted,
          completedAt,
        },
      });
    }

    this.logger.debug(
      `DailyGoal updated for user ${userId} on ${goalDate}: ${dailyGoal.completedReviews}/${dailyGoal.targetReviews} (completed: ${dailyGoal.isCompleted})`,
    );

    return {
      isCompleted: dailyGoal.isCompleted,
      completedReviews: dailyGoal.completedReviews,
      targetReviews: dailyGoal.targetReviews,
    };
  }
}
