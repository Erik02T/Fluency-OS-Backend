import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  PlannerCategory,
  PlannerGoalCategory,
  PlannerTask,
  PlannerTaskPriority as PrismaTaskPriority,
  PlannerTaskStatus,
  WeeklyPlan,
  WeeklyPlanStatus,
} from '@prisma/client';
import { PrismaService } from '../auth/repositories/prisma.service';
import { StreakService } from '../review/services/streak.service';
import {
  CreatePlannerTaskDto,
  GetPlannerTasksQueryDto,
  PlannerHabitDto,
  PlannerOverviewResponseDto,
  PlannerTaskDto,
  PlannerTaskDomain,
  PlannerTaskItemResponseDto,
  PlannerTaskPriority,
  PlannerWeekDayDto,
  PlannerWeeklyGoalDto,
  TodaySummaryResponseDto,
  TogglePlannerTaskDto,
  UpdatePlannerTaskDto,
  UpdateWeeklyGoalsDto,
  UpdateWeeklyPlanDto,
  WeeklyGoalResponseDto,
  WeeklyPlanResponseDto,
} from './dto';

export const GOAL_METADATA: Record<
  PlannerGoalCategory,
  {
    name: string;
    kanjiGlyph: string;
    defaultUnit: string;
    defaultTarget: number;
  }
> = {
  [PlannerGoalCategory.IMMERSION]: {
    name: 'Tempo de Imersão',
    kanjiGlyph: '時',
    defaultUnit: 'min',
    defaultTarget: 300,
  },
  [PlannerGoalCategory.KANJI]: {
    name: 'Kanji Revisados',
    kanjiGlyph: '字',
    defaultUnit: '',
    defaultTarget: 200,
  },
  [PlannerGoalCategory.VOCABULARY]: {
    name: 'Palavras Novas / Revisão',
    kanjiGlyph: '語',
    defaultUnit: '',
    defaultTarget: 140,
  },
  [PlannerGoalCategory.GENERAL_REVIEW]: {
    name: 'Revisões Gerais (Gramática inclusa)',
    kanjiGlyph: '復',
    defaultUnit: '',
    defaultTarget: 350,
  },
  [PlannerGoalCategory.GRAMMAR]: {
    name: 'Pontos Gramaticais',
    kanjiGlyph: '文',
    defaultUnit: '',
    defaultTarget: 7,
  },
  [PlannerGoalCategory.READING]: {
    name: 'Leitura',
    kanjiGlyph: '読',
    defaultUnit: 'min',
    defaultTarget: 60,
  },
  [PlannerGoalCategory.ACTIVE_STUDY]: {
    name: 'Estudo Ativo',
    kanjiGlyph: '学',
    defaultUnit: 'min',
    defaultTarget: 120,
  },
  [PlannerGoalCategory.PASSIVE_STUDY]: {
    name: 'Estudo Passivo',
    kanjiGlyph: '聴',
    defaultUnit: 'min',
    defaultTarget: 180,
  },
};

export const CATEGORY_METADATA: Record<
  PlannerCategory,
  { name: string; kanjiGlyph: string; domain: PlannerTaskDomain }
> = {
  [PlannerCategory.KANJI]: { name: 'Kanji', kanjiGlyph: '字', domain: 'kanji' },
  [PlannerCategory.VOCABULARY]: {
    name: 'Vocabulário',
    kanjiGlyph: '語',
    domain: 'vocabulary',
  },
  [PlannerCategory.GRAMMAR]: {
    name: 'Gramática',
    kanjiGlyph: '文',
    domain: 'grammar',
  },
  [PlannerCategory.CHUNK]: {
    name: 'Chunks & Expressões',
    kanjiGlyph: '塊',
    domain: 'vocabulary',
  },
  [PlannerCategory.READING]: {
    name: 'Leitura',
    kanjiGlyph: '読',
    domain: 'general',
  },
  [PlannerCategory.IMMERSION]: {
    name: 'Imersão',
    kanjiGlyph: '映',
    domain: 'immersion',
  },
  [PlannerCategory.ACTIVE_STUDY]: {
    name: 'Estudo Ativo',
    kanjiGlyph: '学',
    domain: 'general',
  },
  [PlannerCategory.PASSIVE_STUDY]: {
    name: 'Estudo Passivo',
    kanjiGlyph: '聴',
    domain: 'immersion',
  },
  [PlannerCategory.REVIEW]: {
    name: 'Revisão Geral',
    kanjiGlyph: '復',
    domain: 'general',
  },
  [PlannerCategory.GENERAL]: {
    name: 'Geral',
    kanjiGlyph: '全',
    domain: 'general',
  },
  [PlannerCategory.OTHER]: {
    name: 'Outro',
    kanjiGlyph: '他',
    domain: 'general',
  },
};

function toDateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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

