import { Test, TestingModule } from '@nestjs/testing';
import { JLPTLevel, UserGrammarProgress } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { GrammarService } from './grammar.service';
import {
  GrammarRepository,
  UserGrammarProgressRepository,
} from './repositories';
import { GrammarFiltersDto } from './dto';
import { GrammarDetailEntity, GrammarListEntity } from './types/grammar.types';

describe('GrammarService', () => {
  let service: GrammarService;

  const grammarFindAllMock = jest.fn();
  const grammarCountMock = jest.fn();
  const grammarFindByIdFullMock = jest.fn();
  const progressFindByUserAndGrammarPointMock = jest.fn();
  const progressFindByUserAndGrammarPointsMock = jest.fn();
  const progressCreateMock = jest.fn();
  const progressUpdateMock = jest.fn();

  const filters: GrammarFiltersDto = {
    page: 1,
    perPage: 10,
    search: '〜ている',
  };

  const mockGrammar: GrammarListEntity = {
    id: 'grammar-123',
    pattern: '〜ている',
    jlptLevel: JLPTLevel.N5,
    title: 'Ação contínua',
    shortExplanation: 'Indica ação em progresso',
    detailedExplanation: 'Usado para ações que estão ocorrendo no momento',
    formalityLevel: 'neutral',
    difficulty: 1,
    position: 1,
    tags: ['verb', 'tense'],
    createdAt: new Date(),
    examples: [
      {
        japanese: '食べている',
        reading: 'たべている',
        translation: 'Estou comendo',
        position: 0,
      },
    ],
  };

  const mockProgress: UserGrammarProgress = {
    id: 'progress-123',
    userId: 'user-123',
    grammarPointId: 'grammar-123',
    isStudied: true,
    studiedAt: new Date(),
    isFavorite: false,
    confidenceLevel: 3,
    notes: null,
    reviewCount: 2,
  };

  const detailFixture: GrammarDetailEntity = {
    id: 'grammar-123',
    pattern: '〜ている',
    jlptLevel: JLPTLevel.N5,
    title: 'Ação contínua',
    shortExplanation: 'Indica ação em progresso',
    detailedExplanation: 'Usado para ações que estão ocorrendo no momento',
    formalityLevel: 'neutral',
    difficulty: 1,
    position: 1,
    tags: ['verb', 'tense'],
    createdAt: new Date(),
    examples: [
      {
        id: 'example-1',
        grammarPointId: 'grammar-123',
        japanese: '食べている',
        reading: 'たべている',
        translation: 'Estou comendo',
        notes: 'Exemplo básico',
        isNatural: true,
        position: 0,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrammarService,
        {
          provide: GrammarRepository,
          useValue: {
            findAll: grammarFindAllMock,
            count: grammarCountMock,
            findByIdFull: grammarFindByIdFullMock,
          },
        },
        {
          provide: UserGrammarProgressRepository,
          useValue: {
            findByUserAndGrammarPoint: progressFindByUserAndGrammarPointMock,
            findByUserAndGrammarPoints: progressFindByUserAndGrammarPointsMock,
            create: progressCreateMock,
            update: progressUpdateMock,
          },
        },
      ],
    }).compile();

    service = module.get(GrammarService);
    jest.clearAllMocks();
  });

  it('should return paginated results with attached user progress', async () => {
    grammarFindAllMock.mockResolvedValue([mockGrammar]);
    grammarCountMock.mockResolvedValue(1);
    progressFindByUserAndGrammarPointsMock.mockResolvedValue(
      new Map([[mockGrammar.id, mockProgress]]),
    );

    const result = await service.findAll(filters, 'user-123');

    expect(result.pagination.total).toBe(1);
    expect(result.data[0]?.shortExplanation).toBe('Indica ação em progresso');
    expect(result.data[0]?.userProgress?.confidenceLevel).toBe(3);
  });

  it('should return grammar detail with progress when item exists', async () => {
    grammarFindByIdFullMock.mockResolvedValue(detailFixture);
    progressFindByUserAndGrammarPointMock.mockResolvedValue(mockProgress);

    const result = await service.findById('grammar-123', 'user-123');

    expect(result.id).toBe('grammar-123');
    expect(result.pattern).toBe('〜ている');
    expect(result.examples[0]?.translation).toBe('Estou comendo');
    expect(result.userProgress?.isStudied).toBe(true);
  });

  it('should throw NotFoundException when detail item is missing', async () => {
    grammarFindByIdFullMock.mockResolvedValue(null);

    await expect(service.findById('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create progress on study when no progress exists', async () => {
    grammarFindByIdFullMock.mockResolvedValue(detailFixture);
    progressFindByUserAndGrammarPointMock.mockResolvedValue(null);
    progressCreateMock.mockResolvedValue(mockProgress);

    const result = await service.updateProgress('user-123', 'grammar-123', {
      action: 'study',
    });

    expect(progressCreateMock).toHaveBeenCalledWith('user-123', 'grammar-123');
    expect(result.grammarPointId).toBe('grammar-123');
    expect(result.reviewCount).toBe(2);
  });

  it('should update review progress when reviewing a studied item', async () => {
    const reviewedProgress: UserGrammarProgress = {
      ...mockProgress,
      confidenceLevel: 4,
      reviewCount: 3,
    };

    grammarFindByIdFullMock.mockResolvedValue(detailFixture);
    progressFindByUserAndGrammarPointMock.mockResolvedValue(mockProgress);
    progressUpdateMock.mockResolvedValue(reviewedProgress);

    const result = await service.updateProgress('user-123', 'grammar-123', {
      action: 'review',
      understood: true,
    });

    expect(progressUpdateMock).toHaveBeenCalled();
    expect(result.confidenceLevel).toBe(4);
    expect(result.reviewCount).toBe(3);
  });

  it('should decrease confidence when review is not understood', async () => {
    const lowProgress: UserGrammarProgress = {
      ...mockProgress,
      confidenceLevel: 2,
      reviewCount: 3,
    };

    grammarFindByIdFullMock.mockResolvedValue(detailFixture);
    progressFindByUserAndGrammarPointMock.mockResolvedValue(mockProgress);
    progressUpdateMock.mockResolvedValue(lowProgress);

    const result = await service.updateProgress('user-123', 'grammar-123', {
      action: 'review',
      understood: false,
    });

    expect(progressUpdateMock).toHaveBeenCalled();
    expect(result.confidenceLevel).toBe(2);
    expect(result.reviewCount).toBe(3);
  });
});
