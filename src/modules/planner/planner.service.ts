import { Injectable } from '@nestjs/common';
import { PrismaService } from '../auth/repositories/prisma.service';
import {
  PlannerHabitDto,
  PlannerOverviewResponseDto,
  PlannerSummaryDto,
  PlannerTaskDto,
  PlannerTaskDomain,
  PlannerTaskPriority,
  PlannerWeekDayDto,
  PlannerWeeklyGoalDto,
} from './dto';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getWeekdayName(date: Date): string {
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()];
}

function getMonthName(month: number): string {
  return [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ][month];
}

function weekNumber(startOfYear: Date, date: Date): number {
  const firstJanStart = startOfWeek(startOfYear);
  const weekStart = startOfWeek(date);
  const diffMs = weekStart.getTime() - firstJanStart.getTime();
  return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function priorityByCount(count: number): PlannerTaskPriority {
  if (count >= 30) return 'high';
  if (count >= 10) return 'medium';
  return 'low';
}

const WEEKDAY_NAMES_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

@Injectable()
export class PlannerService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string): Promise<PlannerOverviewResponseDto> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);

    const [
      dueKanjiCount,
      dueVocabCount,
      studiedGrammarCount,
      todayImmersionMinutes,
      weekImmersionMinutes,
      kanjiReviewedWeek,
      vocabReviewedWeek,
      reviewedWeek,
      totalGrammarCount,
      totalKanjiActive,
      totalVocabActive,
      streakRecord,
      todayReviewAnswers,
    ] = await Promise.all([
      this.prisma.userKanjiProgress.count({
        where: {
          userId,
          isSuspended: false,
          isMastered: false,
          nextReviewAt: { lte: todayEnd },
        },
      }),
      this.prisma.userVocabularyProgress.count({
        where: {
          userId,
          isSuspended: false,
          isMastered: false,
          nextReviewAt: { lte: todayEnd },
        },
      }),
      this.prisma.userGrammarProgress.count({
        where: { userId, isStudied: true },
      }),
      this.prisma.immersionLog.aggregate({
        where: {
          userId,
          isActive: true,
          loggedAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.immersionLog.aggregate({
        where: {
          userId,
          isActive: true,
          loggedAt: { gte: weekStart },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.streakHistory.aggregate({
        where: { userId, activityDate: { gte: this.dateStamp(weekStart) } },
        _sum: { kanjiReviewed: true },
      }),
      this.prisma.streakHistory.aggregate({
        where: { userId, activityDate: { gte: this.dateStamp(weekStart) } },
        _sum: { vocabReviewed: true },
      }),
      this.prisma.streakHistory.aggregate({
        where: { userId, activityDate: { gte: this.dateStamp(weekStart) } },
        _sum: { totalReviews: true },
      }),
      this.prisma.grammarPoint.count(),
      this.prisma.userKanjiProgress.count({
        where: { userId },
      }),
      this.prisma.userVocabularyProgress.count({
        where: { userId },
      }),
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.reviewAnswer.count({
        where: {
          session: { userId },
          answeredAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    const unstudiedGrammarCount = Math.max(0, totalGrammarCount - studiedGrammarCount);

    const immersionToday = todayImmersionMinutes._sum.durationMinutes ?? 0;
    const weekKanjiReviewed = kanjiReviewedWeek._sum.kanjiReviewed ?? 0;
    const weekVocabReviewed = vocabReviewedWeek._sum.vocabReviewed ?? 0;
    const weekGrammarReviews = reviewedWeek._sum.totalReviews ?? 0;
    const weekImmersion = weekImmersionMinutes._sum.durationMinutes ?? 0;

    const todayTasks: PlannerTaskDto[] = [];

    if (dueKanjiCount > 0) {
      todayTasks.push({
        id: `task-kanji-review-${userId}`,
        domain: 'kanji',
        task: `Revisar ${dueKanjiCount} kanji`,
        description: dueKanjiCount >= 50
          ? 'Fila grande, divida em blocos de 20 para manter o foco.'
          : 'Revisões pendentes do SRS (SM-2).',
        priority: priorityByCount(dueKanjiCount),
        estimatedMinutes: Math.max(5, Math.round(dueKanjiCount * 0.5)),
        kanjiGlyph: '字',
        dueAt: now.toISOString(),
        action: { type: 'review_kanji', count: dueKanjiCount },
      });
    }

    if (dueVocabCount > 0) {
      todayTasks.push({
        id: `task-vocab-review-${userId}`,
        domain: 'vocabulary',
        task: `Aprender / revisar ${dueVocabCount} palavras novas`,
        description: dueVocabCount >= 50
          ? 'Fila grande de vocabulário. Priorize palavras de alta frequência.'
          : 'Vocabulários pendentes no SRS.',
        priority: priorityByCount(dueVocabCount),
        estimatedMinutes: Math.max(10, Math.round(dueVocabCount * 2)),
        kanjiGlyph: '語',
        dueAt: now.toISOString(),
        action: { type: 'review_vocabulary', count: dueVocabCount },
      });
    }

    if (unstudiedGrammarCount > 0) {
      todayTasks.push({
        id: `task-grammar-study-${userId}`,
        domain: 'grammar',
        task: 'Estudar 1 ponto gramatical novo',
        description: unstudiedGrammarCount > 100
          ? `Restam ${unstudiedGrammarCount} pontos. Continue de onde parou.`
          : `Resta(m) ${unstudiedGrammarCount} ponto(s) gramatical(is) não estudado(s).`,
        priority: 'medium',
        estimatedMinutes: 25,
        kanjiGlyph: '文',
        dueAt: now.toISOString(),
        action: { type: 'study_grammar', count: Math.max(1, Math.min(unstudiedGrammarCount, 5)) },
      });
    }

    const IMMERSION_DAILY_TARGET = 30;
    if (immersionToday < IMMERSION_DAILY_TARGET) {
      const remaining = IMMERSION_DAILY_TARGET - immersionToday;
      todayTasks.push({
        id: `task-immersion-${userId}`,
        domain: 'immersion',
        task: 'Assistir 1 episódio de anime (ou equivalente)',
        description: immersionToday === 0
          ? 'Nenhuma imersão registrada hoje. 30 minutos mínimos recomendados.'
          : `Faltam ${remaining} minutos para bater a meta diária.`,
        priority: immersionToday === 0 ? 'medium' : 'low',
        estimatedMinutes: Math.min(30, Math.max(remaining, 24)),
        kanjiGlyph: '映',
        dueAt: now.toISOString(),
        action: {
          type: 'immersion',
          targetMinutes: IMMERSION_DAILY_TARGET,
          loggedMinutes: immersionToday,
        },
      });
    }

    if (todayTasks.length === 0) {
      todayTasks.push({
        id: `task-general-${userId}`,
        domain: 'general',
        task: 'Sentence mining (5 frases novas)',
        description:
          'Tudo em dia! Aproveite para extrair frases do seu material de imersão e adicionar ao deck.',
        priority: 'low',
        estimatedMinutes: 15,
        kanjiGlyph: '句',
        dueAt: now.toISOString(),
        action: { type: 'general', note: 'Sentence mining' },
      });
    }

    const tasksCompletedToday = 0;
    const tasksTotalToday = todayTasks.length;
    const studyMinutesToday =
      todayReviewAnswers * 1 + immersionToday;

    const currentStreak = streakRecord?.currentStreak ?? 0;
    const longestStreak = streakRecord?.longestStreak ?? 0;

    const weeklyGoals: PlannerWeeklyGoalDto[] = [
      {
        name: 'Tempo de Imersão',
        kanji: '時',
        current: weekImmersion,
        target: Math.max(300, weekImmersion + 120),
        unit: 'min',
      },
      {
        name: 'Kanji Revisados',
        kanji: '字',
        current: weekKanjiReviewed,
        target: Math.max(200, weekKanjiReviewed + 60),
        unit: '',
      },
      {
        name: 'Palavras Novas / Revisão',
        kanji: '語',
        current: weekVocabReviewed,
        target: Math.max(140, weekVocabReviewed + 40),
        unit: '',
      },
      {
        name: 'Revisões Gerais (Gramática inclusa)',
        kanji: '復',
        current: weekGrammarReviews,
        target: Math.max(350, weekGrammarReviews + 100),
        unit: '',
      },
    ];

    const habits: PlannerHabitDto[] = await Promise.all([
      this.buildHabit(
        userId,
        'Review SRS',
        '復',
        'general',
        weekStart,
        currentStreak,
        async (dayStart, dayEnd) => {
          const reviews = await this.prisma.reviewAnswer.count({
            where: { session: { userId }, answeredAt: { gte: dayStart, lte: dayEnd } },
          });
          return { completed: reviews >= 10, weeklyProgress: weekGrammarReviews + weekKanjiReviewed + weekVocabReviewed, target: Math.max(350, weekGrammarReviews + weekKanjiReviewed + weekVocabReviewed + 100) };
        },
      ),
      this.buildHabit(
        userId,
        'Estudar Kanji',
        '字',
        'kanji',
        weekStart,
        Math.max(0, currentStreak - 2),
        async (dayStart, dayEnd) => {
          const count = await this.prisma.reviewAnswer.count({
            where: {
              session: { userId },
              itemType: 'KANJI',
              answeredAt: { gte: dayStart, lte: dayEnd },
            },
          });
          return { completed: count >= 5, weeklyProgress: weekKanjiReviewed, target: Math.max(200, weekKanjiReviewed + 60) };
        },
      ),
      this.buildHabit(
        userId,
        'Imersão 30min',
        '聴',
        'immersion',
        weekStart,
        Math.max(0, currentStreak - 1),
        async (dayStart, dayEnd) => {
          const aggregate = await this.prisma.immersionLog.aggregate({
            where: {
              userId,
              isActive: true,
              loggedAt: { gte: dayStart, lte: dayEnd },
            },
            _sum: { durationMinutes: true },
          });
          const total = aggregate._sum.durationMinutes ?? 0;
          return { completed: total >= 30, weeklyProgress: weekImmersion, target: Math.max(300, weekImmersion + 120) };
        },
      ),
      this.buildHabit(
        userId,
        'Gramática',
        '文',
        'grammar',
        weekStart,
        Math.max(0, currentStreak - 3),
        async (dayStart, dayEnd) => {
          const studied = await this.prisma.userGrammarProgress.count({
            where: {
              userId,
              isStudied: true,
              studiedAt: { gte: dayStart, lte: dayEnd },
            },
          });
          return { completed: studied >= 1, weeklyProgress: weekGrammarReviews, target: Math.max(350, weekGrammarReviews + 100) };
        },
      ),
    ]);

    return {
      week: this.buildWeekDays(now),
      habits,
      todayTasks,
      weeklyGoals,
      summary: {
        tasksCompletedToday,
        tasksTotalToday,
        studyMinutesToday,
        currentStreakDays: currentStreak,
        longestStreakDays: longestStreak,
        todayDateLabel: `${WEEKDAY_NAMES_LONG[now.getDay()]}, ${now.getDate()} de ${getMonthName(now.getMonth())}`,
      },
    };
  }

  private async buildHabit(
    userId: string,
    name: string,
    kanji: string,
    domain: PlannerTaskDomain,
    weekStart: Date,
    streakFallback: number,
    resolver: (
      dayStart: Date,
      dayEnd: Date,
    ) => Promise<{ completed: boolean; weeklyProgress: number; target: number }>,
  ): Promise<PlannerHabitDto> {
    void userId;
    const completedThisWeek: boolean[] = [];
    let target = 7;
    for (let i = 0; i < 7; i++) {
      const current = new Date(weekStart);
      current.setDate(weekStart.getDate() + i);
      const dayStart = startOfDay(current);
      const dayEnd = endOfDay(current);
      const result = await resolver(dayStart, dayEnd);
      completedThisWeek.push(result.completed);
      target = result.target > 0 ? 7 : 7;
    }

    return {
      id: `habit-${domain}-${name}`,
      name,
      kanji,
      domain,
      streak: streakFallback,
      completedThisWeek,
      weeklyTarget: target,
    };
  }

  private buildWeekDays(now: Date): PlannerWeekDayDto[] {
    const weekStart = startOfWeek(now);
    const days: PlannerWeekDayDto[] = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(weekStart);
      current.setDate(weekStart.getDate() + i);
      days.push({
        date: current.getDate(),
        day: getWeekdayName(current),
        isToday: startOfDay(now).getTime() === startOfDay(current).getTime(),
      });
    }
    return days;
  }

  private dateStamp(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getWeekMetadata(now: Date): { month: string; week: number } {
    const month = getMonthName(now.getMonth());
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return {
      month: `${month} ${now.getFullYear()}`,
      week: weekNumber(startOfYear, now),
    };
  }
}