export function getMondayAndSunday(date: Date): { monday: Date; sunday: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

export function getIsoWeekAndYear(date: Date): {
  year: number;
  weekNumber: number;
} {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber =
    1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return { year, weekNumber };
}

export function getDateRangeFromIsoWeek(
  year: number,
  weekNumber: number,
): { monday: Date; sunday: Date } {
  const simple = new Date(year, 0, 1 + (weekNumber - 1) * 7);
  const dayOfWeek = simple.getDay();
  const ISOweekStart = new Date(simple);
  if (dayOfWeek <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  ISOweekStart.setHours(0, 0, 0, 0);

  const sunday = new Date(ISOweekStart);
  sunday.setDate(ISOweekStart.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday: ISOweekStart, sunday };
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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly streakService?: StreakService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════════
  // MÓDULO 1: PLANEJAMENTO SEMANAL & METAS
  // ══════════════════════════════════════════════════════════════════════════════

  async getOrCreateWeeklyPlan(
    userId: string,
    targetDateStr?: string,
    queryYear?: number,
    queryWeekNumber?: number,
  ): Promise<WeeklyPlanResponseDto> {
    let monday: Date;
    let sunday: Date;
    let year: number;
    let weekNumber: number;

    if (queryYear && queryWeekNumber) {
      year = queryYear;
      weekNumber = queryWeekNumber;
      const range = getDateRangeFromIsoWeek(year, weekNumber);
      monday = range.monday;
      sunday = range.sunday;
    } else {
      const refDate = targetDateStr
        ? new Date(`${targetDateStr}T12:00:00`)
        : new Date();
      const range = getMondayAndSunday(refDate);
      monday = range.monday;
      sunday = range.sunday;
      const iso = getIsoWeekAndYear(refDate);
      year = iso.year;
      weekNumber = iso.weekNumber;
    }

    const startDate = toDateStamp(monday);
    const endDate = toDateStamp(sunday);

    let plan = await this.prisma.weeklyPlan.findUnique({
      where: {
        userId_year_weekNumber: {
          userId,
          year,
          weekNumber,
        },
      },
      include: {
        goals: true,
      },
    });

    if (!plan) {
      const prefs = await this.prisma.userPreferences.findUnique({
        where: { userId },
      });

      const defaultGoals = [
        {
          category: PlannerGoalCategory.IMMERSION,
          targetValue: Math.max(300, (prefs?.dailyImmersionGoal ?? 30) * 7),
          unit: 'min',
        },
        {
          category: PlannerGoalCategory.KANJI,
          targetValue: Math.max(200, (prefs?.dailyKanjiGoal ?? 10) * 7),
          unit: '',
        },
        {
          category: PlannerGoalCategory.VOCABULARY,
          targetValue: Math.max(140, (prefs?.dailyVocabGoal ?? 20) * 7),
          unit: '',
        },
        {
          category: PlannerGoalCategory.GENERAL_REVIEW,
          targetValue: Math.max(350, (prefs?.dailyReviewGoal ?? 50) * 7),
          unit: '',
        },
      ];

      plan = await this.prisma.weeklyPlan.create({
        data: {
          userId,
          year,
          weekNumber,
          startDate,
          endDate,
          status: WeeklyPlanStatus.ACTIVE,
          goals: {
            create: defaultGoals,
          },
        },
        include: {
          goals: true,
        },
      });
    }

    return this.buildWeeklyPlanResponse(userId, plan, monday, sunday);
  }

  async updateWeeklyGoals(
    userId: string,
    planId: string,
    dto: UpdateWeeklyGoalsDto,
  ): Promise<WeeklyPlanResponseDto> {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Planejamento semanal não encontrado.');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar as metas deste planejamento.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.goals) {
        const metadata = GOAL_METADATA[item.category];
        await tx.weeklyGoal.upsert({
          where: {
            weeklyPlanId_category: {
              weeklyPlanId: planId,
              category: item.category,
            },
          },
          create: {
            weeklyPlanId: planId,
            category: item.category,
            targetValue: item.targetValue,
            unit: item.unit ?? metadata.defaultUnit,
          },
          update: {
            targetValue: item.targetValue,
            unit: item.unit ?? metadata.defaultUnit,
          },
        });
      }
    });

    const updatedPlan = await this.prisma.weeklyPlan.findUniqueOrThrow({
      where: { id: planId },
      include: { goals: true },
    });

    const monday = new Date(`${updatedPlan.startDate}T00:00:00`);
    const sunday = new Date(`${updatedPlan.endDate}T23:59:59`);

    return this.buildWeeklyPlanResponse(userId, updatedPlan, monday, sunday);
  }

  async updateWeeklyPlan(
    userId: string,
    planId: string,
    dto: UpdateWeeklyPlanDto,
  ): Promise<WeeklyPlanResponseDto> {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Planejamento semanal não encontrado.');
    }

    if (plan.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar este planejamento.',
      );
    }

    const updated = await this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: {
        status: dto.status,
        notes: dto.notes,
      },
      include: { goals: true },
    });

    const monday = new Date(`${updated.startDate}T00:00:00`);
    const sunday = new Date(`${updated.endDate}T23:59:59`);

    return this.buildWeeklyPlanResponse(userId, updated, monday, sunday);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MÓDULO 2: CRUD DE TAREFAS
  // ══════════════════════════════════════════════════════════════════════════════

  async createTask(
    userId: string,
    dto: CreatePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    // Associar ao WeeklyPlan da data, caso exista
    const targetDate = new Date(`${dto.date}T12:00:00`);
    const { year, weekNumber } = getIsoWeekAndYear(targetDate);

    const weeklyPlan = await this.prisma.weeklyPlan.findUnique({
      where: {
        userId_year_weekNumber: {
          userId,
          year,
          weekNumber,
        },
      },
      select: { id: true },
    });

    const task = await this.prisma.plannerTask.create({
      data: {
        userId,
        weeklyPlanId: weeklyPlan?.id,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category ?? PlannerCategory.GENERAL,
        date: dto.date,
        scheduledTime: dto.scheduledTime || null,
        estimatedMinutes: dto.estimatedMinutes ?? 15,
        priority: dto.priority ?? PrismaTaskPriority.MEDIUM,
        status: PlannerTaskStatus.PENDING,
      },
    });

    return this.toTaskResponseDto(task);
  }

  async getTasks(
    userId: string,
    query: GetPlannerTasksQueryDto,
  ): Promise<PlannerTaskItemResponseDto[]> {
    const whereClause: Record<string, unknown> = { userId };

    if (query.date) {
      whereClause.date = query.date;
    } else if (query.startDate && query.endDate) {
      whereClause.date = { gte: query.startDate, lte: query.endDate };
    } else if (query.startDate) {
      whereClause.date = { gte: query.startDate };
    } else if (query.endDate) {
      whereClause.date = { lte: query.endDate };
    }

    if (query.status) {
      whereClause.status = query.status;
    }

    if (query.category) {
      whereClause.category = query.category;
    }

    const tasks = await this.prisma.plannerTask.findMany({
      where: whereClause,
      orderBy: [
        { date: 'asc' },
        { scheduledTime: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return tasks.map((t) => this.toTaskResponseDto(t));
  }

  async updateTask(
    userId: string,
    taskId: string,
    dto: UpdatePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    const existing = await this.prisma.plannerTask.findUnique({
      where: { id: taskId },
    });

    if (!existing) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para editar esta tarefa.',
      );
    }

    let weeklyPlanId = existing.weeklyPlanId;
    if (dto.date && dto.date !== existing.date) {
      const targetDate = new Date(`${dto.date}T12:00:00`);
      const { year, weekNumber } = getIsoWeekAndYear(targetDate);
      const plan = await this.prisma.weeklyPlan.findUnique({
        where: {
          userId_year_weekNumber: {
            userId,
            year,
            weekNumber,
          },
        },
        select: { id: true },
      });
      weeklyPlanId = plan?.id ?? null;
    }

    let completedAt = existing.completedAt;
    if (dto.status) {
      if (dto.status === PlannerTaskStatus.COMPLETED && !existing.completedAt) {
        completedAt = new Date();
      } else if (dto.status === PlannerTaskStatus.PENDING) {
        completedAt = null;
      }
    }

    const updated = await this.prisma.plannerTask.update({
      where: { id: taskId },
      data: {
        title: dto.title !== undefined ? dto.title.trim() : undefined,
        description:
          dto.description !== undefined
            ? dto.description.trim() || null
            : undefined,
        category: dto.category,
        date: dto.date,
        scheduledTime:
          dto.scheduledTime !== undefined
            ? dto.scheduledTime || null
            : undefined,
        estimatedMinutes: dto.estimatedMinutes,
        actualMinutes: dto.actualMinutes,
        priority: dto.priority,
        status: dto.status,
        completedAt,
        weeklyPlanId,
      },
    });

    return this.toTaskResponseDto(updated);
  }

  async deleteTask(
    userId: string,
    taskId: string,
  ): Promise<{ success: boolean; id: string }> {
    const existing = await this.prisma.plannerTask.findUnique({
      where: { id: taskId },
    });

    if (!existing) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para excluir esta tarefa.',
      );
    }

    await this.prisma.plannerTask.delete({
      where: { id: taskId },
    });

    return { success: true, id: taskId };
  }

  async toggleTaskCompletion(
    userId: string,
    taskId: string,
    dto?: TogglePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    const existing = await this.prisma.plannerTask.findUnique({
      where: { id: taskId },
    });

    if (!existing) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para alterar esta tarefa.',
      );
    }

    const nextCompleted =
      dto?.completed !== undefined
        ? dto.completed
        : existing.status !== PlannerTaskStatus.COMPLETED;

    const nextStatus = nextCompleted
      ? PlannerTaskStatus.COMPLETED
      : PlannerTaskStatus.PENDING;
    const completedAt = nextCompleted ? new Date() : null;
    const actualMinutes = nextCompleted
      ? (dto?.actualMinutes ??
        existing.actualMinutes ??
        existing.estimatedMinutes)
      : null;

    const updated = await this.prisma.plannerTask.update({
      where: { id: taskId },
      data: {
        status: nextStatus,
        completedAt,
        actualMinutes,
      },
    });

    // Atualizar streak baseado no Planner após conclusão/desfazer
    if (this.streakService) {
      if (nextCompleted) {
        // Tarefa foi concluída - verificar se o dia está completo
        await this.streakService.recordPlannerCompletion(userId);
      } else {
        // Tarefa foi desfeita - recalcular streak
        await this.streakService.recalculateAfterUndo(userId);
      }
    }

    return this.toTaskResponseDto(updated);
  }

  private toTaskResponseDto(task: PlannerTask): PlannerTaskItemResponseDto {
    const metadata =
      CATEGORY_METADATA[task.category] ||
      CATEGORY_METADATA[PlannerCategory.GENERAL];
    return {
      id: task.id,
      userId: task.userId,
      weeklyPlanId: task.weeklyPlanId,
      title: task.title,
      description: task.description,
      category: task.category,
      categoryLabel: metadata.name,
      kanjiGlyph: metadata.kanjiGlyph,
      date: task.date,
      scheduledTime: task.scheduledTime,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      priority: task.priority,
      status: task.status,
      completedAt: task.completedAt?.toISOString() || null,
      isAutoGenerated: task.isAutoGenerated,
      actionPayload: (task.actionPayload as Record<string, unknown>) || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // MÓDULO 3: OVERVIEW & RESUMO
  // ══════════════════════════════════════════════════════════════════════════════

  private async buildWeeklyPlanResponse(
    userId: string,
    plan: WeeklyPlan & {
      goals: {
        id: string;
        category: PlannerGoalCategory;
        targetValue: number;
        unit: string;
      }[];
    },
    monday: Date,
    sunday: Date,
  ): Promise<WeeklyPlanResponseDto> {
    const startDateStr = plan.startDate;
    const endDateStr = plan.endDate;
    const startDateTime = startOfDay(monday);
    const endDateTime = endOfDay(sunday);

    const [
      immersionAggregate,
      readingAggregate,
      streakHistoryAggregate,
      studiedGrammarCount,
    ] = await Promise.all([
      this.prisma.immersionLog.aggregate({
        where: {
          userId,
          isActive: true,
          loggedAt: { gte: startDateTime, lte: endDateTime },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.immersionLog.aggregate({
        where: {
          userId,
          isActive: true,
          type: { in: ['MANGA', 'NOVEL', 'NEWS'] },
          loggedAt: { gte: startDateTime, lte: endDateTime },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.streakHistory.aggregate({
        where: {
          userId,
          activityDate: { gte: startDateStr, lte: endDateStr },
        },
        _sum: {
          kanjiReviewed: true,
          vocabReviewed: true,
          totalReviews: true,
        },
      }),
      this.prisma.userGrammarProgress.count({
        where: {
          userId,
          isStudied: true,
          studiedAt: { gte: startDateTime, lte: endDateTime },
        },
      }),
    ]);

    const weekImmersion = immersionAggregate._sum.durationMinutes ?? 0;
    const weekReading = readingAggregate._sum.durationMinutes ?? 0;
    const weekKanji = streakHistoryAggregate._sum.kanjiReviewed ?? 0;
    const weekVocab = streakHistoryAggregate._sum.vocabReviewed ?? 0;
    const weekGeneralReviews = streakHistoryAggregate._sum.totalReviews ?? 0;

    const goalsResponse: WeeklyGoalResponseDto[] = plan.goals.map((g) => {
      const metadata = GOAL_METADATA[g.category];
      let currentValue = 0;

      switch (g.category) {
        case PlannerGoalCategory.IMMERSION:
          currentValue = weekImmersion;
          break;
        case PlannerGoalCategory.KANJI:
          currentValue = weekKanji;
          break;
        case PlannerGoalCategory.VOCABULARY:
          currentValue = weekVocab;
          break;
        case PlannerGoalCategory.GENERAL_REVIEW:
          currentValue = weekGeneralReviews;
          break;
        case PlannerGoalCategory.GRAMMAR:
          currentValue = studiedGrammarCount;
          break;
        case PlannerGoalCategory.READING:
          currentValue = weekReading;
          break;
        case PlannerGoalCategory.ACTIVE_STUDY:
          currentValue = weekImmersion;
          break;
        case PlannerGoalCategory.PASSIVE_STUDY:
          currentValue = weekImmersion;
          break;
      }

      const percentage =
        g.targetValue > 0
          ? Math.min(100, Math.round((currentValue / g.targetValue) * 100))
          : 0;

      return {
        id: g.id,
        category: g.category,
        name: metadata.name,
        kanjiGlyph: metadata.kanjiGlyph,
        targetValue: g.targetValue,
        currentValue,
        percentage,
        unit: g.unit,
      };
    });

    return {
      id: plan.id,
      userId: plan.userId,
      year: plan.year,
      weekNumber: plan.weekNumber,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: plan.status,
      notes: plan.notes,
      goals: goalsResponse,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  async getOverview(
    userId: string,
    targetDateStr?: string,
  ): Promise<PlannerOverviewResponseDto> {
    const now = targetDateStr
      ? new Date(`${targetDateStr}T12:00:00`)
      : new Date();
    const todayDateStr = toDateStamp(now);
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const { monday: weekStart } = getMondayAndSunday(now);

    // Carregar plano semanal persistido com metas
    const weeklyPlan = await this.getOrCreateWeeklyPlan(userId, targetDateStr);

    const [
      persistentTasks,
      dueKanjiCount,
      dueVocabCount,
      studiedGrammarCount,
      todayImmersionMinutes,
      totalGrammarCount,
      streakRecord,
      todayReviewAnswers,
      userPrefs,
    ] = await Promise.all([
      this.prisma.plannerTask.findMany({
        where: { userId, date: todayDateStr },
        orderBy: [{ scheduledTime: 'asc' }, { createdAt: 'asc' }],
      }),
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
      this.prisma.grammarPoint.count(),
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.reviewAnswer.count({
        where: {
          session: { userId },
          answeredAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      this.prisma.userPreferences.findUnique({
        where: { userId },
        select: { timezone: true },
      }),
    ]);

    const unstudiedGrammarCount = Math.max(
      0,
      totalGrammarCount - studiedGrammarCount,
    );

    const immersionToday = todayImmersionMinutes._sum.durationMinutes ?? 0;
    // Unused variables removed as they were only used for hardcoded habits
    // const weekKanjiReviewed = kanjiReviewedWeek._sum.kanjiReviewed ?? 0;
    // const weekVocabReviewed = vocabReviewedWeek._sum.vocabReviewed ?? 0;
    // const weekGrammarReviews = reviewedWeek._sum.totalReviews ?? 0;

    let todayTasks: PlannerTaskDto[] = [];

    if (persistentTasks.length > 0) {
      todayTasks = persistentTasks.map((t) => {
        const meta =
          CATEGORY_METADATA[t.category] ||
          CATEGORY_METADATA[PlannerCategory.GENERAL];
        const priorityLower = (
          t.priority ? t.priority.toLowerCase() : 'medium'
        ) as PlannerTaskPriority;
        return {
          id: t.id,
          domain: meta.domain,
          task: t.title,
          description: t.description,
          priority: priorityLower,
          estimatedMinutes: t.estimatedMinutes,
          kanjiGlyph: meta.kanjiGlyph,
          dueAt: t.scheduledTime
            ? `${t.date}T${t.scheduledTime}:00`
            : `${t.date}T23:59:59`,
          status: t.status,
          completed: t.status === PlannerTaskStatus.COMPLETED,
          action: { type: 'general', note: meta.name },
        };
      });
    } else {
      // Recomendações dinâmicas quando nenhuma tarefa personalizada foi criada para hoje
      if (dueKanjiCount > 0) {
        todayTasks.push({
          id: `task-kanji-review-${userId}`,
          domain: 'kanji',
          task: `Revisar ${dueKanjiCount} kanji`,
          description:
            dueKanjiCount >= 50
              ? 'Fila grande, divida em blocos de 20 para manter o foco.'
              : 'Revisões pendentes do SRS (SM-2).',
          priority: priorityByCount(dueKanjiCount),
          estimatedMinutes: Math.max(5, Math.round(dueKanjiCount * 0.5)),
          kanjiGlyph: '字',
          dueAt: now.toISOString(),
          status: PlannerTaskStatus.PENDING,
          completed: false,
          action: { type: 'review_kanji', count: dueKanjiCount },
        });
      }

      if (dueVocabCount > 0) {
        todayTasks.push({
          id: `task-vocab-review-${userId}`,
          domain: 'vocabulary',
          task: `Aprender / revisar ${dueVocabCount} palavras novas`,
          description:
            dueVocabCount >= 50
              ? 'Fila grande de vocabulário. Priorize palavras de alta frequência.'
              : 'Vocabulários pendentes no SRS.',
          priority: priorityByCount(dueVocabCount),
          estimatedMinutes: Math.max(10, Math.round(dueVocabCount * 2)),
          kanjiGlyph: '語',
          dueAt: now.toISOString(),
          status: PlannerTaskStatus.PENDING,
          completed: false,
          action: { type: 'review_vocabulary', count: dueVocabCount },
        });
      }

      if (unstudiedGrammarCount > 0) {
        todayTasks.push({
          id: `task-grammar-study-${userId}`,
          domain: 'grammar',
          task: 'Estudar 1 ponto gramatical novo',
          description:
            unstudiedGrammarCount > 100
              ? `Restam ${unstudiedGrammarCount} pontos. Continue de onde parou.`
              : `Resta(m) ${unstudiedGrammarCount} ponto(s) gramatical(is) não estudado(s).`,
          priority: 'medium',
          estimatedMinutes: 25,
          kanjiGlyph: '文',
          dueAt: now.toISOString(),
          status: PlannerTaskStatus.PENDING,
          completed: false,
          action: {
            type: 'study_grammar',
            count: Math.max(1, Math.min(unstudiedGrammarCount, 5)),
          },
        });
      }

      const IMMERSION_DAILY_TARGET = 30;
      if (immersionToday < IMMERSION_DAILY_TARGET) {
        const remaining = IMMERSION_DAILY_TARGET - immersionToday;
        todayTasks.push({
          id: `task-immersion-${userId}`,
          domain: 'immersion',
          task: 'Assistir 1 episódio de anime (ou equivalente)',
          description:
            immersionToday === 0
              ? 'Nenhuma imersão registrada hoje. 30 minutos mínimos recomendados.'
              : `Faltam ${remaining} minutos para bater a meta diária.`,
          priority: immersionToday === 0 ? 'medium' : 'low',
          estimatedMinutes: Math.min(30, Math.max(remaining, 24)),
          kanjiGlyph: '映',
          dueAt: now.toISOString(),
          status: PlannerTaskStatus.PENDING,
          completed: false,
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
          status: PlannerTaskStatus.PENDING,
          completed: false,
          action: { type: 'general', note: 'Sentence mining' },
        });
      }
    }

    const tasksCompletedToday =
      persistentTasks.length > 0
        ? persistentTasks.filter(
            (t) => t.status === PlannerTaskStatus.COMPLETED,
          ).length
        : 0;
    const tasksTotalToday =
      persistentTasks.length > 0 ? persistentTasks.length : todayTasks.length;
    const tasksPendingToday = Math.max(
      0,
      tasksTotalToday - tasksCompletedToday,
    );
    const completionPercentage =
      tasksTotalToday > 0
        ? Math.min(
            100,
            Math.round((tasksCompletedToday / tasksTotalToday) * 100),
          )
        : 0;

    const manualTasksCompletedMinutes = persistentTasks
      .filter(
        (t) =>
          t.status === PlannerTaskStatus.COMPLETED &&
          t.category !== PlannerCategory.IMMERSION,
      )
      .reduce((acc, t) => acc + (t.actualMinutes ?? t.estimatedMinutes), 0);

    const manualImmersionMinutes = persistentTasks
      .filter(
        (t) =>
          t.status === PlannerTaskStatus.COMPLETED &&
          t.category === PlannerCategory.IMMERSION,
      )
      .reduce((acc, t) => acc + (t.actualMinutes ?? t.estimatedMinutes), 0);

    const effectiveImmersionMinutes = Math.max(
      immersionToday,
      manualImmersionMinutes,
    );
    const srsMinutesToday = Math.round(todayReviewAnswers * 0.5);

    const studyMinutesToday =
      effectiveImmersionMinutes + srsMinutesToday + manualTasksCompletedMinutes;

    const categoriesStudiedSet = new Set<string>();
    if (immersionToday > 0 || manualImmersionMinutes > 0)
      categoriesStudiedSet.add('IMMERSION');
    if (todayReviewAnswers > 0) categoriesStudiedSet.add('REVIEW');
    for (const task of persistentTasks) {
      if (task.status === PlannerTaskStatus.COMPLETED) {
        categoriesStudiedSet.add(task.category);
      }
    }
    const categoriesStudiedToday = Array.from(categoriesStudiedSet);

    const currentStreak = streakRecord?.currentStreak ?? 0;
    const longestStreak = streakRecord?.longestStreak ?? 0;

    const weeklyGoals: PlannerWeeklyGoalDto[] = weeklyPlan.goals.map((g) => ({
      name: g.name,
      kanji: g.kanjiGlyph,
      current: g.currentValue,
      target: g.targetValue,
      unit: g.unit,
    }));

    // Usar timezone do usuário para detecção de hábitos
    const userTimezone = userPrefs?.timezone || 'America/Sao_Paulo';

    // Detectar hábitos baseados no histórico de tarefas (data-driven)
    const habits = await this.detectHabitsFromTasks(
      userId,
      weekStart,
      userTimezone,
    );

    return {
      week: this.buildWeekDays(now),
      habits,
      todayTasks,
      weeklyGoals,
      summary: {
        tasksCompletedToday,
        tasksPendingToday,
        tasksTotalToday,
        completionPercentage,
        studyMinutesToday,
        categoriesStudiedToday,
        currentStreakDays: currentStreak,
        longestStreakDays: longestStreak,
        todayDateLabel: `${WEEKDAY_NAMES_LONG[now.getDay()]}, ${now.getDate()} de ${getMonthName(now.getMonth())}`,
      },
    };
  }

  async getTodaySummary(userId: string): Promise<TodaySummaryResponseDto> {
    const now = new Date();
    const todayDateStr = toDateStamp(now);
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const [
      persistentTasks,
      todayImmersionMinutes,
      streakRecord,
      todayReviewAnswers,
    ] = await Promise.all([
      this.prisma.plannerTask.findMany({
        where: { userId, date: todayDateStr },
      }),
      this.prisma.immersionLog.aggregate({
        where: {
          userId,
          isActive: true,
          loggedAt: { gte: todayStart, lte: todayEnd },
        },
        _sum: { durationMinutes: true },
      }),
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.reviewAnswer.count({
        where: {
          session: { userId },
          answeredAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    const totalTasks = persistentTasks.length;
    const completedTasks = persistentTasks.filter(
      (t) => t.status === PlannerTaskStatus.COMPLETED,
    ).length;
    const pendingTasks = Math.max(0, totalTasks - completedTasks);
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const manualTasksCompletedMinutes = persistentTasks
      .filter(
        (t) =>
          t.status === PlannerTaskStatus.COMPLETED &&
          t.category !== PlannerCategory.IMMERSION,
      )
      .reduce((acc, t) => acc + (t.actualMinutes ?? t.estimatedMinutes), 0);

    const manualImmersionMinutes = persistentTasks
      .filter(
        (t) =>
          t.status === PlannerTaskStatus.COMPLETED &&
          t.category === PlannerCategory.IMMERSION,
      )
      .reduce((acc, t) => acc + (t.actualMinutes ?? t.estimatedMinutes), 0);

    const immersionToday = todayImmersionMinutes._sum.durationMinutes ?? 0;
    const effectiveImmersionMinutes = Math.max(
      immersionToday,
      manualImmersionMinutes,
    );
    const srsMinutesToday = Math.round(todayReviewAnswers * 0.5);

    const minutesStudied =
      effectiveImmersionMinutes + srsMinutesToday + manualTasksCompletedMinutes;

    const categoriesStudiedSet = new Set<string>();
    if (immersionToday > 0 || manualImmersionMinutes > 0)
      categoriesStudiedSet.add('IMMERSION');
    if (todayReviewAnswers > 0) categoriesStudiedSet.add('REVIEW');
    for (const task of persistentTasks) {
      if (task.status === PlannerTaskStatus.COMPLETED) {
        categoriesStudiedSet.add(task.category);
      }
    }
    const categoriesStudied = Array.from(categoriesStudiedSet);

    const streak = streakRecord?.currentStreak ?? 0;

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      completionPercentage,
      minutesStudied,
      categoriesStudied,
      streak,
    };
  }

  /**
   * Detecta hábitos baseados no histórico de tarefas concluídas do usuário
   * Algoritmo determinístico: mesma categoria + mesma faixa de horário + frequência mínima
   */
  private async detectHabitsFromTasks(
    userId: string,
    weekStart: Date,
    timezone: string,
  ): Promise<PlannerHabitDto[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Buscar tarefas concluídas nos últimos 30 dias
    const completedTasks = await this.prisma.plannerTask.findMany({
      where: {
        userId,
        status: PlannerTaskStatus.COMPLETED,
        completedAt: { gte: thirtyDaysAgo },
      },
      select: {
        category: true,
        scheduledTime: true,
        completedAt: true,
        date: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    if (completedTasks.length === 0) {
      return [];
    }

    // Agrupar tarefas por categoria e faixa de horário
    const habitGroups = new Map<
      string,
      {
        category: PlannerCategory;
        timeRange: string;
        count: number;
        tasks: Date[];
      }
    >();

    for (const task of completedTasks) {
      const timeRange = this.getTimeRange(
        task.scheduledTime,
        task.completedAt,
        timezone,
      );
      const key = `${task.category}-${timeRange}`;

      const existing = habitGroups.get(key);
      if (existing) {
        existing.count++;
        existing.tasks.push(task.completedAt!);
      } else {
        habitGroups.set(key, {
          category: task.category,
          timeRange,
          count: 1,
          tasks: [task.completedAt!],
        });
      }
    }

    // Filtrar grupos com frequência mínima (5 ocorrências)
    const MINIMUM_OCCURRENCES = 5;
    const validHabits = Array.from(habitGroups.values()).filter(
      (group) => group.count >= MINIMUM_OCCURRENCES,
    );

    if (validHabits.length === 0) {
      return [];
    }

    // Converter para PlannerHabitDto
    const habits: PlannerHabitDto[] = [];

    for (const habit of validHabits) {
      const metadata =
        CATEGORY_METADATA[habit.category] ||
        CATEGORY_METADATA[PlannerCategory.GENERAL];
      const timeRangeLabel = this.getTimeRangeLabel(habit.timeRange);
      const habitName = `${metadata.name} (${timeRangeLabel})`;

      // Calcular streak baseado nos últimos 30 dias
      const streak = this.calculateHabitStreak(habit.tasks, timezone);

      // Calcular conclusão da semana atual
      const completedThisWeek = await this.calculateWeeklyCompletion(
        userId,
        habit.category,
        habit.timeRange,
        weekStart,
        timezone,
      );

      habits.push({
        id: `habit-${habit.category}-${habit.timeRange}`,
        name: habitName,
        kanji: metadata.kanjiGlyph,
        domain: metadata.domain,
        streak,
        completedThisWeek,
        weeklyTarget: 7, // Meta padrão: todos os dias da semana
      });
    }

    return habits;
  }

  /**
   * Determina a faixa de horário baseada no scheduledTime ou completedAt
   */
  private getTimeRange(
    scheduledTime: string | null,
    completedAt: Date | null,
    timezone: string,
  ): string {
    const referenceTime = scheduledTime || completedAt;
    if (!referenceTime) return 'NIGHT';

    try {
      let hour: number;
      if (typeof referenceTime === 'string') {
        hour = parseInt(referenceTime.split(':')[0] || '0', 10);
      } else {
        // Se for Date, converter para string HH:mm no timezone do usuário
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const timeStr = formatter.format(referenceTime);
        hour = parseInt(timeStr.split(':')[0] || '0', 10);
      }

      if (hour >= 5 && hour < 12) return 'MORNING';
      if (hour >= 12 && hour < 18) return 'AFTERNOON';
      return 'NIGHT';
    } catch {
      return 'NIGHT';
    }
  }

  private getTimeRangeLabel(timeRange: string): string {
    const labels = {
      MORNING: 'Manhã',
      AFTERNOON: 'Tarde',
      NIGHT: 'Noite',
    };
    return labels[timeRange as keyof typeof labels] || timeRange;
  }

  /**
   * Calcula o streak atual de um hábito baseado nos dias consecutivos com atividade
   */
  private calculateHabitStreak(tasks: Date[], timezone: string): number {
    if (tasks.length === 0) return 0;

    // Agrupar por data (considerando timezone)
    const datesByDay = new Map<string, boolean>();
    for (const task of tasks) {
      const dateStr = this.getLocalDateString(task, timezone);
      datesByDay.set(dateStr, true);
    }

    // Ordenar datas
    const sortedDates = Array.from(datesByDay.keys()).sort();
    if (sortedDates.length === 0) return 0;

    // Calcular streak consecutivo a partir da data mais recente
    let streak = 0;
    const today = this.getLocalDateString(new Date(), timezone);
    let currentDate = today;

    for (let i = 0; i < sortedDates.length + 30; i++) {
      // Verificar se há atividade na data atual (ou anterior)
      if (datesByDay.has(currentDate)) {
        streak++;
        // Voltar um dia
        const prevDate = new Date(`${currentDate}T00:00:00`);
        prevDate.setDate(prevDate.getDate() - 1);
        currentDate = this.getLocalDateString(prevDate, timezone);
      } else {
        // Se não tem atividade hoje, verificar ontem
        if (i === 0) {
          const prevDate = new Date(`${currentDate}T00:00:00`);
          prevDate.setDate(prevDate.getDate() - 1);
          currentDate = this.getLocalDateString(prevDate, timezone);
          continue;
        }
        break;
      }
    }

    return streak;
  }

  /**
   * Calcula quais dias da semana o hábito foi completado
   */
  private async calculateWeeklyCompletion(
    userId: string,
    category: PlannerCategory,
    timeRange: string,
    weekStart: Date,
    timezone: string,
  ): Promise<boolean[]> {
    const completedThisWeek: boolean[] = [];

    for (let i = 0; i < 7; i++) {
      const current = new Date(weekStart);
      current.setDate(weekStart.getDate() + i);
      const dayStart = startOfDay(current);
      const dayEnd = endOfDay(current);
      const dateStr = toDateStamp(current);

      // Buscar tarefas concluídas neste dia com a categoria e faixa de horário
      const dayTasks = await this.prisma.plannerTask.findMany({
        where: {
          userId,
          category,
          status: PlannerTaskStatus.COMPLETED,
          date: dateStr,
          completedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { scheduledTime: true, completedAt: true },
      });

      // Verificar se alguma tarefa corresponde à faixa de horário
      const hasMatchingTask = dayTasks.some((task) => {
        const taskTimeRange = this.getTimeRange(
          task.scheduledTime,
          task.completedAt,
          timezone,
        );
        return taskTimeRange === timeRange;
      });

      completedThisWeek.push(hasMatchingTask);
    }

    return completedThisWeek;
  }

  /**
   * Obtém a data no formato YYYY-MM-DD para o timezone especificado
   */
  private getLocalDateString(date: Date, timezone: string): string {
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

  private buildWeekDays(now: Date): PlannerWeekDayDto[] {
    const { monday: weekStart } = getMondayAndSunday(now);
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
}
