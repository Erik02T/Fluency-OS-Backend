import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

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
      // Fallback para UTC caso o timezone seja inválido
      return date.toISOString().split('T')[0];
    }
  }

  /**
   * Calcula a diferença em dias entre duas strings de data YYYY-MM-DD
   */
  private getDaysDifference(prevDateStr: string, currDateStr: string): number {
    const prev = new Date(`${prevDateStr}T00:00:00Z`).getTime();
    const curr = new Date(`${currDateStr}T00:00:00Z`).getTime();
    const diffMs = curr - prev;
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  }

  /**
   * Registra atividade de revisão e atualiza Streak e StreakHistory
   */
  async recordActivity(
    userId: string,
    itemType: string = 'kanji',
    customTimezone?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ currentStreak: number; longestStreak: number }> {
    const db = tx ?? this.prisma;

    // Buscar timezone do usuário se não especificado
    let timezone = customTimezone;
    if (!timezone) {
      const prefs = await db.userPreferences.findUnique({
        where: { userId },
        select: { timezone: true },
      });
      timezone = prefs?.timezone || 'America/Sao_Paulo';
    }

    const todayStr = this.getLocalDateString(new Date(), timezone);

    // Buscar ou criar streak
    let streak = await db.streak.findUnique({
      where: { userId },
    });

    let currentStreak = 1;
    let longestStreak = 1;
    let totalActiveDays = 1;

    if (!streak) {
      streak = await db.streak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          totalActiveDays: 1,
          lastActivityDate: todayStr,
        },
      });
    } else {
      const lastDate = streak.lastActivityDate;

      if (!lastDate) {
        currentStreak = 1;
        longestStreak = Math.max(streak.longestStreak, 1);
        totalActiveDays = (streak.totalActiveDays || 0) + 1;
      } else if (lastDate === todayStr) {
        // Já realizou atividade hoje - mantém o streak atual
        currentStreak = streak.currentStreak;
        longestStreak = streak.longestStreak;
        totalActiveDays = streak.totalActiveDays;
      } else {
        const daysDiff = this.getDaysDifference(lastDate, todayStr);

        if (daysDiff === 1) {
          // Dia consecutivo
          currentStreak = streak.currentStreak + 1;
          longestStreak = Math.max(streak.longestStreak, currentStreak);
          totalActiveDays = streak.totalActiveDays + 1;
        } else if (daysDiff === 2 && streak.freezesAvailable > 0) {
          // Dia perdido protegido por Freeze
          currentStreak = streak.currentStreak + 1;
          longestStreak = Math.max(streak.longestStreak, currentStreak);
          totalActiveDays = streak.totalActiveDays + 1;

          await db.streak.update({
            where: { id: streak.id },
            data: {
              freezesAvailable: Math.max(0, streak.freezesAvailable - 1),
              freezesUsed: streak.freezesUsed + 1,
            },
          });
        } else {
          // Streak quebrado
          currentStreak = 1;
          longestStreak = Math.max(streak.longestStreak, 1);
          totalActiveDays = streak.totalActiveDays + 1;
        }
      }

      await db.streak.update({
        where: { id: streak.id },
        data: {
          currentStreak,
          longestStreak,
          totalActiveDays,
          lastActivityDate: todayStr,
        },
      });
    }

    // Atualizar / upsert StreakHistory para hoje
    const isKanji = itemType.toLowerCase() === 'kanji';
    const isVocab = itemType.toLowerCase() === 'vocabulary';

    await db.streakHistory.upsert({
      where: {
        userId_activityDate: {
          userId,
          activityDate: todayStr,
        },
      },
      create: {
        userId,
        streakId: streak.id,
        activityDate: todayStr,
        timezone,
        kanjiReviewed: isKanji ? 1 : 0,
        vocabReviewed: isVocab ? 1 : 0,
        totalReviews: 1,
      },
      update: {
        kanjiReviewed: isKanji ? { increment: 1 } : undefined,
        vocabReviewed: isVocab ? { increment: 1 } : undefined,
        totalReviews: { increment: 1 },
      },
    });

    this.logger.debug(
      `Streak updated for user ${userId}: current=${currentStreak}, longest=${longestStreak}, date=${todayStr}`,
    );

    return { currentStreak, longestStreak };
  }
}
