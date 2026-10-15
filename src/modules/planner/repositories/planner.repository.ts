import { Injectable } from '@nestjs/common';
import {
  PlannerGoalCategory,
  PlannerHistory,
  PlannerTask,
  PlannerCategory,
  PlannerTaskPriority,
  PlannerTaskStatus,
  Prisma,
  Streak,
  WeeklyGoal,
  WeeklyPlan,
  WeeklyPlanStatus,
} from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { addDays } from '../planner-date.util';

export interface TaskFilters {
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: PlannerTaskStatus;
  category?: PlannerCategory;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  category?: PlannerCategory;
  kanjiGlyph?: string;
  date?: string;
  scheduledTime?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  priority?: PlannerTaskPriority;
  status?: PlannerTaskStatus;
}

export type TaskMutationResult =
  | { ok: true; task: PlannerTask; transitioned: boolean }
  | { ok: false; reason: 'not_found' | 'no_change' };

export interface PlanMeta {
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
}

export interface DefaultGoalInput {
  category: PlannerGoalCategory;
  name: string;
  kanjiGlyph: string;
  targetValue: number;
  unit: string;
}

@Injectable()
export class PlannerRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Preferências / streak / meta diária ───────────────────────────────────

  findUserPreferences(userId: string) {
    return this.prisma.userPreferences.findUnique({ where: { userId } });
  }

  findStreak(userId: string): Promise<Streak | null> {
    return this.prisma.streak.findUnique({ where: { userId } });
  }

  findDailyGoal(userId: string, goalDate: string) {
    return this.prisma.dailyGoal.findUnique({
      where: { userId_goalDate: { userId, goalDate } },
    });
  }

  // ─── Tarefas ───────────────────────────────────────────────────────────────

  findTaskById(userId: string, taskId: string): Promise<PlannerTask | null> {
    return this.prisma.plannerTask.findFirst({ where: { id: taskId, userId } });
  }

  findTasks(userId: string, filters: TaskFilters): Promise<PlannerTask[]> {
    const where: Prisma.PlannerTaskWhereInput = { userId };

    if (filters.date) {
      where.date = filters.date;
    } else if (filters.startDate || filters.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.category) {
      where.category = filters.category;
    }

    return this.prisma.plannerTask.findMany({
      where,
      orderBy: [
        { date: 'asc' },
        { scheduledTime: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
  }

  countTasksByDate(
    userId: string,
    date: string,
  ): Promise<{ total: number; completed: number }> {
    return Promise.all([
      this.prisma.plannerTask.count({ where: { userId, date } }),
      this.prisma.plannerTask.count({
        where: { userId, date, status: PlannerTaskStatus.COMPLETED },
      }),
    ]).then(([total, completed]) => ({ total, completed }));
  }

  createTask(
    data: Prisma.PlannerTaskUncheckedCreateInput,
  ): Promise<PlannerTask> {
    return this.prisma.plannerTask.create({ data });
  }

  async deleteTask(userId: string, taskId: string): Promise<boolean> {
    const result = await this.prisma.plannerTask.deleteMany({
      where: { id: taskId, userId },
    });
    return result.count > 0;
  }

  /**
   * PATCH /tasks/:id — aplica campos + transição de status opcional em uma
   * única transação. Uma linha de PlannerHistory é criada SOMENTE quando o
   * status realmente muda (RN-PLN004 — task_id + status_antigo → status_novo).
   */
  async updateTaskFields(
    userId: string,
    taskId: string,
    patch: TaskPatch,
    now: Date = new Date(),
  ): Promise<TaskMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.plannerTask.findFirst({
        where: { id: taskId, userId },
      });
      if (!task) {
        return { ok: false as const, reason: 'not_found' as const };
      }

      const targetStatus = patch.status ?? task.status;
      const transitioned = targetStatus !== task.status;

      const data: Prisma.PlannerTaskUpdateInput = {};
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.category !== undefined) data.category = patch.category;
      if (patch.kanjiGlyph !== undefined) data.kanjiGlyph = patch.kanjiGlyph;
      if (patch.date !== undefined) data.date = patch.date;
      if (patch.scheduledTime !== undefined) {
        data.scheduledTime = patch.scheduledTime;
      }
      if (patch.estimatedMinutes !== undefined) {
        data.estimatedMinutes = patch.estimatedMinutes;
      }
      if (patch.actualMinutes !== undefined) {
        data.actualMinutes = patch.actualMinutes;
      }
      if (patch.priority !== undefined) data.priority = patch.priority;

      if (transitioned) {
        data.status = targetStatus;
        data.completedAt =
          targetStatus === PlannerTaskStatus.COMPLETED
            ? (task.completedAt ?? now)
            : null;
        if (
          targetStatus === PlannerTaskStatus.COMPLETED &&
          patch.actualMinutes === undefined &&
          task.actualMinutes === null
        ) {
          data.actualMinutes = task.estimatedMinutes;
        }
      }

      if (Object.keys(data).length === 0) {
        return { ok: true as const, task, transitioned: false };
      }

      if (transitioned) {
        await tx.plannerHistory.create({
          data: {
            taskId,
            oldStatus: task.status,
            newStatus: targetStatus,
          },
        });
      }

      const updated = await tx.plannerTask.update({
        where: { id: taskId },
        data,
      });

      return { ok: true as const, task: updated, transitioned };
    });
  }

  /**
   * PATCH /tasks/:id/complete — guarda atômico pelo status atual.
   * Idempotência: se a tarefa já está no estado alvo, NENHUM histórico é criado.
   */
  async setTaskStatus(
    userId: string,
    taskId: string,
    target: PlannerTaskStatus,
    now: Date = new Date(),
    actualMinutes?: number,
  ): Promise<TaskMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.plannerTask.findFirst({
        where: { id: taskId, userId },
      });
      if (!task) {
        return { ok: false as const, reason: 'not_found' as const };
      }

      if (task.status === target) {
        // Idempotência — concluir tarefa já concluída não duplica histórico
        return { ok: true as const, task, transitioned: false };
      }

      const guarded = await tx.plannerTask.updateMany({
        where: { id: taskId, userId, status: task.status },
        data: {
          status: target,
          completedAt: target === PlannerTaskStatus.COMPLETED ? now : null,
          ...(target === PlannerTaskStatus.COMPLETED
            ? {
                actualMinutes:
                  actualMinutes ?? task.actualMinutes ?? task.estimatedMinutes,
              }
            : {}),
        },
      });

      if (guarded.count === 0) {
        return { ok: false as const, reason: 'no_change' as const };
      }

      await tx.plannerHistory.create({
        data: {
          taskId,
          oldStatus: task.status,
          newStatus: target,
        },
      });

      const updated = await tx.plannerTask.findUniqueOrThrow({
        where: { id: taskId },
      });
      return { ok: true as const, task: updated, transitioned: true };
    });
  }

  findTaskHistory(taskId: string): Promise<PlannerHistory[]> {
    return this.prisma.plannerHistory.findMany({
      where: { taskId },
      orderBy: { changedAt: 'desc' },
    });
  }

  // ─── Streak (dia bom ≥ 80%) ────────────────────────────────────────────────

  /**
   * Registra a atividade do dia no streak. Idempotente por causa da unique
   * (userId, activityDate) — reprocessar o mesmo dia nunca cria nó duplicado
   * nem incrementa currentStreak duas vezes.
   */
  async registerStreakActivity(params: {
    userId: string;
    activityDate: string;
    timezone: string;
  }): Promise<{ created: boolean }> {
    const { userId, activityDate, timezone } = params;

    return this.prisma.$transaction(async (tx) => {
      const streak = await tx.streak.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      const existing = await tx.streakHistory.findUnique({
        where: { userId_activityDate: { userId, activityDate } },
      });
      if (existing) {
        return { created: false };
      }

      await tx.streakHistory.create({
        data: { userId, streakId: streak.id, activityDate, timezone },
      });

      const previous = streak.lastActivityDate;
      let currentStreak: number;
      if (previous === activityDate) {
        currentStreak = Math.max(streak.currentStreak, 1);
      } else if (previous !== null && previous === addDays(activityDate, -1)) {
        currentStreak = streak.currentStreak + 1;
      } else {
        currentStreak = 1;
      }

      await tx.streak.update({
        where: { id: streak.id },
        data: {
          currentStreak,
          longestStreak: Math.max(streak.longestStreak, currentStreak),
          lastActivityDate: activityDate,
          totalActiveDays: streak.totalActiveDays + 1,
        },
      });

      return { created: true };
    });
  }

  // ─── Plano semanal + metas ─────────────────────────────────────────────────

  findPlanByWeek(
    userId: string,
    year: number,
    weekNumber: number,
  ): Promise<WeeklyPlan | null> {
    return this.prisma.weeklyPlan.findUnique({
      where: { userId_year_weekNumber: { userId, year, weekNumber } },
    });
  }

  findPlanById(userId: string, planId: string): Promise<WeeklyPlan | null> {
    return this.prisma.weeklyPlan.findFirst({ where: { id: planId, userId } });
  }

  findGoals(planId: string): Promise<WeeklyGoal[]> {
    return this.prisma.weeklyGoal.findMany({
      where: { planId },
      orderBy: { category: 'asc' },
    });
  }

  /** Cria plano + goals default; corrida no unique (userId, year, weekNumber) reprocessa. */
  async ensurePlan(
    userId: string,
    meta: PlanMeta,
    defaultGoals: DefaultGoalInput[],
  ): Promise<WeeklyPlan> {
    const existing = await this.findPlanByWeek(
      userId,
      meta.year,
      meta.weekNumber,
    );
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.weeklyPlan.create({
          data: { userId, ...meta },
        });
        for (const goal of defaultGoals) {
          await tx.weeklyGoal.create({ data: { planId: plan.id, ...goal } });
        }
        return plan;
      });
    } catch (error) {
      const isUniqueViolation =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      if (!isUniqueViolation) {
        throw error;
      }
      const raced = await this.findPlanByWeek(
        userId,
        meta.year,
        meta.weekNumber,
      );
      if (!raced) {
        throw error;
      }
      return raced;
    }
  }

  updatePlan(
    userId: string,
    planId: string,
    data: { status?: WeeklyPlanStatus; notes?: string },
  ): Promise<boolean> {
    return this.prisma.weeklyPlan
      .updateMany({ where: { id: planId, userId }, data })
      .then((result) => result.count > 0);
  }

  upsertGoal(
    planId: string,
    goal: DefaultGoalInput & { currentValue?: number },
  ): Promise<WeeklyGoal> {
    return this.prisma.weeklyGoal.upsert({
      where: { planId_category: { planId, category: goal.category } },
      create: {
        planId,
        category: goal.category,
        name: goal.name,
        kanjiGlyph: goal.kanjiGlyph,
        targetValue: goal.targetValue,
        unit: goal.unit,
        currentValue: goal.currentValue ?? 0,
      },
      update: {
        targetValue: goal.targetValue,
        unit: goal.unit,
        ...(goal.currentValue !== undefined
          ? { currentValue: goal.currentValue }
          : {}),
      },
    });
  }

  async syncGoalCurrents(
    updates: { id: string; currentValue: number }[],
  ): Promise<void> {
    if (updates.length === 0) {
      return;
    }
    await this.prisma.$transaction(
      updates.map((update) =>
        this.prisma.weeklyGoal.update({
          where: { id: update.id },
          data: { currentValue: update.currentValue },
        }),
      ),
    );
  }
}
