import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImmersionType } from '@prisma/client';
import { ImmersionService } from './immersion.service';
import { ImmersionRepository } from './repositories';

describe('ImmersionService', () => {
  let service: ImmersionService;
  const repository = {
    findLogs: jest.fn(),
    countLogs: jest.fn(),
    findById: jest.fn(),
    createLog: jest.fn(),
    updateLog: jest.fn(),
    deleteLog: jest.fn(),
  };

  const baseLog = {
    id: 'log-1',
    userId: 'user-123',
    type: ImmersionType.ANIME,
    title: 'Shingeki no Kyojin',
    episode: 'EP 01',
    durationMinutes: 25,
    comprehension: 65,
    isActive: true,
    notes: null,
    loggedAt: new Date('2026-10-10T12:00:00.000Z'),
    createdAt: new Date('2026-10-10T12:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ImmersionService(
      repository as unknown as ImmersionRepository,
    );
  });

  describe('getLogs', () => {
    it('aplica defaults de paginação e ordenação', async () => {
      repository.findLogs.mockResolvedValue([baseLog]);
      repository.countLogs.mockResolvedValue(1);

      const result = await service.getLogs('user-123', {});

      expect(repository.findLogs).toHaveBeenCalledWith('user-123', {
        type: undefined,
        startDate: undefined,
        endDate: undefined,
        sort: 'loggedAt',
        order: 'desc',
        skip: 0,
        take: 20,
      });
      expect(result.pagination).toEqual({
        page: 1,
        perPage: 20,
        total: 1,
        pages: 1,
      });
      expect(result.data[0].loggedAt).toBe('2026-10-10T12:00:00.000Z');
    });

    it('calcula skip/pages a partir de page/perPage', async () => {
      repository.findLogs.mockResolvedValue([]);
      repository.countLogs.mockResolvedValue(120);

      const result = await service.getLogs('user-123', {
        page: 3,
        perPage: 50,
      });

      expect(repository.findLogs).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ skip: 100, take: 50 }),
      );
      expect(result.pagination.pages).toBe(3);
    });

    it('converte startDate/endDate em Date e valida o formato', async () => {
      repository.findLogs.mockResolvedValue([]);
      repository.countLogs.mockResolvedValue(0);

      await service.getLogs('user-123', {
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-10-10T23:59:59.000Z',
      });

      expect(repository.findLogs).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-10-10T23:59:59.000Z'),
        }),
      );

      await expect(
        service.getLogs('user-123', { startDate: 'not-a-date' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createLog', () => {
    it('faz trim e aplica defaults (isActive, loggedAt)', async () => {
      repository.createLog.mockResolvedValue(baseLog);

      await service.createLog('user-123', {
        type: ImmersionType.ANIME,
        title: '  Shingeki no Kyojin  ',
        durationMinutes: 25,
      });

      expect(repository.createLog).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          type: ImmersionType.ANIME,
          title: 'Shingeki no Kyojin',
          durationMinutes: 25,
          episode: null,
          comprehension: null,
          notes: null,
          isActive: true,
          loggedAt: expect.any(Date) as Date,
        }),
      );
    });

    it('usa loggedAt informado quando válido', async () => {
      repository.createLog.mockResolvedValue(baseLog);

      await service.createLog('user-123', {
        type: ImmersionType.ANIME,
        title: 'A',
        durationMinutes: 10,
        loggedAt: '2026-10-01T12:00:00.000Z',
      });

      expect(repository.createLog).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          loggedAt: new Date('2026-10-01T12:00:00.000Z'),
        }),
      );
    });
  });

  describe('updateLog / deleteLog', () => {
    it('lança 404 ao atualizar log inexistente', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.updateLog('user-123', 'missing', { title: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('atualiza campos parciais', async () => {
      repository.findById.mockResolvedValue(baseLog);
      repository.updateLog.mockResolvedValue({
        ...baseLog,
        durationMinutes: 30,
      });

      const result = await service.updateLog('user-123', 'log-1', {
        durationMinutes: 30,
      });

      expect(repository.updateLog).toHaveBeenCalledWith('user-123', 'log-1', {
        durationMinutes: 30,
      });
      expect(result.durationMinutes).toBe(30);
    });

    it('lança 404 ao remover log inexistente', async () => {
      repository.deleteLog.mockResolvedValue(false);
      await expect(
        service.deleteLog('user-123', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('remove log existente', async () => {
      repository.deleteLog.mockResolvedValue(true);
      const result = await service.deleteLog('user-123', 'log-1');
      expect(result).toEqual({ success: true, id: 'log-1' });
    });
  });
});
