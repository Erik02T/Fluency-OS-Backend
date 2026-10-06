import { Test, TestingModule } from '@nestjs/testing';
import { ImmersionType, ImmersionLog } from '@prisma/client';
import { ImmersionService } from './immersion.service';
import { ImmersionRepository } from './repositories';
import { CreateImmersionLogDto, ImmersionLogFiltersDto } from './dto';

describe('ImmersionService', () => {
  let service: ImmersionService;

  const immersionCreateMock = jest.fn();
  const immersionFindAllByUserMock = jest.fn();
  const immersionCountByUserMock = jest.fn();

  const now = new Date();

  const mockImmersionLog: ImmersionLog = {
    id: 'immersion-123',
    userId: 'user-123',
    type: ImmersionType.ANIME,
    title: 'Attack on Titan EP 1',
    episode: 'EP 01',
    durationMinutes: 24,
    comprehension: 75,
    isActive: true,
    notes: 'Muitos vocabulários novos de batalha',
    loggedAt: now,
    createdAt: now,
  };

  const createDto: CreateImmersionLogDto = {
    type: ImmersionType.ANIME,
    title: 'Attack on Titan EP 1',
    durationMinutes: 24,
    episode: 'EP 01',
    comprehension: 75,
    notes: 'Muitos vocabulários novos de batalha',
  };

  const filters: ImmersionLogFiltersDto = {
    page: 1,
    perPage: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImmersionService,
        {
          provide: ImmersionRepository,
          useValue: {
            create: immersionCreateMock,
            findAllByUser: immersionFindAllByUserMock,
            countByUser: immersionCountByUserMock,
          },
        },
      ],
    }).compile();

    service = module.get(ImmersionService);
    jest.clearAllMocks();
  });

  it('deve criar um log de imersão com dados válidos', async () => {
    immersionCreateMock.mockResolvedValue(mockImmersionLog);

    const result = await service.create('user-123', createDto);

    expect(immersionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        type: ImmersionType.ANIME,
        title: 'Attack on Titan EP 1',
        durationMinutes: 24,
      }),
    );
    expect(result.id).toBe('immersion-123');
    expect(result.type).toBe(ImmersionType.ANIME);
    expect(result.durationMinutes).toBe(24);
    expect(result.userId).toBe('user-123');
  });

  it('deve criar log de imersão com data customizada', async () => {
    const customDate = new Date('2024-06-15T19:00:00Z');
    const logWithCustomDate: ImmersionLog = {
      ...mockImmersionLog,
      loggedAt: customDate,
    };
    immersionCreateMock.mockResolvedValue(logWithCustomDate);

    const result = await service.create('user-123', {
      ...createDto,
      loggedAt: customDate,
    });

    expect(immersionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        loggedAt: customDate,
      }),
    );
    expect(result.loggedAt).toBe(customDate);
  });

  it('deve criar log de imersão sem campos opcionais', async () => {
    const minimalLog: ImmersionLog = {
      id: 'immersion-456',
      userId: 'user-123',
      type: ImmersionType.PODCAST,
      title: 'Japanese Podcast #42',
      episode: null,
      durationMinutes: 45,
      comprehension: null,
      isActive: true,
      notes: null,
      loggedAt: now,
      createdAt: now,
    };
    immersionCreateMock.mockResolvedValue(minimalLog);

    const minimalDto: CreateImmersionLogDto = {
      type: ImmersionType.PODCAST,
      title: 'Japanese Podcast #42',
      durationMinutes: 45,
    };

    const result = await service.create('user-123', minimalDto);

    expect(result.id).toBe('immersion-456');
    expect(result.episode).toBeNull();
    expect(result.comprehension).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('deve listar logs paginados apenas do usuário autenticado', async () => {
    const anotherLog: ImmersionLog = {
      id: 'immersion-789',
      userId: 'user-123',
      type: ImmersionType.MANGA,
      title: 'One Piece Cap 1000',
      episode: 'Cap 1000',
      durationMinutes: 30,
      comprehension: 80,
      isActive: true,
      notes: null,
      loggedAt: now,
      createdAt: now,
    };

    immersionFindAllByUserMock.mockResolvedValue([
      mockImmersionLog,
      anotherLog,
    ]);
    immersionCountByUserMock.mockResolvedValue(2);

    const result = await service.findAll('user-123', filters);

    expect(immersionFindAllByUserMock).toHaveBeenCalledWith(
      'user-123',
      filters,
    );
    expect(result.data.length).toBe(2);
    expect(result.data[0]?.userId).toBe('user-123');
    expect(result.data[1]?.userId).toBe('user-123');
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.perPage).toBe(10);
    expect(result.pagination.pages).toBe(1);
  });

  it('deve aplicar filtro por tipo de atividade na listagem', async () => {
    const filteredFilters: ImmersionLogFiltersDto = {
      ...filters,
      type: ImmersionType.ANIME,
    };

    immersionFindAllByUserMock.mockResolvedValue([mockImmersionLog]);
    immersionCountByUserMock.mockResolvedValue(1);

    const result = await service.findAll('user-123', filteredFilters);

    expect(immersionFindAllByUserMock).toHaveBeenCalledWith(
      'user-123',
      filteredFilters,
    );
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.type).toBe(ImmersionType.ANIME);
  });

  it('deve retornar lista vazia quando usuário não possui logs', async () => {
    immersionFindAllByUserMock.mockResolvedValue([]);
    immersionCountByUserMock.mockResolvedValue(0);

    const result = await service.findAll('user-123', filters);

    expect(result.data.length).toBe(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.pages).toBe(0);
  });

  it('deve mapear corretamente todos os campos do DTO de resposta', async () => {
    immersionCreateMock.mockResolvedValue(mockImmersionLog);

    const result = await service.create('user-123', createDto);

    expect(result).toMatchObject({
      id: 'immersion-123',
      userId: 'user-123',
      type: ImmersionType.ANIME,
      title: 'Attack on Titan EP 1',
      episode: 'EP 01',
      durationMinutes: 24,
      comprehension: 75,
      isActive: true,
      notes: 'Muitos vocabulários novos de batalha',
    });
    expect(result.loggedAt).toBeInstanceOf(Date);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
