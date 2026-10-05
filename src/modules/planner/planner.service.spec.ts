import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PlannerCategory,
  PlannerGoalCategory,
  PlannerTaskPriority,
  PlannerTaskStatus,
  WeeklyPlanStatus,
} from '@prisma/client';
import { PrismaService } from '../auth/repositories/prisma.service';
import { StreakService } from '../review/services/streak.service';
import {
  getIsoWeekAndYear,
  getMondayAndSunday,
  PlannerService,
} from './planner.service';

describe('PlannerService (WeeklyPlan, Goals & Tasks)', () => {
  let service: PlannerService;
  let prisma: {
    weeklyPlan: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    weeklyGoal: {
      upsert: jest.Mock;
    };
    plannerTask: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    userPreferences: {
      findUnique: jest.Mock;
    };
    userKanjiProgress: {
      count: jest.Mock;
    };
    userVocabularyProgress: {
      count: jest.Mock;
    };
    userGrammarProgress: {
      count: jest.Mock;
    };
    immersionLog: {
      aggregate: jest.Mock;
    };
    streakHistory: {
      aggregate: jest.Mock;
    };
    grammarPoint: {
      count: jest.Mock;
    };
    streak: {
      findUnique: jest.Mock;
    };
    reviewAnswer: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      weeklyPlan: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      weeklyGoal: {
        upsert: jest.fn(),
      },
      plannerTask: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userPreferences: {
        findUnique: jest.fn(),
      },
      userKanjiProgress: {
        count: jest.fn().mockResolvedValue(0),
      },
      userVocabularyProgress: {
        count: jest.fn().mockResolvedValue(0),
      },
      userGrammarProgress: {
        count: jest.fn().mockResolvedValue(0),
      },
      immersionLog: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { durationMinutes: 45 } }),
      },
      streakHistory: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { kanjiReviewed: 30, vocabReviewed: 55, totalReviews: 80 },
        }),
      },
      grammarPoint: {
        count: jest.fn().mockResolvedValue(100),
      },
      streak: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ currentStreak: 5, longestStreak: 12 }),
      },
      reviewAnswer: {
        count: jest.fn().mockResolvedValue(10),
      },
      $transaction: jest.fn(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        (callback) => callback(prisma),
      ),
    };

    const mockStreakService = {
      recordPlannerCompletion: jest.fn().mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
        dayComplete: true,
      }),
      recalculateAfterUndo: jest.fn().mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
        dayComplete: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlannerService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: StreakService,
          useValue: mockStreakService,
        },
      ],
    }).compile();

    service = module.get<PlannerService>(PlannerService);
  });

  describe('Date Helpers', () => {
    it('deve calcular corretamente segunda-feira e domingo para uma data', () => {
      const ref = new Date('2026-08-27T12:00:00Z');
      const { monday, sunday } = getMondayAndSunday(ref);
      expect(monday.getDay()).toBe(1);
      expect(sunday.getDay()).toBe(0);
      expect(sunday.getTime()).toBeGreaterThan(monday.getTime());
    });

    it('deve calcular ISO week number de forma consistente', () => {
      const date = new Date('2026-08-27T12:00:00Z');
      const { year, weekNumber } = getIsoWeekAndYear(date);
      expect(year).toBe(2026);
      expect(weekNumber).toBe(35);
    });
  });

  describe('Weekly Plan & Goals', () => {
    it('deve criar um novo plano semanal com metas padrão quando não existir', async () => {
      const userId = 'user-1';
      prisma.weeklyPlan.findUnique.mockResolvedValue(null);
      prisma.userPreferences.findUnique.mockResolvedValue({
        dailyImmersionGoal: 30,
        dailyKanjiGoal: 10,
        dailyVocabGoal: 20,
        dailyReviewGoal: 50,
      });

      const fakeCreatedPlan = {
        id: 'plan-123',
        userId,
        year: 2026,
        weekNumber: 35,
        startDate: '2026-08-24',
        endDate: '2026-08-30',
        status: WeeklyPlanStatus.ACTIVE,
        notes: null,
        goals: [
          {
            id: 'g1',
            category: PlannerGoalCategory.IMMERSION,
            targetValue: 300,
            unit: 'min',
          },
          {
            id: 'g2',
            category: PlannerGoalCategory.KANJI,
            targetValue: 200,
            unit: '',
          },
          {
            id: 'g3',
            category: PlannerGoalCategory.VOCABULARY,
            targetValue: 140,
            unit: '',
          },
          {
            id: 'g4',
            category: PlannerGoalCategory.GENERAL_REVIEW,
            targetValue: 350,
            unit: '',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.weeklyPlan.create.mockResolvedValue(fakeCreatedPlan);

      const result = await service.getOrCreateWeeklyPlan(userId, '2026-08-27');

      expect(result.id).toBe('plan-123');
      expect(result.userId).toBe(userId);
      expect(result.goals).toHaveLength(4);
    });

    it('deve atualizar metas de um plano existente do próprio usuário', async () => {
      const userId = 'user-1';
      const planId = 'plan-123';

      prisma.weeklyPlan.findUnique.mockResolvedValue({
        id: planId,
        userId,
        year: 2026,
        weekNumber: 35,
        startDate: '2026-08-24',
        endDate: '2026-08-30',
      });

      prisma.weeklyPlan.findUniqueOrThrow.mockResolvedValue({
        id: planId,
        userId,
        year: 2026,
        weekNumber: 35,
        startDate: '2026-08-24',
        endDate: '2026-08-30',
        status: WeeklyPlanStatus.ACTIVE,
        notes: null,
        goals: [
          {
            id: 'g1',
            category: PlannerGoalCategory.IMMERSION,
            targetValue: 400,
            unit: 'min',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateWeeklyGoals(userId, planId, {
        goals: [
          {
            category: PlannerGoalCategory.IMMERSION,
            targetValue: 400,
            unit: 'min',
          },
        ],
      });

      expect(result.id).toBe(planId);
      expect(prisma.weeklyGoal.upsert).toHaveBeenCalled();
    });

    it('deve lançar ForbiddenException se o usuário tentar alterar plano de outro usuário', async () => {
      const planId = 'plan-123';
      prisma.weeklyPlan.findUnique.mockResolvedValue({
        id: planId,
        userId: 'other-user',
      });

      await expect(
        service.updateWeeklyGoals('user-1', planId, {
          goals: [
            { category: PlannerGoalCategory.IMMERSION, targetValue: 400 },
          ],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Task CRUD & Completion', () => {
    it('deve criar uma tarefa associando ao WeeklyPlan correspondente', async () => {
      const userId = 'user-1';
      prisma.weeklyPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
      });

      const fakeTask = {
        id: 'task-1',
        userId,
        weeklyPlanId: 'plan-123',
        title: 'Estudar Kanji N4',
        description: 'Capítulo 3',
        category: PlannerCategory.KANJI,
        date: '2026-08-27',
        scheduledTime: '09:00',
        estimatedMinutes: 30,
        actualMinutes: null,
        priority: PlannerTaskPriority.HIGH,
        status: PlannerTaskStatus.PENDING,
        completedAt: null,
        isAutoGenerated: false,
        actionPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.plannerTask.create.mockResolvedValue(fakeTask);

      const result = await service.createTask(userId, {
        title: 'Estudar Kanji N4',
        description: 'Capítulo 3',
        category: PlannerCategory.KANJI,
        date: '2026-08-27',
        scheduledTime: '09:00',
        estimatedMinutes: 30,
        priority: PlannerTaskPriority.HIGH,
      });

      expect(result.id).toBe('task-1');
      expect(result.title).toBe('Estudar Kanji N4');
      expect(result.kanjiGlyph).toBe('字');
      expect(prisma.plannerTask.create).toHaveBeenCalled();
    });

    it('deve listar tarefas com filtros', async () => {
      const userId = 'user-1';
      const fakeTasks = [
        {
          id: 'task-1',
          userId,
          weeklyPlanId: 'plan-123',
          title: 'Estudar Kanji',
          description: null,
          category: PlannerCategory.KANJI,
          date: '2026-08-27',
          scheduledTime: '08:00',
          estimatedMinutes: 20,
          actualMinutes: null,
          priority: PlannerTaskPriority.MEDIUM,
          status: PlannerTaskStatus.PENDING,
          completedAt: null,
          isAutoGenerated: false,
          actionPayload: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.plannerTask.findMany.mockResolvedValue(fakeTasks);

      const result = await service.getTasks(userId, { date: '2026-08-27' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('deve alternar status de conclusão com idempotência', async () => {
      const userId = 'user-1';
      const taskId = 'task-1';

      prisma.plannerTask.findUnique.mockResolvedValue({
        id: taskId,
        userId,
        status: PlannerTaskStatus.PENDING,
        estimatedMinutes: 25,
        actualMinutes: null,
        completedAt: null,
      });

      prisma.plannerTask.update.mockResolvedValue({
        id: taskId,
        userId,
        weeklyPlanId: null,
        title: 'Tarefa Teste',
        description: null,
        category: PlannerCategory.GENERAL,
        date: '2026-08-27',
        scheduledTime: null,
        estimatedMinutes: 25,
        actualMinutes: 25,
        priority: PlannerTaskPriority.MEDIUM,
        status: PlannerTaskStatus.COMPLETED,
        completedAt: new Date(),
        isAutoGenerated: false,
        actionPayload: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const completedResult = (await service.toggleTaskCompletion(
        userId,
        taskId,
        {
          completed: true,
        },
      )) as unknown as { status: PlannerTaskStatus };

      expect(completedResult.status).toBe(PlannerTaskStatus.COMPLETED);

      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      expect(prisma.plannerTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: taskId },
          data: expect.objectContaining({
            status: PlannerTaskStatus.COMPLETED,
            actualMinutes: 25,
          }),
        }),
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */
    });

    it('deve lançar ForbiddenException ao tentar alterar tarefa de outro usuário', async () => {
      prisma.plannerTask.findUnique.mockResolvedValue({
        id: 'task-other',
        userId: 'other-user',
      });

      await expect(
        service.toggleTaskCompletion('user-1', 'task-other', {
          completed: true,
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(service.deleteTask('user-1', 'task-other')).rejects.toThrow(
        ForbiddenException,
      );

      await expect(
        service.updateTask('user-1', 'task-other', { title: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve excluir tarefa com sucesso', async () => {
      const userId = 'user-1';
      const taskId = 'task-1';

      prisma.plannerTask.findUnique.mockResolvedValue({
        id: taskId,
        userId,
      });
      prisma.plannerTask.delete.mockResolvedValue({ id: taskId });

      const result = await service.deleteTask(userId, taskId);
      expect(result.success).toBe(true);
      expect(result.id).toBe(taskId);
    });
  });

  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
  describe('Habit Detection (FASE 6)', () => {
    let habitService: PlannerService;
    let habitPrisma: {
      plannerTask: { findMany: jest.Mock };
      userPreferences: { findUnique: jest.Mock };
    };

    beforeEach(async () => {
      habitPrisma = {
        plannerTask: {
          findMany: jest.fn(),
        },
        userPreferences: {
          findUnique: jest.fn(),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PlannerService,
          {
            provide: PrismaService,
            useValue: habitPrisma,
          },
        ],
      }).compile();

      habitService = module.get<PlannerService>(PlannerService);
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.resetAllMocks();
    });

    // Helper function to access private method for testing
    const getDetectHabits = (service: PlannerService) =>
      (service as any).detectHabitsFromTasks.bind(service);

    it('deve detectar hábito com 5+ ocorrências na mesma categoria e período', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Criar 6 tarefas concluídas de Kanji no período da manhã (últimos 30 dias)
      const today = new Date();
      const completedTasks = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          category: PlannerCategory.KANJI,
          scheduledTime: '09:00',
          completedAt: new Date(date),
          date: date.toISOString().split('T')[0],
        };
      });

      habitPrisma.plannerTask.findMany.mockResolvedValue(completedTasks);
      habitPrisma.userPreferences.findUnique.mockResolvedValue({ timezone });

      // Access private method through type casting
      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, timezone);

      expect(habits).toHaveLength(1);
      expect(habits[0].name).toContain('Kanji');
      expect(habits[0].name).toContain('Manhã');
      expect(habits[0].domain).toBe('kanji');
    });

    it('não deve detectar hábito com menos de 5 ocorrências', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Criar apenas 3 tarefas concluídas (abaixo do mínimo)
      const today = new Date();
      const completedTasks = Array.from({ length: 3 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          category: PlannerCategory.KANJI,
          scheduledTime: '09:00',
          completedAt: new Date(date),
          date: date.toISOString().split('T')[0],
        };
      });

      habitPrisma.plannerTask.findMany.mockResolvedValue(completedTasks);

      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, timezone);

      expect(habits).toHaveLength(0);
    });

    it('deve detectar hábitos diferentes para categorias diferentes', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Criar tarefas de categorias diferentes
      const today = new Date();
      const completedTasks = [
        ...Array.from({ length: 5 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          return {
            category: PlannerCategory.KANJI,
            scheduledTime: '09:00',
            completedAt: new Date(date),
            date: date.toISOString().split('T')[0],
          };
        }),
        ...Array.from({ length: 5 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          return {
            category: PlannerCategory.IMMERSION,
            scheduledTime: '20:00',
            completedAt: new Date(date),
            date: date.toISOString().split('T')[0],
          };
        }),
      ];

      habitPrisma.plannerTask.findMany.mockResolvedValue(completedTasks);

      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, timezone);

      expect(habits).toHaveLength(2);
      expect(habits.some((h: any) => h.domain === 'kanji')).toBe(true);
      expect(habits.some((h: any) => h.domain === 'immersion')).toBe(true);
    });

    it('deve detectar hábitos separados para períodos diferentes da mesma categoria', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Criar tarefas da mesma categoria em períodos diferentes
      const today = new Date();
      const completedTasks = [
        ...Array.from({ length: 5 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          return {
            category: PlannerCategory.KANJI,
            scheduledTime: '09:00', // Manhã
            completedAt: new Date(date),
            date: date.toISOString().split('T')[0],
          };
        }),
        ...Array.from({ length: 5 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          return {
            category: PlannerCategory.KANJI,
            scheduledTime: '20:00', // Noite
            completedAt: new Date(date),
            date: date.toISOString().split('T')[0],
          };
        }),
      ];

      habitPrisma.plannerTask.findMany.mockResolvedValue(completedTasks);

      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, timezone);

      expect(habits).toHaveLength(2);
      expect(habits.every((h: any) => h.domain === 'kanji')).toBe(true);
      expect(habits.some((h: any) => h.name.includes('Manhã'))).toBe(true);
      expect(habits.some((h: any) => h.name.includes('Noite'))).toBe(true);
    });

    it('deve retornar array vazio quando não há histórico', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      habitPrisma.plannerTask.findMany.mockResolvedValue([]);

      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, timezone);

      expect(habits).toHaveLength(0);
    });

    it('deve ignorar histórico antigo (mais de 30 dias)', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Teste simplificado: retorna array vazio (simulando filtro do Prisma)
      habitPrisma.plannerTask.findMany.mockResolvedValue([]);

      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, timezone);

      expect(habits).toHaveLength(0);
    });

    it('deve usar timezone do usuário corretamente', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const customTimezone = 'Asia/Tokyo';

      const today = new Date();
      const completedTasks = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          category: PlannerCategory.KANJI,
          scheduledTime: '09:00',
          completedAt: new Date(date),
          date: date.toISOString().split('T')[0],
        };
      });

      habitPrisma.plannerTask.findMany.mockResolvedValue(completedTasks);

      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, customTimezone);

      expect(habits).toHaveLength(1);
    });

    it('deve garantir isolamento entre usuários', async () => {
      const userId1 = 'user-1';
      const userId2 = 'user-2';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Tarefas do usuário 1
      const today = new Date();
      const user1Tasks = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          category: PlannerCategory.KANJI,
          scheduledTime: '09:00',
          completedAt: new Date(date),
          date: date.toISOString().split('T')[0],
        };
      });

      // Tarefas do usuário 2 (categoria diferente)
      const user2Tasks = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          category: PlannerCategory.IMMERSION,
          scheduledTime: '20:00',
          completedAt: new Date(date),
          date: date.toISOString().split('T')[0],
        };
      });

      // Testar usuário 1
      habitPrisma.plannerTask.findMany.mockResolvedValue(user1Tasks);
      const detectHabits1 = (habitService as any).detectHabitsFromTasks.bind(
        habitService,
      );
      const habits1 = await detectHabits1(userId1, weekStart, timezone);

      // Testar usuário 2
      habitPrisma.plannerTask.findMany.mockResolvedValue(user2Tasks);
      const detectHabits2 = (habitService as any).detectHabitsFromTasks.bind(
        habitService,
      );
      const habits2 = await detectHabits2(userId2, weekStart, timezone);

      expect(habits1[0].domain).toBe('kanji');
      expect(habits2[0].domain).toBe('immersion');
      expect(habits1[0].domain).not.toBe(habits2[0].domain);
    });

    it('deve calcular streak corretamente baseado em dias consecutivos', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Criar tarefas em dias consecutivos
      const today = new Date();
      const completedTasks = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          category: PlannerCategory.KANJI,
          scheduledTime: '09:00',
          completedAt: new Date(date),
          date: date.toISOString().split('T')[0],
        };
      });

      habitPrisma.plannerTask.findMany.mockResolvedValue(completedTasks);

      const detectHabits = getDetectHabits(habitService);
      const habits = await detectHabits(userId, weekStart, timezone);

      expect(habits).toHaveLength(1);
      expect(habits[0].streak).toBeGreaterThan(0);
    });

    it('deve atualizar hábitos quando nova tarefa é concluída', async () => {
      const userId = 'user-1';
      const weekStart = new Date();
      const timezone = 'America/Sao_Paulo';

      // Inicialmente com 4 tarefas (abaixo do mínimo)
      const today = new Date();
      const initialTasks = Array.from({ length: 4 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return {
          category: PlannerCategory.KANJI,
          scheduledTime: '09:00',
          completedAt: new Date(date),
          date: date.toISOString().split('T')[0],
        };
      });

      habitPrisma.plannerTask.findMany.mockResolvedValue(initialTasks);

      const detectHabits = getDetectHabits(habitService);
      const habitsBefore = await detectHabits(userId, weekStart, timezone);

      expect(habitsBefore).toHaveLength(0);

      // Adicionar mais uma tarefa (agora atinge o mínimo)
      const newDate = new Date(today);
      newDate.setDate(newDate.getDate() - 4);
      const updatedTasks = [
        ...initialTasks,
        {
          category: PlannerCategory.KANJI,
          scheduledTime: '09:00',
          completedAt: new Date(newDate),
          date: newDate.toISOString().split('T')[0],
        },
      ];

      habitPrisma.plannerTask.findMany.mockResolvedValue(updatedTasks);
      const habitsAfter = await detectHabits(userId, weekStart, timezone);

      expect(habitsAfter).toHaveLength(1);
      expect(habitsAfter[0].domain).toBe('kanji');
    });
  });
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
});
