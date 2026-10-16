import { Test, TestingModule } from '@nestjs/testing';
import { JLPTLevel, UserVocabularyProgress, Prisma } from '@prisma/client';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { VocabularyService } from './vocabulary.service';
import { SrsService } from '../review/srs.service';
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

  const vocabFindAllMock = jest.fn();
  const vocabCountMock = jest.fn();
  const vocabFindByIdFullMock = jest.fn();
  const vocabFindByWordAndReadingMock = jest.fn();
  const vocabCreateAdminMock = jest.fn();
  const vocabUpdateAdminMock = jest.fn();
  const vocabDeleteAdminMock = jest.fn();
  const progressFindByUserAndVocabularyMock = jest.fn();
  const progressFindByUserAndVocabulariesMock = jest.fn();
  const progressCreateMock = jest.fn();
  const progressUpdateMock = jest.fn();

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
        SrsService,
        {
          provide: VocabularyRepository,
          useValue: {
            findAll: vocabFindAllMock,
            count: vocabCountMock,
            findByIdFull: vocabFindByIdFullMock,
            findByWordAndReading: vocabFindByWordAndReadingMock,
            createAdminVocabulary: vocabCreateAdminMock,
            updateAdminVocabulary: vocabUpdateAdminMock,
            deleteAdminVocabulary: vocabDeleteAdminMock,
          },
        },
        {
          provide: UserVocabularyProgressRepository,
          useValue: {
            findByUserAndVocabulary: progressFindByUserAndVocabularyMock,
            findByUserAndVocabularies: progressFindByUserAndVocabulariesMock,
            create: progressCreateMock,
            update: progressUpdateMock,
          },
        },
      ],
    }).compile();

    service = module.get(VocabularyService);
    jest.clearAllMocks();
  });

  it('should return paginated results with attached user progress', async () => {
    vocabFindAllMock.mockResolvedValue([mockVocabulary]);
    vocabCountMock.mockResolvedValue(1);
    progressFindByUserAndVocabulariesMock.mockResolvedValue(
      new Map([[mockVocabulary.id, mockProgress]]),
    );

    const result = await service.findAll(filters, 'user-123');

    expect(result.pagination.total).toBe(1);
    expect(result.data[0]?.primaryMeaning).toBe('comer');
    expect(result.data[0]?.userProgress?.isFavorited).toBe(true);
  });

  it('should return vocabulary detail with progress when item exists', async () => {
    vocabFindByIdFullMock.mockResolvedValue(detailFixture);
    progressFindByUserAndVocabularyMock.mockResolvedValue(mockProgress);

    const result = await service.findById('vocab-123', 'user-123');

    expect(result.id).toBe('vocab-123');
    expect(result.meanings[0]?.meaning).toBe('comer');
    expect(result.userProgress?.srsLevel).toBe(3);
  });

  it('should throw NotFoundException when detail item is missing', async () => {
    vocabFindByIdFullMock.mockResolvedValue(null);

    await expect(service.findById('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create progress on study when no progress exists', async () => {
    vocabFindByIdFullMock.mockResolvedValue(detailFixture);
    progressFindByUserAndVocabularyMock.mockResolvedValue(null);
    progressCreateMock.mockResolvedValue(mockProgress);

    const result = await service.updateProgress('user-123', 'vocab-123', {
      action: 'study',
    });

    expect(progressCreateMock).toHaveBeenCalledWith('user-123', 'vocab-123');
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

    vocabFindByIdFullMock.mockResolvedValue(detailFixture);
    progressFindByUserAndVocabularyMock.mockResolvedValue(mockProgress);
    progressUpdateMock.mockResolvedValue(reviewedProgress);

    const result = await service.updateProgress('user-123', 'vocab-123', {
      action: 'review',
      correct: true,
    });

    expect(progressUpdateMock).toHaveBeenCalled();
    expect(result.srsLevel).toBe(4);
    expect(result.correctReviews).toBe(3);
  });

  describe('admin CRUD', () => {
    const adminCreateDto = {
      word: '飲む',
      reading: 'のむ',
      jlptLevel: JLPTLevel.N5,
      partOfSpeech: 'verb',
      meanings: [{ meaning: 'beber', isPrimary: true }],
    };

    it('should create a vocabulary when word does not exist', async () => {
      vocabFindByWordAndReadingMock.mockResolvedValue(null);
      vocabCreateAdminMock.mockResolvedValue(detailFixture);

      const result = await service.createAdminVocabulary(adminCreateDto);

      expect(vocabFindByWordAndReadingMock).toHaveBeenCalledWith(
        adminCreateDto.word,
        adminCreateDto.reading,
      );
      expect(vocabCreateAdminMock).toHaveBeenCalledWith(adminCreateDto);
      expect(result.id).toBe(detailFixture.id);
      expect(result.word).toBe(detailFixture.word);
    });

    it('should throw ConflictException when word already exists', async () => {
      vocabFindByWordAndReadingMock.mockResolvedValue(detailFixture);

      await expect(
        service.createAdminVocabulary(adminCreateDto),
      ).rejects.toThrow(ConflictException);
      expect(vocabCreateAdminMock).not.toHaveBeenCalled();
    });

    it('should update a vocabulary when it exists', async () => {
      vocabFindByWordAndReadingMock.mockResolvedValue(null);
      vocabUpdateAdminMock.mockResolvedValue({
        ...detailFixture,
        notes: 'atualizado',
      });

      const result = await service.updateAdminVocabulary('vocab-123', {
        notes: 'atualizado',
      });

      expect(vocabUpdateAdminMock).toHaveBeenCalledWith('vocab-123', {
        notes: 'atualizado',
      });
      expect(result.notes).toBe('atualizado');
    });

    it('should throw ConflictException when updating to a duplicate word', async () => {
      vocabFindByWordAndReadingMock.mockResolvedValue({
        ...detailFixture,
        id: 'another-vocab-id',
      });

      await expect(
        service.updateAdminVocabulary('vocab-123', {
          word: adminCreateDto.word,
          reading: adminCreateDto.reading,
        }),
      ).rejects.toThrow(ConflictException);
      expect(vocabUpdateAdminMock).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating a missing vocabulary', async () => {
      vocabFindByWordAndReadingMock.mockResolvedValue(null);
      vocabUpdateAdminMock.mockResolvedValue(null);

      await expect(
        service.updateAdminVocabulary('missing-id', { notes: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete a vocabulary when it exists', async () => {
      vocabDeleteAdminMock.mockResolvedValue(true);

      await expect(
        service.deleteAdminVocabulary('vocab-123'),
      ).resolves.toBeUndefined();
      expect(vocabDeleteAdminMock).toHaveBeenCalledWith('vocab-123');
    });

    it('should throw NotFoundException when deleting a missing vocabulary', async () => {
      vocabDeleteAdminMock.mockResolvedValue(false);

      await expect(service.deleteAdminVocabulary('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('review progress uses documented SM-2 via SrsService', () => {
    const setupProgress = (overrides: Record<string, unknown>) => {
      vocabFindByIdFullMock.mockResolvedValue(detailFixture);
      progressFindByUserAndVocabularyMock.mockResolvedValue({
        ...mockProgress,
        ...overrides,
      });
      progressUpdateMock.mockImplementation(
        (
          _userId: string,
          _vocabularyId: string,
          data: Prisma.UserVocabularyProgressUpdateInput,
        ) =>
          Promise.resolve({
            ...mockProgress,
            ...overrides,
            srsLevel: data.srsLevel as number,
            easeFactor: data.easeFactor as number,
            intervalDays: data.intervalDays as number,
            nextReviewAt: data.nextReviewAt as Date,
            lastReviewAt: new Date(),
            totalReviews: data.totalReviews as number,
            correctReviews: data.correctReviews as number,
            isMastered: data.isMastered as boolean,
            masteredAt: data.masteredAt as Date | null,
          } as never),
      );
    };

    it('applies quality 2 (OK) when correct: true', async () => {
      setupProgress({});

      const result = await service.updateProgress('user-123', 'vocab-123', {
        action: 'review',
        correct: true,
      });

      // SM-2 quality 2: level 3→4, interval ceil(4 × 2.5) = 10
      expect(result.srsLevel).toBe(4);
      expect(result.intervalDays).toBe(10);
      expect(result.easeFactor).toBe(2.5);
      expect(result.totalReviews).toBe(3);
      expect(result.correctReviews).toBe(3);
    });

    it('applies quality 0 (fail) when correct: false', async () => {
      setupProgress({ srsLevel: 4, intervalDays: 10 });

      const result = await service.updateProgress('user-123', 'vocab-123', {
        action: 'review',
        correct: false,
      });

      // SM-2 quality 0: level 4→3, interval reseta para 1
      expect(result.srsLevel).toBe(3);
      expect(result.intervalDays).toBe(1);
      expect(result.totalReviews).toBe(3);
      expect(result.correctReviews).toBe(2);
    });
  });
});
