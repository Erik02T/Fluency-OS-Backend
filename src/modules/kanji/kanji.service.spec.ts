import { Test, TestingModule } from '@nestjs/testing';
import type { UserKanjiProgress } from '@prisma/client';
import { JLPTLevel, ReadingType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { KanjiService } from './kanji.service';
import { KanjiRepository, UserKanjiProgressRepository } from './repositories';
import type { KanjiFiltersDto } from './dto';
import type { KanjiListEntity } from './types/kanji.types';
import type { KanjiDetailEntity } from './types/kanji.types';

describe('KanjiService', () => {
  let service: KanjiService;
  let kanjiRepository: jest.Mocked<KanjiRepository>;
  let userProgressRepository: jest.Mocked<UserKanjiProgressRepository>;

  const filters: KanjiFiltersDto = {
    page: 2,
    perPage: 10,
  };

  const mockKanji: KanjiListEntity = {
    id: 'kanji-123',
    character: '日',
    unicodeCodepoint: 'U+65E5',
    jlptLevel: JLPTLevel.N5,
    grade: 1,
    strokeCount: 4,
    frequency: 1,
    notes: null,
    romanization: 'nichi',
    createdAt: new Date(),
    meanings: [{ meaning: 'sol' }],
    readings: [
      {
        reading: 'ニチ',
        type: ReadingType.ONYOMI,
        isPrimary: true,
        romanji: 'nichi',
      },
      {
        reading: 'ひ',
        type: ReadingType.KUNYOMI,
        isPrimary: true,
        romanji: 'hi',
      },
    ],
  };

  const mockProgress: UserKanjiProgress = {
    id: 'progress-123',
    userId: 'user-123',
    kanjiId: 'kanji-123',
    srsLevel: 4,
    easeFactor: 2.5,
    intervalDays: 7,
    nextReviewAt: new Date(),
    lastReviewAt: null,
    totalReviews: 8,
    correctReviews: 7,
    isMastered: false,
    isFavorite: true,
    isSuspended: false,
    addedAt: new Date(),
    masteredAt: null,
  };

  const detailKanjiFixture: KanjiDetailEntity = {
    ...mockKanji,
    meanings: [
      {
        id: 'meaning-1',
        kanjiId: mockKanji.id,
        meaning: 'sol',
        isPrimary: true,
        language: 'pt-BR',
        position: 0,
      },
    ],
    readings: mockKanji.readings.map((reading, index) => ({
      id: `reading-${index}`,
      kanjiId: mockKanji.id,
      ...reading,
    })),
    examples: [],
    radicals: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KanjiService,
        {
          provide: KanjiRepository,
          useValue: {
            findAll: jest.fn(),
            count: jest.fn(),
            findByIdFull: jest.fn(),
            search: jest.fn(),
            findByCharacter: jest.fn(),
            createAdminKanji: jest.fn(),
            updateAdminKanji: jest.fn(),
            deleteAdminKanji: jest.fn(),
          },
        },
        {
          provide: UserKanjiProgressRepository,
          useValue: {
            findByUserAndKanjis: jest.fn(),
            findByUserAndKanji: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(KanjiService);
    kanjiRepository = module.get(KanjiRepository);
    userProgressRepository = module.get(UserKanjiProgressRepository);
  });

  it('should return paginated results using the filtered total', async () => {
    kanjiRepository.findAll.mockResolvedValue([mockKanji]);
    kanjiRepository.count.mockResolvedValue(25);
    userProgressRepository.findByUserAndKanjis.mockResolvedValue(new Map());

    const result = await service.findAll(filters, 'user-123');

    expect(kanjiRepository.findAll.mock.calls[0]).toEqual([
      filters,
      'user-123',
    ]);
    expect(kanjiRepository.count.mock.calls[0]).toEqual([filters, 'user-123']);
    expect(result.pagination).toEqual({
      page: 2,
      perPage: 10,
      total: 25,
      pages: 3,
    });
  });

  it('should attach user progress to list items', async () => {
    kanjiRepository.findAll.mockResolvedValue([mockKanji]);
    kanjiRepository.count.mockResolvedValue(1);
    userProgressRepository.findByUserAndKanjis.mockResolvedValue(
      new Map([[mockKanji.id, mockProgress]]),
    );

    const result = await service.findAll(filters, 'user-123');

    expect(result.data[0]?.userProgress).toEqual({
      srsLevel: 4,
      isMastered: false,
      isFavorited: true,
      isSuspended: false,
    });
  });

  it('should return an empty page for true progress filters without a user', async () => {
    const progressFilter: KanjiFiltersDto = {
      page: 1,
      perPage: 20,
      mastered: true,
    };
    kanjiRepository.findAll.mockResolvedValue([]);
    kanjiRepository.count.mockResolvedValue(0);

    const result = await service.findAll(progressFilter);

    expect(kanjiRepository.findAll.mock.calls[0]).toEqual([
      progressFilter,
      undefined,
    ]);
    expect(result).toEqual({
      data: [],
      pagination: {
        page: 1,
        perPage: 20,
        total: 0,
        pages: 0,
      },
    });
  });

  describe('findById', () => {
    it('should return kanji detail with user progress', async () => {
      kanjiRepository.findByIdFull.mockResolvedValue(detailKanjiFixture);
      userProgressRepository.findByUserAndKanji.mockResolvedValue(mockProgress);

      const result = await service.findById('kanji-123', 'user-123');

      expect(kanjiRepository.findByIdFull.mock.calls[0]).toEqual(['kanji-123']);
      expect(result.id).toBe('kanji-123');
      expect(result.character).toBe('日');
      expect(result.userProgress?.srsLevel).toBe(4);
    });

    it('should throw NotFoundException when kanji does not exist', async () => {
      kanjiRepository.findByIdFull.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('should return search results with user progress', async () => {
      kanjiRepository.search.mockResolvedValue([mockKanji]);
      userProgressRepository.findByUserAndKanjis.mockResolvedValue(
        new Map([[mockKanji.id, mockProgress]]),
      );

      const result = await service.search('sol', 'user-123', 10);

      expect(kanjiRepository.search.mock.calls[0]).toEqual(['sol', 10]);
      expect(result).toHaveLength(1);
      expect(result[0]?.meanings).toEqual(['sol']);
      expect(result[0]?.userProgress?.isFavorited).toBe(true);
    });

    it('should pass custom limit to repository', async () => {
      kanjiRepository.search.mockResolvedValue([]);

      await service.search('日', undefined, 25);

      expect(kanjiRepository.search.mock.calls[0]).toEqual(['日', 25]);
    });
  });

  describe('admin CRUD', () => {
    const adminCreateDto = {
      character: '火',
      unicodeCodepoint: 'U+706B',
      jlptLevel: JLPTLevel.N5,
      grade: 1,
      strokeCount: 4,
      frequency: 10,
      notes: 'fire',
      romanization: 'ka',
      meanings: [{ meaning: 'fogo', language: 'pt-BR', isPrimary: true }],
      readings: [
        {
          reading: 'カ',
          type: 'ONYOMI' as const,
          romanji: 'ka',
          isPrimary: true,
        },
      ],
      examples: [],
      radicals: [],
    };

    const adminDetailKanji = {
      ...detailKanjiFixture,
      character: '火',
    };

    it('should create admin kanji when character is new', async () => {
      kanjiRepository.findByCharacter.mockResolvedValue(null);
      kanjiRepository.createAdminKanji.mockResolvedValue(adminDetailKanji);

      const result = await service.createAdminKanji(adminCreateDto);

      expect(kanjiRepository.findByCharacter.mock.calls[0]).toEqual(['火']);
      expect(kanjiRepository.createAdminKanji.mock.calls[0]).toEqual([
        adminCreateDto,
      ]);
      expect(result.character).toBe('火');
    });

    it('should reject duplicate admin kanji creation', async () => {
      kanjiRepository.findByCharacter.mockResolvedValue(detailKanjiFixture);

      await expect(service.createAdminKanji(adminCreateDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update admin kanji and return full detail', async () => {
      kanjiRepository.findByCharacter.mockResolvedValue(null);
      kanjiRepository.updateAdminKanji.mockResolvedValue(adminDetailKanji);

      const result = await service.updateAdminKanji('kanji-123', {
        grade: 2,
        meanings: [{ meaning: 'fogo', language: 'pt-BR', isPrimary: true }],
        readings: [{ reading: 'カ', type: 'ONYOMI', romanji: 'ka' }],
      });

      expect(kanjiRepository.updateAdminKanji.mock.calls[0]).toEqual([
        'kanji-123',
        expect.objectContaining({ grade: 2 }),
      ]);
      expect(result.character).toBe('火');
    });

    it('should reject admin update when character conflicts with another kanji', async () => {
      const conflictingKanji: KanjiDetailEntity = {
        ...detailKanjiFixture,
        id: 'other-id',
      };

      kanjiRepository.findByCharacter.mockResolvedValue(conflictingKanji);

      await expect(
        service.updateAdminKanji('kanji-123', {
          character: '日',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when updating missing kanji', async () => {
      kanjiRepository.findByCharacter.mockResolvedValue(null);
      kanjiRepository.updateAdminKanji.mockResolvedValue(null);

      await expect(
        service.updateAdminKanji('missing-id', { grade: 3 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete admin kanji when it exists', async () => {
      kanjiRepository.deleteAdminKanji.mockResolvedValue(true);

      await expect(
        service.deleteAdminKanji('kanji-123'),
      ).resolves.toBeUndefined();
      expect(kanjiRepository.deleteAdminKanji.mock.calls[0]).toEqual([
        'kanji-123',
      ]);
    });

    it('should throw NotFoundException when deleting missing kanji', async () => {
      kanjiRepository.deleteAdminKanji.mockResolvedValue(false);

      await expect(service.deleteAdminKanji('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
