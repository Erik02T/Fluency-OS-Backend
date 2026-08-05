import { Test, TestingModule } from '@nestjs/testing';
import { JLPTLevel, UserVocabularyProgress } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import {
  UserVocabularyProgressRepository,
  VocabularyRepository,
} from './repositories';
import { VocabularyFiltersDto } from './dto';
import {
  VocabularyDetailEntity,
  VocabularyListEntity,
} from './types/vocabulary.types';

describe('VocabularyService', () => {
  let service: VocabularyService;
  let vocabularyRepository: jest.Mocked<VocabularyRepository>;
  let userProgressRepository: jest.Mocked<UserVocabularyProgressRepository>;

  const filters: VocabularyFiltersDto = {
    page: 1,
    perPage: 10,
    search: '食べる',
  };

  const mockVocabulary: VocabularyListEntity = {
    id: 'vocab-123',
    word: '食べる',
    reading: 'たべる',
    jlptLevel: JLPTLevel.N5,
    frequency: 120,
    partOfSpeech: 'verb',
    tags: ['daily'],
    notes: null,
    audioUrl: null,
    createdAt: new Date(),
    meanings: [
      {
        meaning: 'comer',
        isPrimary: true,
        position: 0,
      },
    ],
  };

  const mockProgress: UserVocabularyProgress = {
    id: 'progress-123',
    userId: 'user-123',
    vocabularyId: 'vocab-123',
    srsLevel: 3,
    easeFactor: 2.5,
    intervalDays: 4,
    nextReviewAt: new Date(),
    lastReviewAt: null,
    totalReviews: 2,
    correctReviews: 2,
    isMastered: false,
    isFavorite: true,
    isSuspended: false,
    addedAt: new Date(),
    masteredAt: null,
  };

  const detailFixture: VocabularyDetailEntity = {
    id: 'vocab-123',
    word: '食べる',
    reading: 'たべる',
    jlptLevel: JLPTLevel.N5,
    frequency: 120,
    partOfSpeech: 'verb',
    tags: ['daily'],
    notes: 'verbo comum',
    audioUrl: null,
    createdAt: new Date(),
    meanings: [
      {
        id: 'meaning-1',
        vocabularyId: 'vocab-123',
        meaning: 'comer',
        context: null,
        isPrimary: true,
        position: 0,
      },
    ],
    examples: [
      {
        id: 'example-1',
        vocabularyId: 'vocab-123',
        japanese: '寿司を食べる。',
        reading: 'すしをたべる。',
        translation: 'Comer sushi.',
        source: 'Teste',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VocabularyService,
        {
          provide: VocabularyRepository,
          useValue: {
            findAll: jest.fn(),
            count: jest.fn(),
            findByIdFull: jest.fn(),
          },
        },
        {
          provide: UserVocabularyProgressRepository,
          useValue: {
            findByUserAndVocabulary: jest.fn(),
            findByUserAndVocabularies: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(VocabularyService);
    vocabularyRepository = module.get(VocabularyRepository);
    userProgressRepository = module.get(UserVocabularyProgressRepository);
  });

  it('should return paginated results with attached user progress', async () => {
    vocabularyRepository.findAll.mockResolvedValue([mockVocabulary]);
    vocabularyRepository.count.mockResolvedValue(1);
    userProgressRepository.findByUserAndVocabularies.mockResolvedValue(
      new Map([[mockVocabulary.id, mockProgress]]),
    );

    const result = await service.findAll(filters, 'user-123');

    expect(result.pagination.total).toBe(1);
    expect(result.data[0]?.primaryMeaning).toBe('comer');
    expect(result.data[0]?.userProgress?.isFavorited).toBe(true);
  });

  it('should return vocabulary detail with progress when item exists', async () => {
    vocabularyRepository.findByIdFull.mockResolvedValue(detailFixture);
    userProgressRepository.findByUserAndVocabulary.mockResolvedValue(
      mockProgress,
    );

    const result = await service.findById('vocab-123', 'user-123');

    expect(result.id).toBe('vocab-123');
    expect(result.meanings[0]?.meaning).toBe('comer');
    expect(result.userProgress?.srsLevel).toBe(3);
  });

  it('should throw NotFoundException when detail item is missing', async () => {
    vocabularyRepository.findByIdFull.mockResolvedValue(null);

    await expect(service.findById('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create progress on study when no progress exists', async () => {
    vocabularyRepository.findByIdFull.mockResolvedValue(detailFixture);
    userProgressRepository.findByUserAndVocabulary.mockResolvedValue(null);
    userProgressRepository.create.mockResolvedValue(mockProgress);

    const result = await service.updateProgress('user-123', 'vocab-123', {
      action: 'study',
    });

    expect(userProgressRepository.create).toHaveBeenCalledWith(
      'user-123',
      'vocab-123',
    );
    expect(result.vocabularyId).toBe('vocab-123');
    expect(result.totalReviews).toBe(2);
  });

  it('should update review progress when reviewing a studied item', async () => {
    const reviewedProgress: UserVocabularyProgress = {
      ...mockProgress,
      srsLevel: 4,
      intervalDays: 8,
      totalReviews: 3,
      correctReviews: 3,
      lastReviewAt: new Date(),
    };

    vocabularyRepository.findByIdFull.mockResolvedValue(detailFixture);
    userProgressRepository.findByUserAndVocabulary.mockResolvedValue(
      mockProgress,
    );
    userProgressRepository.update.mockResolvedValue(reviewedProgress);

    const result = await service.updateProgress('user-123', 'vocab-123', {
      action: 'review',
      correct: true,
    });

    expect(userProgressRepository.update).toHaveBeenCalled();
    expect(result.srsLevel).toBe(4);
    expect(result.correctReviews).toBe(3);
  });
});
