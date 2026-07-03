import { Test, TestingModule } from '@nestjs/testing';
import { KanjiRepository } from './kanji.repository';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { KanjiFiltersDto } from '../dto';

describe('KanjiRepository', () => {
  let repository: KanjiRepository;
  let prismaService: PrismaService;

  const mockKanji = {
    id: 'kanji-123',
    character: '日',
    unicodeCodepoint: 'U+65E5',
    jlptLevel: 'N5',
    grade: 1,
    strokeCount: 4,
    frequencyRank: 1,
    meanings: [
      { meaning: 'sol', language: 'pt-BR', isPrimary: true, position: 0 },
    ],
    readings: [
      {
        reading: 'ニチ',
        readingType: 'onyomi',
        romanization: 'nichi',
        isCommon: true,
      },
      {
        reading: 'ひ',
        readingType: 'kunyomi',
        romanization: 'hi',
        isCommon: true,
      },
    ],
    examples: [],
    radicals: [],
    createdAt: new Date(),
    updatedAt: new Date(),
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

      jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanji]);

      const result = await repository.findAll(filters);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].character).toBe('日');
      expect(prismaService.kanji.findMany).toHaveBeenCalled();
    });

    it('should filter by JLPT level', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        jlpt: 'N5',
      };

      jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanji]);

      await repository.findAll(filters);

      expect(prismaService.kanji.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                jlptLevel: 'N5',
              }),
            ]),
          }),
        }),
      );
    });

    it('should filter by grade', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        grade: 1,
      };

      jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanji]);

      await repository.findAll(filters);

      expect(prismaService.kanji.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                grade: 1,
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findByIdFull', () => {
    it('should return full kanji details', async () => {
      jest
        .spyOn(prismaService.kanji, 'findUnique')
        .mockResolvedValue(mockKanji);

      const result = await repository.findByIdFull('kanji-123');

      expect(result).toBeDefined();
      expect(result.character).toBe('日');
      expect(result.meanings).toBeDefined();
      expect(result.readings).toBeDefined();
    });

    it('should return null if kanji not found', async () => {
      jest.spyOn(prismaService.kanji, 'findUnique').mockResolvedValue(null);

      const result = await repository.findByIdFull('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByCharacter', () => {
    it('should find kanji by character', async () => {
      jest
        .spyOn(prismaService.kanji, 'findUnique')
        .mockResolvedValue(mockKanji);

      const result = await repository.findByCharacter('日');

      expect(result).toBeDefined();
      expect(result.character).toBe('日');
      expect(prismaService.kanji.findUnique).toHaveBeenCalledWith({
        where: { character: '日' },
        include: expect.anything(),
      });
    });
  });

  describe('count', () => {
    it('should return total count of kanjis', async () => {
      jest.spyOn(prismaService.kanji, 'count').mockResolvedValue(2136);

      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
      };

      const result = await repository.count(filters);

      expect(result).toBe(2136);
      expect(prismaService.kanji.count).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search kanjis by term', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockResolvedValue([mockKanji]);

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
