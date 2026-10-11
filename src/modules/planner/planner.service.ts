import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PlannerGoalCategory,
  PlannerTask,
  PlannerCategory,
  PlannerTaskPriority,
  PlannerTaskStatus,
  WeeklyGoal,
  WeeklyPlan,
} from '@prisma/client';
import { logStructured } from '../../common/logging/structured-log';
import {
  CompletePlannerTaskDto,
  CreatePlannerTaskDto,
  DeletePlannerTaskResponseDto,
  PlannerHistoryItemResponseDto,
  PlannerHabitDto,
  PlannerOverviewResponseDto,
  PlannerOverviewTaskDto,
  PlannerSummaryDto,
  PlannerTaskAction,
  PlannerTaskItemResponseDto,
  PlannerTasksQueryDto,
  PlannerWeekDayDto,
  PlannerWeeklyGoalDto,
  PlannerWeekQueryDto,
  TodaySummaryResponseDto,
  UpdatePlannerTaskDto,
  UpdateWeeklyGoalsDto,
  UpdateWeeklyPlanDto,
  WeeklyGoalResponseDto,
  WeeklyPlanResponseDto,
} from './dto';
import { PlannerRepository, TaskPatch } from './repositories';
import {
  CATEGORY_META,
  DAILY_COMPLETION_THRESHOLD_PERCENT,
  DEFAULT_TIMEZONE,
  GOAL_META,
  TASK_CATEGORY_TO_GOAL,
  TIME_BASED_GOALS,
} from './planner.constants';
import {
  addDays,
  formatDateLabel,
  todayInTz,
  weekNumberFor,
  weekRangeOf,
} from './planner-date.util';

const WEEK_DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface HabitDef {
  domain: 'kanji' | 'vocabulary' | 'grammar' | 'immersion' | 'general';
  goalCategory: PlannerGoalCategory;
  name: string;
  glyph: string;
}

/** Hábitos exibidos no overview — nomes/glyphs no estilo Fluency OS. */
const HABIT_DEFS: HabitDef[] = [
  {
    domain: 'kanji',
    goalCategory: PlannerGoalCategory.KANJI,
    name: 'Kanji',
    glyph: '字',
  },
  {
    domain: 'vocabulary',
    goalCategory: PlannerGoalCategory.VOCABULARY,
    name: 'Vocabulário',
    glyph: '語',
  },
  {
    domain: 'grammar',
    goalCategory: PlannerGoalCategory.GRAMMAR,
    name: 'Gramática',
    glyph: '文',
  },
  {
    domain: 'immersion',
    goalCategory: PlannerGoalCategory.IMMERSION,
    name: 'Imersão',
    glyph: '映',
  },
  {
    domain: 'general',
    goalCategory: PlannerGoalCategory.GENERAL_REVIEW,
    name: 'Revisão Geral',
    glyph: '復',
  },
];

@Injectable()
export class PlannerService {
  constructor(private readonly repository: PlannerRepository) {}

  // ─── Tarefas ───────────────────────────────────────────────────────────────

  async createTask(
    userId: string,
    dto: CreatePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    const category = dto.category ?? PlannerCategory.GENERAL;
    const meta = CATEGORY_META[category];
    const plan = await this.ensurePlanForDate(userId, dto.date);

    const task = await this.repository.createTask({
      userId,
      weeklyPlanId: plan.id,
      title: dto.title,
      description: dto.description ?? null,
      category,
      kanjiGlyph: meta.glyph,
      date: dto.date,
      scheduledTime: dto.scheduledTime ?? null,
      estimatedMinutes: dto.estimatedMinutes ?? 20,
      priority: dto.priority ?? PlannerTaskPriority.MEDIUM,
    });

    logStructured('info', 'PlannerService', 'planner.task.create.success', {
      userId,
      taskId: task.id,
      category,
    });

    return this.toTaskResponse(task, meta.label);
  }

  async listTasks(
    userId: string,
    query: PlannerTasksQueryDto,
  ): Promise<PlannerTaskItemResponseDto[]> {
    const tasks = await this.repository.findTasks(userId, {
      date: query.date,
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status,
      category: query.category,
    });
    return tasks.map((task) => this.toTaskResponse(task));
  }

