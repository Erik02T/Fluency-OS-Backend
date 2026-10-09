import { Test, TestingModule } from '@nestjs/testing';
import type { Kanji, KanjiMeaning, KanjiReading } from '@prisma/client';
import { JLPTLevel, ReadingType } from '@prisma/client';
import { KanjiRepository } from './kanji.repository';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { KanjiFiltersDto, CreateKanjiDto, UpdateKanjiDto } from '../dto';
import type { KanjiListEntity } from '../types/kanji.types';

describe('KanjiRepository', () => {
  let repository: KanjiRepository;
  let prismaService: PrismaService;
  let transactionClient: {
    kanji: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
    };
    kanjiMeaning: { deleteMany: jest.Mock; createMany: jest.Mock };
    kanjiReading: { deleteMany: jest.Mock; createMany: jest.Mock };
    kanjiExample: { deleteMany: jest.Mock; createMany: jest.Mock };
    radical: { upsert: jest.Mock };
    kanjiRadical: { deleteMany: jest.Mock; create: jest.Mock };
  };

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
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            kanjiMeaning: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            kanjiReading: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            kanjiExample: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            radical: {
              upsert: jest.fn(),
            },
            kanjiRadical: {
              deleteMany: jest.fn(),
              create: jest.fn(),
            },
            $transaction: jest.fn(),
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<KanjiRepository>(KanjiRepository);
    prismaService = module.get<PrismaService>(PrismaService);

    transactionClient = {
      kanji: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
      kanjiMeaning: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      kanjiReading: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      kanjiExample: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      radical: {
        upsert: jest.fn(),
      },
      kanjiRadical: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };
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
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should calculate pagination offset', async () => {
      const filters: KanjiFiltersDto = {
        page: 3,
        perPage: 10,
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
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

    it('should search across character, meanings and readings in a single OR', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        search: 'sol',
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters);

      const callArgs = findManySpy.mock.calls[0]?.[0] as {
        where: {
          AND: Array<{
            character?: unknown;
            OR?: Array<Record<string, unknown>>;
          }>;
        };
      };
      const searchCondition = callArgs.where.AND.find((condition) =>
        Array.isArray(condition.OR),
      );
      const searchFields = searchCondition?.OR?.map((condition) =>
        Object.keys(condition),
      );

      expect(searchCondition?.character).toBeUndefined();
      expect(searchFields).toContainEqual(['character']);
      expect(searchFields).toContainEqual(['meanings']);
      expect(searchFields).toContainEqual(['readings']);
    });

    it('should filter favorites for an authenticated user', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        favorites: true,
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters, 'user-123');

      const callArgs = findManySpy.mock.calls[0]?.[0] as {
        where: { AND: unknown[] };
      };

      expect(callArgs.where.AND).toEqual(
        expect.arrayContaining([
          {
            userProgress: {
              some: {
                userId: 'user-123',
                isFavorite: true,
              },
            },
          },
        ]),
      );
    });

    it('should filter mastered false including missing progress for an authenticated user', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        mastered: false,
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters, 'user-123');

      const callArgs = findManySpy.mock.calls[0]?.[0] as {
        where: { AND: unknown[] };
      };

      expect(callArgs.where.AND).toEqual(
        expect.arrayContaining([
          {
            OR: [
              {
                userProgress: {
                  none: { userId: 'user-123' },
                },
              },
              {
                userProgress: {
                  some: {
                    userId: 'user-123',
                    isMastered: false,
                  },
                },
              },
            ],
          },
        ]),
      );
    });

    it('should return no records when true progress filters are used without a user', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        suspended: true,
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([]);

      await repository.findAll(filters);

      const callArgs = findManySpy.mock.calls[0]?.[0] as {
        where: { AND: unknown[] };
      };

      expect(callArgs.where.AND).toEqual(
        expect.arrayContaining([{ id: { in: [] } }]),
      );
    });

    it('should sort by a global field and order', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        sort: 'strokes',
        order: 'desc',
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ strokeCount: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('should sort by srsLevel for an authenticated user before slicing', async () => {
      const lowerSrsKanji = {
        ...mockKanjiListEntity,
        id: 'kanji-low',
        userProgress: [{ srsLevel: 1, isMastered: false }],
      };
      const higherSrsKanji = {
        ...mockKanjiListEntity,
        id: 'kanji-high',
        userProgress: [{ srsLevel: 5, isMastered: true }],
      };
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 1,
        sort: 'srsLevel',
        order: 'desc',
      };

      jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([lowerSrsKanji, higherSrsKanji]);

      const result = await repository.findAll(filters, 'user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('kanji-high');
    });

    it('should sort by frequency when progress sort is requested without a user', async () => {
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        sort: 'mastered',
        order: 'desc',
      };

      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      await repository.findAll(filters);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ frequency: 'desc' }, { id: 'asc' }],
        }),
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

  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
  describe('admin CRUD', () => {
    const createDto: CreateKanjiDto = {
      character: '火',
      unicodeCodepoint: 'U+706B',
      jlptLevel: JLPTLevel.N5,
      grade: 1,
      strokeCount: 4,
      frequency: 10,
      notes: 'fire',
      romanization: 'ka',
      meanings: [{ meaning: 'fogo', language: 'pt-BR', isPrimary: true }],
      readings: [{ reading: 'カ', type: ReadingType.ONYOMI, romanji: 'ka' }],
      examples: [
        {
          word: '火山',
          reading: 'かざん',
          meaning: 'vulcão',
          jlptLevel: JLPTLevel.N5,
        },
      ],
      radicals: [
        {
          character: '火',
          name: 'hi',
          meaning: 'fogo',
          strokeCount: 4,
          position: 86,
          isPrimary: true,
        },
      ],
    };

    const updateDto: UpdateKanjiDto = {
      grade: 2,
      meanings: [{ meaning: 'chama', language: 'pt-BR', isPrimary: true }],
      readings: [{ reading: 'カ', type: ReadingType.ONYOMI, romanji: 'ka' }],
    };

    const updatedKanji = {
      ...mockKanjiWithRelations,
      id: 'kanji-123',
      character: '火',
    } as KanjiWithRelations;

    beforeEach(() => {
      jest
        .spyOn(prismaService, '$transaction')
        .mockImplementation(
          ((callback: any): Promise<unknown> =>
            Promise.resolve(callback(transactionClient))) as any,
        );
      transactionClient.kanji.findUnique.mockResolvedValue({ id: 'kanji-123' });
      transactionClient.kanji.create.mockResolvedValue({ id: 'kanji-123' });
      transactionClient.kanji.update.mockResolvedValue({ id: 'kanji-123' });
      transactionClient.kanji.delete.mockResolvedValue({ id: 'kanji-123' });
      transactionClient.kanji.findUnique.mockResolvedValue(updatedKanji);
      transactionClient.radical.upsert.mockResolvedValue({ id: 'radical-1' });
    });

    it('should create kanji with relations inside a transaction', async () => {
      transactionClient.kanji.create.mockResolvedValue({ id: 'kanji-123' });
      transactionClient.kanji.findUnique.mockResolvedValue(updatedKanji);

      await expect(repository.createAdminKanji(createDto)).resolves.toEqual(
        expect.objectContaining({ character: '火' }),
      );

      expect(transactionClient.kanjiMeaning.createMany).toHaveBeenCalled();
      expect(transactionClient.kanjiReading.createMany).toHaveBeenCalled();
      expect(transactionClient.kanjiExample.createMany).toHaveBeenCalled();
      expect(transactionClient.kanjiRadical.create).toHaveBeenCalled();
    });

    it('should update kanji and replace provided relations', async () => {
      transactionClient.kanji.update.mockResolvedValue({ id: 'kanji-123' });
      transactionClient.kanji.findUnique.mockResolvedValue(updatedKanji);

      await expect(
        repository.updateAdminKanji('kanji-123', updateDto),
      ).resolves.not.toBeNull();

      expect(transactionClient.kanji.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'kanji-123' },
          data: expect.objectContaining({ grade: 2 }),
        }),
      );
      expect(transactionClient.kanjiMeaning.deleteMany).toHaveBeenCalledWith({
        where: { kanjiId: 'kanji-123' },
      });
      expect(transactionClient.kanjiReading.createMany).toHaveBeenCalled();
    });

    it('should return null when updating missing kanji', async () => {
      transactionClient.kanji.findUnique.mockResolvedValueOnce(null);

      await expect(
        repository.updateAdminKanji('missing-id', { grade: 2 }),
      ).resolves.toBeNull();
    });

    it('should delete kanji inside a transaction', async () => {
      transactionClient.kanji.findUnique.mockResolvedValueOnce({
        id: 'kanji-123',
      });

      await expect(repository.deleteAdminKanji('kanji-123')).resolves.toBe(
        true,
      );

      expect(transactionClient.kanji.delete).toHaveBeenCalledWith({
        where: { id: 'kanji-123' },
      });
    });

    it('should return false when deleting missing kanji', async () => {
      transactionClient.kanji.findUnique.mockResolvedValueOnce(null);

      await expect(repository.deleteAdminKanji('missing-id')).resolves.toBe(
        false,
      );
    });
  });
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

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

    it('should count with the same progress filters as findAll', async () => {
      const countSpy = jest
        .spyOn(prismaService.kanji, 'count')
        .mockResolvedValue(2);
      const filters: KanjiFiltersDto = {
        page: 1,
        perPage: 20,
        favorites: true,
      };

      await repository.count(filters, 'user-123');

      expect(countSpy).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              userProgress: {
                some: {
                  userId: 'user-123',
                  isFavorite: true,
                },
              },
            },
          ],
        },
      });
    });
  });

  describe('search', () => {
    it('should search kanjis by term', async () => {
      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([mockKanjiListEntity]);

      const result = await repository.search('日');

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it('should respect custom limit', async () => {
      const findManySpy = jest
        .spyOn(prismaService.kanji, 'findMany')
        .mockResolvedValue([]);

      await repository.search('日', 10);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should return empty array for empty search', async () => {
      const result = await repository.search('');

      expect(result).toEqual([]);
    });
  });
});
