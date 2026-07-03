import { Test, TestingModule } from '@nestjs/testing';
import type { Kanji, KanjiMeaning, KanjiReading } from '@prisma/client';
import { JLPTLevel, ReadingType } from '@prisma/client';
import { KanjiRepository } from './kanji.repository';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { KanjiFiltersDto } from '../dto';
import type { KanjiListEntity } from '../types/kanji.types';

describe('KanjiRepository', () => {
  let repository: KanjiRepository;
  let prismaService: PrismaService;

  const mockKanjiBase: Kanji = {
    id: 'kanji-123',
    character: '日',
    unicodeCodepoint: 'U+65E5',
    jlptLevel: JLPTLevel.N5,
    grade: 1,
    strokeCount: 4,
    frequency: 1,
    notes: 'Day, sun',
    romanization: 'nichi',
    createdAt: new Date(),
  };

  type KanjiWithRelations = Kanji & {
    meanings: KanjiMeaning[];
    readings: KanjiReading[];
  };

  const mockKanjiWithRelations: KanjiWithRelations = {
    ...mockKanjiBase,
    meanings: [
      {
        id: 'meaning-1',
        kanjiId: 'kanji-123',
        meaning: 'sun',
        isPrimary: true,
        language: 'en',
        position: 0,
      },
    ],
    readings: [
      {
        id: 'reading-1',
        kanjiId: 'kanji-123',
        reading: 'ニチ',
        type: ReadingType.ONYOMI,
        isPrimary: true,
        romanji: 'nichi',
      },
    ],
  };

  const mockKanjiListEntity: KanjiListEntity = {
    ...mockKanjiBase,
    meanings: [{ meaning: 'sun' }],
    readings: [
      {
        reading: 'ニチ',
        type: ReadingType.ONYOMI,
        isPrimary: true,
        romanji: 'nichi',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KanjiRepository,
        {
          provide: PrismaService,
          useValue: {
            kanji: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
            },
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<KanjiRepository>(KanjiRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('should return list of kanjis with pagination', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      const result = await repository.findAll(filters);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0]?.character).toBe('日');
      expect(findManySpy).toHaveBeenCalled();
    });

    it('should filter by JLPT level', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        jlpt: JLPTLevel.N5,
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters);

      expect(findManySpy).toHaveBeenCalledTimes(1);
      const callArgs = findManySpy.mock.calls[0]?.[0] as {
        where: { AND: Array<{ jlptLevel?: JLPTLevel }> };
      };
      expect(callArgs.where.AND).toEqual(
        expect.arrayContaining([{ jlptLevel: JLPTLevel.N5 }]),
      );
    });

    it('should filter by grade', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        grade: 1,
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters);

      expect(findManySpy).toHaveBeenCalledTimes(1);
      const callArgs = findManySpy.mock.calls[0]?.[0] as {
        where: { AND: Array<{ grade?: number }> };
      };
      expect(callArgs.where.AND).toEqual(
        expect.arrayContaining([{ grade: 1 }]),
      );
    });
  });

  describe('findByIdFull', () => {
    it('should return full kanji details', async () => {
      jest
        .spyOn(prismaService.kanji, 'findUnique')
        .mockResolvedValue(mockKanjiWithRelations);

      const result = await repository.findByIdFull('kanji-123');

      expect(result).toBeDefined();
      expect(result?.character).toBe('日');
      expect(result?.meanings).toBeDefined();
      expect(result?.readings).toBeDefined();
    });

    it('should return null if kanji not found', async () => {
      jest.spyOn(prismaService.kanji, 'findUnique').mockResolvedValue(null);

      const result = await repository.findByIdFull('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByCharacter', () => {
    it('should find kanji by character', async () => {
      const findUniqueSpy = jest
        .spyOn(prismaService.kanji, 'findUnique')
        .mockResolvedValue(mockKanjiWithRelations);

      const result = await repository.findByCharacter('日');

      expect(result).toBeDefined();
      expect(result?.character).toBe('日');
      expect(findUniqueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { character: '日' },
        }),
      );
    });
  });

  describe('count', () => {
    it('should return total count of kanjis', async () => {
      const countSpy = jest
        .spyOn(prismaService.kanji, 'count')
        .mockResolvedValue(2136);

      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
      };

      const result = await repository.count(filters);

      expect(result).toBe(2136);
      expect(countSpy).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search kanjis by term', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue([mockKanjiBase]);

      const result = await repository.search('日');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for empty search', async () => {
      const result = await repository.search('');

      expect(result).toEqual([]);
    });
  });
});