  async getTask(
    userId: string,
    taskId: string,
  ): Promise<PlannerTaskItemResponseDto> {
    const task = await this.repository.findTaskById(userId, taskId);
    if (!task) {
      throw new NotFoundException(`Planner task ${taskId} not found`);
    }
    return this.toTaskResponse(task);
  }

  async updateTask(
    userId: string,
    taskId: string,
    dto: UpdatePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    const patch: TaskPatch = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.category !== undefined) {
      patch.category = dto.category;
      patch.kanjiGlyph = CATEGORY_META[dto.category].glyph;
    }
    if (dto.date !== undefined) patch.date = dto.date;
    if (dto.scheduledTime !== undefined)
      patch.scheduledTime = dto.scheduledTime;
    if (dto.estimatedMinutes !== undefined) {
      patch.estimatedMinutes = dto.estimatedMinutes;
    }
    if (dto.actualMinutes !== undefined)
      patch.actualMinutes = dto.actualMinutes;
    if (dto.priority !== undefined) patch.priority = dto.priority;
    if (dto.status !== undefined) patch.status = dto.status;

    const result = await this.repository.updateTaskFields(
      userId,
      taskId,
      patch,
    );
    if (!result.ok) {
      throw new NotFoundException(`Planner task ${taskId} not found`);
    }

    if (result.transitioned) {
      await this.evaluateDailyCompletion(userId, result.task.date);
      logStructured('info', 'PlannerService', 'planner.task.status_changed', {
        userId,
        taskId,
        status: result.task.status,
      });
    }

