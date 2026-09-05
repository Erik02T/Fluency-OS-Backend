/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { StreakService } from './streak.service';
import { PrismaService } from '../../auth/repositories/prisma.service';

describe('StreakService - Planner Integration', () => {
  let service: StreakService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    plannerTask: {
      findMany: jest.fn(),
    },
    streak: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    streakHistory: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    userPreferences: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<StreakService>(StreakService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('isDayComplete', () => {
    it('deve retornar true quando 80% das tarefas estão concluídas', async () => {
      const tasks = [
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'PENDING' },
      ];

      mockPrismaService.plannerTask.findMany.mockResolvedValue(tasks);

      const result = await service.isDayComplete('user123', '2026-08-27');

      expect(result).toBe(true);
      expect(mockPrismaService.plannerTask.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          date: '2026-08-27',
        },
        select: {
          status: true,
        },
      });
    });

    it('deve retornar false quando menos de 80% das tarefas estão concluídas', async () => {
      const tasks = [
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'PENDING' },
        { status: 'PENDING' },
        { status: 'PENDING' },
      ];

      mockPrismaService.plannerTask.findMany.mockResolvedValue(tasks);

      const result = await service.isDayComplete('user123', '2026-08-27');

      expect(result).toBe(false);
    });

    it('deve retornar false quando não há tarefas', async () => {
      mockPrismaService.plannerTask.findMany.mockResolvedValue([]);

      const result = await service.isDayComplete('user123', '2026-08-27');

      expect(result).toBe(false);
    });

    it('deve retornar true quando 100% das tarefas estão concluídas', async () => {
      const tasks = [
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
      ];

      mockPrismaService.plannerTask.findMany.mockResolvedValue(tasks);

      const result = await service.isDayComplete('user123', '2026-08-27');

      expect(result).toBe(true);
    });
  });

  describe('recordPlannerCompletion', () => {
    it('deve incrementar streak quando dia está completo e não havia registro anterior', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });

      // 4/5 = 80% - exatamente o threshold
      const tasks = [
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'PENDING' },
      ];

      mockPrismaService.plannerTask.findMany.mockResolvedValue(tasks);

      mockPrismaService.streakHistory.findUnique.mockResolvedValue(null);
      mockPrismaService.streak.findUnique.mockResolvedValue(null);
      mockPrismaService.streak.create.mockResolvedValue({
        id: 'streak123',
        currentStreak: 1,
        longestStreak: 1,
      });
      mockPrismaService.streak.update.mockResolvedValue({
        id: 'streak123',
        currentStreak: 1,
        longestStreak: 1,
      });

      mockPrismaService.streakHistory.upsert.mockResolvedValue({});

      const result = await service.recordPlannerCompletion('user123');

      expect(result).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        dayComplete: true,
      });

      expect(mockPrismaService.streak.create).toHaveBeenCalled();
      expect(mockPrismaService.streakHistory.upsert).toHaveBeenCalledWith({
        where: {
          userId_activityDate: {
            userId: 'user123',
            activityDate: expect.any(String),
          },
        },
        create: {
          userId: 'user123',
          streakId: 'streak123',
          activityDate: expect.any(String),
          timezone: 'America/Sao_Paulo',
          plannerTasksCompleted: 4,
          plannerTasksTotal: 5,
        },
        update: {
          plannerTasksCompleted: 4,
          plannerTasksTotal: 5,
        },
      });
    });

    it('deve ser idempotente - não incrementar streak se já registrado hoje', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });

      // Para que o dia seja considerado completo (100% de 2 tarefas)
      const tasks = [{ status: 'COMPLETED' }, { status: 'COMPLETED' }];

      mockPrismaService.plannerTask.findMany.mockResolvedValue(tasks);

      mockPrismaService.streakHistory.findUnique.mockResolvedValue({
        plannerTasksCompleted: 2,
      });

      mockPrismaService.streak.findUnique.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
      });

      const result = await service.recordPlannerCompletion('user123');

      expect(result).toEqual({
        currentStreak: 5,
        longestStreak: 10,
        dayComplete: true,
      });

      expect(mockPrismaService.streak.create).not.toHaveBeenCalled();
      expect(mockPrismaService.streak.update).not.toHaveBeenCalled();
    });

    it('deve não incrementar streak quando dia não está completo', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });

      mockPrismaService.plannerTask.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'PENDING' },
        { status: 'PENDING' },
      ]);

      mockPrismaService.streak.findUnique.mockResolvedValue({
        currentStreak: 3,
        longestStreak: 5,
      });

      const result = await service.recordPlannerCompletion('user123');

      expect(result).toEqual({
        currentStreak: 3,
        longestStreak: 5,
        dayComplete: false,
      });

      expect(mockPrismaService.streak.create).not.toHaveBeenCalled();
      expect(mockPrismaService.streak.update).not.toHaveBeenCalled();
    });
  });

  describe('recalculateAfterUndo', () => {
    it('deve marcar dia como incompleto quando tarefa é desfeita', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });

      mockPrismaService.plannerTask.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'PENDING' },
        { status: 'PENDING' },
      ]);

      mockPrismaService.streak.findUnique.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
      });

      mockPrismaService.streakHistory.update.mockResolvedValue({});

      const result = await service.recalculateAfterUndo('user123');

      expect(result).toEqual({
        currentStreak: 5,
        longestStreak: 10,
        dayComplete: false,
      });

      expect(mockPrismaService.streakHistory.update).toHaveBeenCalledWith({
        where: {
          userId_activityDate: {
            userId: 'user123',
            activityDate: expect.any(String),
          },
        },
        data: {
          plannerTasksCompleted: 0,
        },
      });
    });

    it('deve manter dia como completo se ainda houver 80% de tarefas concluídas', async () => {
      mockPrismaService.userPreferences.findUnique.mockResolvedValue({
        timezone: 'America/Sao_Paulo',
      });

      mockPrismaService.plannerTask.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'PENDING' },
      ]);

      mockPrismaService.streak.findUnique.mockResolvedValue({
        currentStreak: 5,
        longestStreak: 10,
      });

      const result = await service.recalculateAfterUndo('user123');

      expect(result).toEqual({
        currentStreak: 5,
        longestStreak: 10,
        dayComplete: true,
      });

      expect(mockPrismaService.streakHistory.update).not.toHaveBeenCalled();
    });
  });
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars */
