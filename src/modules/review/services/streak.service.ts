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
   * Verifica se o dia está completo baseado nas tarefas do Planner
   * Regra: 80% das tarefas planejadas para o dia devem estar concluídas
   * Se não houver tarefas, retorna false (não conta como dia completo)
   */
  async isDayComplete(
    userId: string,
    dateStr: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const db = tx ?? this.prisma;

    const tasks = await db.plannerTask.findMany({
      where: {
        userId,
        date: dateStr,
      },
      select: {
        status: true,
      },
    });

    // Se não há tarefas, não conta como dia completo
    if (tasks.length === 0) {
      return false;
    }

    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const completionPercentage = (completedTasks / tasks.length) * 100;

    // Dia completo se 80% ou mais das tarefas foram concluídas
    return completionPercentage >= 80;
  }

  /**
   * Registra conclusão de tarefa do Planner e atualiza Streak se dia estiver completo
   * Este método é idempotente: não incrementa streak se já estiver completo no dia
   */
  async recordPlannerCompletion(
    userId: string,
    customTimezone?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    currentStreak: number;
    longestStreak: number;
    dayComplete: boolean;
  }> {
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

    // Verificar se o dia está completo
    const dayComplete = await this.isDayComplete(userId, todayStr, db);

    if (!dayComplete) {
      // Dia não está completo, não atualiza streak
      const streak = await db.streak.findUnique({
        where: { userId },
        select: { currentStreak: true, longestStreak: true },
      });
      return {
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        dayComplete: false,
      };
    }

    // Dia está completo, verificar se já registramos isso hoje (idempotência)
    const existingHistory = await db.streakHistory.findUnique({
      where: {
        userId_activityDate: {
          userId,
          activityDate: todayStr,
        },
      },
    });

    if (existingHistory && existingHistory.plannerTasksCompleted > 0) {
      // Já registramos conclusão do Planner hoje, retorna estado atual sem alterar
      const streak = await db.streak.findUnique({
        where: { userId },
        select: { currentStreak: true, longestStreak: true },
      });
      return {
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        dayComplete: true,
      };
    }

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

    // Atualizar / upsert StreakHistory para hoje com flag do Planner
    const tasks = await db.plannerTask.findMany({
      where: {
        userId,
        date: todayStr,
      },
      select: {
        status: true,
      },
    });

    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;

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
        plannerTasksCompleted: completedTasks,
        plannerTasksTotal: tasks.length,
      },
      update: {
        plannerTasksCompleted: completedTasks,
        plannerTasksTotal: tasks.length,
      },
    });

    this.logger.debug(
      `Planner streak updated for user ${userId}: current=${currentStreak}, longest=${longestStreak}, dayComplete=${dayComplete}, date=${todayStr}`,
    );

    return { currentStreak, longestStreak, dayComplete };
  }

  /**
   * Recalcula o streak após desfazer conclusão de tarefa
   * Verifica se o dia ainda está completo e ajusta o streak se necessário
   */
  async recalculateAfterUndo(
    userId: string,
    customTimezone?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    currentStreak: number;
    longestStreak: number;
    dayComplete: boolean;
  }> {
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

    // Verificar se o dia ainda está completo
    const dayComplete = await this.isDayComplete(userId, todayStr, db);

    if (!dayComplete) {
      // Dia não está mais completo, precisamos recalcular o streak
      // Para simplificar, não decrementamos o streak atual, apenas não marcamos como completo hoje
      // Em uma implementação mais complexa, poderíamos recalcular o histórico completo

      const streak = await db.streak.findUnique({
        where: { userId },
        select: { currentStreak: true, longestStreak: true },
      });

      // Atualizar StreakHistory para refletir que o dia não está mais completo
      await db.streakHistory
        .update({
          where: {
            userId_activityDate: {
              userId,
              activityDate: todayStr,
            },
          },
          data: {
            plannerTasksCompleted: 0,
          },
        })
        .catch(() => {
          // Se não existe registro, ignora
        });

      return {
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        dayComplete: false,
      };
    }

    // Dia ainda está completo, não há necessidade de alterar o streak
    const streak = await db.streak.findUnique({
      where: { userId },
      select: { currentStreak: true, longestStreak: true },
    });

    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      dayComplete: true,
    };
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