    return this.toTaskResponse(result.task);
  }

  async deleteTask(
    userId: string,
    taskId: string,
  ): Promise<DeletePlannerTaskResponseDto> {
    const removed = await this.repository.deleteTask(userId, taskId);
    if (!removed) {
      throw new NotFoundException(`Planner task ${taskId} not found`);
    }
    logStructured('info', 'PlannerService', 'planner.task.delete.success', {
      userId,
      taskId,
    });
    return { success: true, id: taskId };
  }

  // ─── Conclusão (idempotente) + histórico ───────────────────────────────────

  /**
   * PATCH /tasks/:id/complete — toggle ou estado explícito ({ completed }).
   * RN-PLN003: concluir uma tarefa já concluída NÃO cria novo nó de histórico.
   */
  async completeTask(
    userId: string,
    taskId: string,
    dto: CompletePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    const existing = await this.repository.findTaskById(userId, taskId);
    if (!existing) {
      throw new NotFoundException(`Planner task ${taskId} not found`);
    }

    const target: PlannerTaskStatus =
      dto.completed === undefined
        ? existing.status === PlannerTaskStatus.PENDING
          ? PlannerTaskStatus.COMPLETED
          : PlannerTaskStatus.PENDING
        : dto.completed
          ? PlannerTaskStatus.COMPLETED
          : PlannerTaskStatus.PENDING;

    const result = await this.repository.setTaskStatus(
      userId,
      taskId,
      target,
      new Date(),
      dto.actualMinutes,
    );

    if (!result.ok) {
      if (result.reason === 'not_found') {
        throw new NotFoundException(`Planner task ${taskId} not found`);
      }
      // Corrida de concorrência — devolve o estado atual consistente
      const current = await this.repository.findTaskById(userId, taskId);
      if (!current) {
        throw new NotFoundException(`Planner task ${taskId} not found`);
      }
      return this.toTaskResponse(current);
    }

    if (result.transitioned) {
      logStructured('info', 'PlannerService', 'planner.task.status_changed', {
        userId,
        taskId,
        status: target,
      });
      if (target === PlannerTaskStatus.COMPLETED) {
        await this.evaluateDailyCompletion(userId, result.task.date);
      }
    }

    return this.toTaskResponse(result.task);
  }

  async getTaskHistory(
    userId: string,
    taskId: string,
  ): Promise<PlannerHistoryItemResponseDto[]> {
    const task = await this.repository.findTaskById(userId, taskId);
    if (!task) {
      throw new NotFoundException(`Planner task ${taskId} not found`);
    }
    const history = await this.repository.findTaskHistory(taskId);
    return history.map((entry) => this.toHistoryResponse(entry));
  }

  /**
   * RN-PLN002 — "dia bom": >= 80% das tarefas do dia concluídas OU
   * daily_goal concluída registra atividade de streak (timezone do usuário).
   * Só o dia corrente local conta para o streak.
   */
  private async evaluateDailyCompletion(
    userId: string,
    date: string,
  ): Promise<void> {
    const timezone = await this.getTimezone(userId);
    const today = todayInTz(timezone);
    if (date !== today) {
      return;
    }

    const { total, completed } = await this.repository.countTasksByDate(
      userId,
      date,
    );
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const dailyGoal = await this.repository.findDailyGoal(userId, date);

    const isGoodDay =
      percentage >= DAILY_COMPLETION_THRESHOLD_PERCENT ||
      dailyGoal?.isCompleted === true;

    if (!isGoodDay) {
      return;
    }

    const { created } = await this.repository.registerStreakActivity({
      userId,
      activityDate: date,
      timezone,
    });

    if (created) {
      logStructured('info', 'PlannerService', 'planner.streak.day_registered', {
        userId,
        date,
        percentage,
      });
    }
  }

  // ─── Resumo do dia ─────────────────────────────────────────────────────────

  async getTodaySummary(userId: string): Promise<TodaySummaryResponseDto> {
    const timezone = await this.getTimezone(userId);
    const today = todayInTz(timezone);
    const day = await this.buildDayStats(userId, today);

    return {
      totalTasks: day.total,
      completedTasks: day.completed,
      pendingTasks: day.total - day.completed,
      completionPercentage: day.percentage,
      minutesStudied: day.minutesStudied,
      categoriesStudied: day.categoriesStudied,
      streak: day.streak?.currentStreak ?? 0,
    };
  }

  private async buildDayStats(
    userId: string,
    date: string,
  ): Promise<{
    total: number;
    completed: number;
    percentage: number;
    minutesStudied: number;
    categoriesStudied: string[];
    streak: { currentStreak: number; longestStreak: number } | null;
  }> {
    const [tasks, streak] = await Promise.all([
      this.repository.findTasks(userId, { date }),
      this.repository.findStreak(userId),
    ]);

    const completedTasks = tasks.filter(
      (task) => task.status === PlannerTaskStatus.COMPLETED,
    );
    const total = tasks.length;
    const completed = completedTasks.length;

    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      minutesStudied: completedTasks.reduce(
        (sum, task) => sum + (task.actualMinutes ?? task.estimatedMinutes),
        0,
      ),
      categoriesStudied: [
        ...new Set(completedTasks.map((task) => task.category as string)),
      ],
      streak,
    };
  }

  // ─── Overview (semana + hábitos + tarefas + resumo) ────────────────────────

  async getOverview(
    userId: string,
    date?: string,
  ): Promise<PlannerOverviewResponseDto> {
    const timezone = await this.getTimezone(userId);
    const today = todayInTz(timezone);
    const baseDate = date ?? today;
    const { startDate, endDate } = weekRangeOf(baseDate);

    const [plan, weekTasks, streak] = await Promise.all([
      this.ensurePlanForDate(userId, baseDate),
      this.repository.findTasks(userId, { startDate, endDate }),
      this.repository.findStreak(userId),
    ]);

    const week: PlannerWeekDayDto[] = WEEK_DAY_LABELS.map((day, index) => {
      const dayDate = addDays(startDate, index);
      return {
        date: Number(dayDate.slice(8, 10)),
        day,
        isToday: dayDate === today,
      };
    });

    const tasksForBaseDate = weekTasks.filter((task) => task.date === baseDate);
    const todayTasks = tasksForBaseDate.map((task) =>
      this.toOverviewTask(task),
    );

    const goals = await this.repository.findGoals(plan.id);
    const currents = this.computeGoalCurrents(weekTasks);
    await this.repository.syncGoalCurrents(
      goals.map((goal) => ({
        id: goal.id,
        currentValue: currents.get(goal.category) ?? 0,
      })),
    );

    const weeklyGoals: PlannerWeeklyGoalDto[] = goals.map((goal) => ({
      name: goal.name,
      kanji: goal.kanjiGlyph,
      current: currents.get(goal.category) ?? 0,
      target: goal.targetValue,
      unit: goal.unit,
    }));

    const habits = this.buildHabits(weekTasks, startDate, today, goals);

    const dayStats = await this.buildDayStats(userId, today);
    const summary: PlannerSummaryDto = {
      tasksCompletedToday: dayStats.completed,
      tasksPendingToday: dayStats.total - dayStats.completed,
      tasksTotalToday: dayStats.total,
      completionPercentage: dayStats.percentage,
      studyMinutesToday: dayStats.minutesStudied,
      categoriesStudiedToday: dayStats.categoriesStudied,
      currentStreakDays: streak?.currentStreak ?? 0,
      longestStreakDays: streak?.longestStreak ?? 0,
      todayDateLabel: formatDateLabel(today),
    };

    return { week, habits, todayTasks, weeklyGoals, summary };
  }

  private buildHabits(
    weekTasks: PlannerTask[],
    startDate: string,
    today: string,
    goals: WeeklyGoal[],
  ): PlannerHabitDto[] {
    const todayIndex = this.weekDayIndex(startDate, today);

    return HABIT_DEFS.map((def) => {
      const completedThisWeek = WEEK_DAY_LABELS.map((_, index) => {
        const dayDate = addDays(startDate, index);
        const dayTasks = weekTasks.filter(
          (task) =>
            task.date === dayDate &&
            CATEGORY_META[task.category].domain === def.domain,
        );
        return (
          dayTasks.length > 0 &&
          dayTasks.every((task) => task.status === PlannerTaskStatus.COMPLETED)
        );
      });

      const goal = goals.find((item) => item.category === def.goalCategory);

      return {
        id: def.domain,
        name: def.name,
        kanji: def.glyph,
        domain: def.domain,
        streak: this.consecutiveDays(completedThisWeek, todayIndex),
        completedThisWeek,
        weeklyTarget: goal ? goal.targetValue : 0,
      };
    });
  }

  /** Distância em dias de `date` em relação ao início da semana (-1 se fora). */
  private weekDayIndex(startDate: string, date: string): number {
    const start = Date.parse(`${startDate}T12:00:00Z`);
    const current = Date.parse(`${date}T12:00:00Z`);
    const diff = Math.round((current - start) / 86_400_000);
    if (diff < 0) {
      return 0;
    }
    if (diff > 6) {
      return 6;
    }
    return diff;
  }

  /** Contagem consecutiva de dias verdadeiros terminando em `endIndex`. */
  private consecutiveDays(flags: boolean[], endIndex: number): number {
    let count = 0;
    for (let index = endIndex; index >= 0; index -= 1) {
      if (!flags[index]) {
        break;
      }
      count += 1;
    }
    return count;
  }

  // ─── Plano semanal + metas ─────────────────────────────────────────────────

  async getWeek(
    userId: string,
    query: PlannerWeekQueryDto,
  ): Promise<WeeklyPlanResponseDto> {
    const timezone = await this.getTimezone(userId);
    let plan: WeeklyPlan;

    if (query.date) {
      plan = await this.ensurePlanForDate(userId, query.date);
    } else if (query.year !== undefined && query.weekNumber !== undefined) {
      const existing = await this.repository.findPlanByWeek(
        userId,
        query.year,
        query.weekNumber,
      );
      if (!existing) {
        throw new NotFoundException(
          `Weekly plan ${query.year}-W${query.weekNumber} not found`,
        );
      }
      plan = existing;
    } else {
      plan = await this.ensurePlanForDate(userId, todayInTz(timezone));
    }

    return this.buildPlanResponse(userId, plan);
  }

  async updateWeek(
    userId: string,
    planId: string,
    dto: UpdateWeeklyPlanDto,
  ): Promise<WeeklyPlanResponseDto> {
    const plan = await this.repository.findPlanById(userId, planId);
    if (!plan) {
      throw new NotFoundException(`Weekly plan ${planId} not found`);
    }

    const data: { status?: WeeklyPlan['status']; notes?: string } = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (Object.keys(data).length > 0) {
      await this.repository.updatePlan(userId, planId, data);
      logStructured('info', 'PlannerService', 'planner.week.update.success', {
        userId,
        planId,
        fields: Object.keys(data),
      });
    }

    const updated = await this.repository.findPlanById(userId, planId);
    return this.buildPlanResponse(userId, updated ?? plan);
  }

  async updateWeekGoals(
    userId: string,
    planId: string,
    dto: UpdateWeeklyGoalsDto,
  ): Promise<WeeklyPlanResponseDto> {
    const plan = await this.repository.findPlanById(userId, planId);
    if (!plan) {
      throw new NotFoundException(`Weekly plan ${planId} not found`);
    }

    for (const item of dto.goals) {
      const meta = GOAL_META[item.category];
      await this.repository.upsertGoal(planId, {
        category: item.category,
        name: meta.name,
        kanjiGlyph: meta.glyph,
        targetValue: item.targetValue,
        unit: item.unit ?? meta.unit,
      });
    }

    logStructured('info', 'PlannerService', 'planner.week.goals_updated', {
      userId,
      planId,
      goals: dto.goals.map((goal) => goal.category),
    });

    return this.buildPlanResponse(userId, plan);
  }

  /** Garante plano (com goals default) para a semana da data informada. */
  private async ensurePlanForDate(
    userId: string,
    date: string,
  ): Promise<WeeklyPlan> {
    const { startDate, endDate } = weekRangeOf(date);
    const defaultGoals = (Object.keys(GOAL_META) as PlannerGoalCategory[]).map(
      (category) => ({
        category,
        name: GOAL_META[category].name,
        kanjiGlyph: GOAL_META[category].glyph,
        targetValue: GOAL_META[category].targetValue,
        unit: GOAL_META[category].unit,
      }),
    );

    return this.repository.ensurePlan(
      userId,
      {
        year: Number(date.slice(0, 4)),
        weekNumber: weekNumberFor(date),
        startDate,
        endDate,
      },
      defaultGoals,
    );
  }

  /** Monta a resposta do plano recalculando currentValue das metas. */
  private async buildPlanResponse(
    userId: string,
    plan: WeeklyPlan,
  ): Promise<WeeklyPlanResponseDto> {
    const [goals, weekTasks] = await Promise.all([
      this.repository.findGoals(plan.id),
      this.repository.findTasks(userId, {
        startDate: plan.startDate,
        endDate: plan.endDate,
      }),
    ]);

    const currents = this.computeGoalCurrents(weekTasks);
    await this.repository.syncGoalCurrents(
      goals.map((goal) => ({
        id: goal.id,
        currentValue: currents.get(goal.category) ?? 0,
      })),
    );

    return this.toPlanResponse(
      plan,
      goals.map((goal) => ({
        ...goal,
        currentValue: currents.get(goal.category) ?? 0,
      })),
    );
  }

  /**
   * Progresso das metas da semana a partir das tarefas concluídas:
   * metas de tempo somam minutos; demais contam tarefas.
   */
  private computeGoalCurrents(tasks: PlannerTask[]): Map<string, number> {
    const currents = new Map<string, number>();
    for (const task of tasks) {
      if (task.status !== PlannerTaskStatus.COMPLETED) {
        continue;
      }
      const goalCategory = TASK_CATEGORY_TO_GOAL[task.category];
      const value = TIME_BASED_GOALS.has(goalCategory)
        ? (task.actualMinutes ?? task.estimatedMinutes)
        : 1;
      currents.set(goalCategory, (currents.get(goalCategory) ?? 0) + value);
    }
    return currents;
  }

  private async getTimezone(userId: string): Promise<string> {
    const preferences = await this.repository.findUserPreferences(userId);
    return preferences?.timezone ?? DEFAULT_TIMEZONE;
  }

  // ─── Mappers para DTOs do contrato do frontend ─────────────────────────────

  private toTaskResponse(
    task: PlannerTask,
    label?: string,
  ): PlannerTaskItemResponseDto {
    return {
      id: task.id,
      userId: task.userId,
      weeklyPlanId: task.weeklyPlanId,
      title: task.title,
      description: task.description,
      category: task.category,
      categoryLabel: label ?? CATEGORY_META[task.category].label,
      kanjiGlyph: task.kanjiGlyph,
      date: task.date,
      scheduledTime: task.scheduledTime,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      priority: task.priority,
      status: task.status,
      completedAt: task.completedAt?.toISOString() ?? null,
      isAutoGenerated: task.isAutoGenerated,
      actionPayload:
        (task.actionPayload as Record<string, unknown> | null) ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private toOverviewTask(task: PlannerTask): PlannerOverviewTaskDto {
    return {
      id: task.id,
      domain: CATEGORY_META[task.category].domain,
      task: task.title,
      description: task.description,
      priority: task.priority.toLowerCase() as 'high' | 'medium' | 'low',
      estimatedMinutes: task.estimatedMinutes,
      kanjiGlyph: task.kanjiGlyph,
      dueAt: `${task.date}T${task.scheduledTime ?? '00:00'}:00`,
      status: task.status,
      completed: task.status === PlannerTaskStatus.COMPLETED,
      action: this.buildAction(task),
    };
  }

  /** Ação sugerida para a tarefa — payload explícito tem precedência. */
  private buildAction(task: PlannerTask): PlannerTaskAction {
    const payload = task.actionPayload as { type?: string } | null;
    if (payload && typeof payload.type === 'string') {
      return payload as PlannerTaskAction;
    }

    switch (task.category) {
      case PlannerCategory.KANJI:
        return {
          type: 'review_kanji',
          count: Math.max(1, task.estimatedMinutes * 2),
        };
      case PlannerCategory.VOCABULARY:
      case PlannerCategory.CHUNK:
        return {
          type: 'review_vocabulary',
          count: Math.max(1, task.estimatedMinutes * 2),
        };
      case PlannerCategory.GRAMMAR:
        return { type: 'study_grammar', count: 1 };
      case PlannerCategory.IMMERSION:
        return {
          type: 'immersion',
          targetMinutes: task.estimatedMinutes,
          loggedMinutes: task.actualMinutes ?? 0,
        };
      case PlannerCategory.REVIEW:
        return {
          type: 'daily_review',
          targetCount: 20,
          completedCount: task.status === PlannerTaskStatus.COMPLETED ? 20 : 0,
        };
      default:
        return { type: 'general', note: task.description ?? task.title };
    }
  }

  private toPlanResponse(
    plan: WeeklyPlan,
    goals: WeeklyGoal[],
  ): WeeklyPlanResponseDto {
    return {
      id: plan.id,
      userId: plan.userId,
      year: plan.year,
      weekNumber: plan.weekNumber,
      startDate: plan.startDate,
      endDate: plan.endDate,
      status: plan.status,
      notes: plan.notes,
      goals: goals.map((goal) => this.toGoalResponse(goal)),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private toGoalResponse(goal: WeeklyGoal): WeeklyGoalResponseDto {
    const percentage =
      goal.targetValue > 0
        ? Math.min(
            100,
            Math.round((goal.currentValue / goal.targetValue) * 100),
          )
        : 0;

    return {
      id: goal.id,
      category: goal.category,
      name: goal.name,
      kanjiGlyph: goal.kanjiGlyph,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      percentage,
      unit: goal.unit,
    };
  }

  private toHistoryResponse(entry: {
    id: string;
    taskId: string;
    oldStatus: PlannerTaskStatus;
    newStatus: PlannerTaskStatus;
    changedAt: Date;
  }): PlannerHistoryItemResponseDto {
    return {
      id: entry.id,
      taskId: entry.taskId,
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      changedAt: entry.changedAt.toISOString(),
    };
  }
}
