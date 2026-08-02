import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { CreateKanjiDto, KanjiFiltersDto, UpdateKanjiDto } from '../dto';
import {
  kanjiDetailInclude,
  kanjiListInclude,
  KanjiDetailEntity,
  KanjiListEntity,
} from '../types/kanji.types';

type ProgressSortField = 'srsLevel' | 'mastered';
type SortOrder = 'asc' | 'desc';
type ProgressSortableKanji = KanjiListEntity & {
  userProgress: Array<{
    srsLevel: number;
    isMastered: boolean;
  }>;
};

@Injectable()
export class KanjiRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Busca lista de kanjis com filtros e paginação
   * @param filters KanjiFiltersDto com jlpt, grade, search, etc
   * @returns Array de kanjis com meanings, readings, exemplos
   */
  async findAll(
    filters: KanjiFiltersDto,
    userId?: string,
  ): Promise<KanjiListEntity[]> {
    const skip = (filters.page - 1) * filters.perPage;
    const where = this.buildWhere(filters, userId);

    if (this.isProgressSort(filters.sort) && userId) {
      const kanjis = await this.prisma.kanji.findMany({
        where,
        orderBy: this.buildOrderBy('frequency', 'asc'),
        include: {
          ...kanjiListInclude,
          userProgress: {
            where: { userId },
            select: {
              srsLevel: true,
              isMastered: true,
            },
            take: 1,
          },
        },
      });

      return this.sortByProgress(kanjis, filters.sort, filters.order).slice(
        skip,
        skip + filters.perPage,
      );
    }

    return this.prisma.kanji.findMany({
      where,
      orderBy: this.buildOrderBy(filters.sort, filters.order),
      skip,
      take: filters.perPage,
      include: kanjiListInclude,
    });
  }

  /**
   * Contar total de kanjis com filtros
   * @param filters KanjiFiltersDto
   * @returns Contagem total
   */
  async count(filters: KanjiFiltersDto, userId?: string): Promise<number> {
    return this.prisma.kanji.count({ where: this.buildWhere(filters, userId) });
  }

  /**
   * Buscar kanji por ID com todos os dados
   * @param id ID do kanji
   * @returns Kanji completo com meanings, readings, examples, radicals
   */
  async findByIdFull(id: string): Promise<KanjiDetailEntity | null> {
    return this.prisma.kanji.findUnique({
      where: { id },
      include: kanjiDetailInclude,
    });
  }

  /**
   * Buscar kanji por character
   * @param character Caractere do kanji (ex: "日")
   * @returns Kanji encontrado ou null
   */
  async findByCharacter(character: string): Promise<KanjiDetailEntity | null> {
    return this.prisma.kanji.findUnique({
      where: { character },
      include: kanjiDetailInclude,
    });
  }

  async createAdminKanji(dto: CreateKanjiDto): Promise<KanjiDetailEntity> {
    return this.prisma.$transaction(async (tx) => {
      const kanji = await tx.kanji.create({
        data: this.buildKanjiCreateData(dto),
      });

      await this.syncKanjiRelations(tx, kanji.id, dto);

      return this.findByIdFullWithClient(tx, kanji.id);
    });
  }

  async updateAdminKanji(
    id: string,
    dto: UpdateKanjiDto,
  ): Promise<KanjiDetailEntity | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.kanji.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.kanji.update({
        where: { id },
        data: this.buildKanjiUpdateData(dto),
      });

      await this.syncKanjiRelations(tx, id, dto);

      return this.findByIdFullWithClient(tx, id);
    });
  }

  async deleteAdminKanji(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.kanji.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      await tx.kanji.delete({ where: { id } });

      return true;
    });
  }

  /**
   * Buscar por term (character, meaning, onyomi, kunyomi)
   * Usa ILIKE para case-insensitive partial match
   * @param search Termo de busca
   * @param limit Número máximo de resultados
   * @returns Array de kanjis
   */
  async search(search: string, limit: number = 50): Promise<KanjiListEntity[]> {
    if (!search || search.length < 1) {
      return [];
    }

    return this.prisma.kanji.findMany({
      where: {
        OR: [
          {
            character: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            meanings: {
              some: {
                meaning: { contains: search, mode: 'insensitive' },
                language: 'pt-BR',
              },
            },
          },
          {
            readings: {
              some: {
                OR: [
                  { reading: { contains: search } },
                  {
                    romanji: { contains: search, mode: 'insensitive' },
                  },
                ],
              },
            },
          },
        ],
      },
      orderBy: [{ frequency: 'asc' }, { id: 'asc' }],
      take: limit,
      include: kanjiListInclude,
    });
  }

  private async findByIdFullWithClient(
    client: Prisma.TransactionClient,
    id: string,
  ): Promise<KanjiDetailEntity> {
    const kanji = await client.kanji.findUnique({
      where: { id },
      include: kanjiDetailInclude,
    });

    if (!kanji) {
      throw new Error(`Kanji with id ${id} not found after write operation`);
    }

    return kanji;
  }

  private buildKanjiCreateData(dto: CreateKanjiDto): Prisma.KanjiCreateInput {
    return {
      character: dto.character,
      unicodeCodepoint: dto.unicodeCodepoint,
      jlptLevel: dto.jlptLevel,
      grade: dto.grade,
      strokeCount: dto.strokeCount,
      frequency: dto.frequency,
      notes: dto.notes,
      romanization: dto.romanization,
    };
  }

  private buildKanjiUpdateData(dto: UpdateKanjiDto): Prisma.KanjiUpdateInput {
    const data: Prisma.KanjiUpdateInput = {};

    if (dto.character !== undefined) data.character = dto.character;
    if (dto.unicodeCodepoint !== undefined)
      data.unicodeCodepoint = dto.unicodeCodepoint;
    if (dto.jlptLevel !== undefined) data.jlptLevel = dto.jlptLevel;
    if (dto.grade !== undefined) data.grade = dto.grade;
    if (dto.strokeCount !== undefined) data.strokeCount = dto.strokeCount;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.romanization !== undefined) data.romanization = dto.romanization;

    return data;
  }

  private async syncKanjiRelations(
    client: Prisma.TransactionClient,
    kanjiId: string,
    dto: CreateKanjiDto | UpdateKanjiDto,
  ): Promise<void> {
    if (dto.meanings !== undefined) {
      await client.kanjiMeaning.deleteMany({ where: { kanjiId } });

      if (dto.meanings.length > 0) {
        await client.kanjiMeaning.createMany({
          data: dto.meanings.map((meaning, position) => ({
            kanjiId,
            meaning: meaning.meaning,
            language: meaning.language ?? 'pt-BR',
            isPrimary: meaning.isPrimary ?? position === 0,
            position,
          })),
        });
      }
    }

    if (dto.readings !== undefined) {
      await client.kanjiReading.deleteMany({ where: { kanjiId } });

      if (dto.readings.length > 0) {
        await client.kanjiReading.createMany({
          data: dto.readings.map((reading) => ({
            kanjiId,
            reading: reading.reading,
            type: reading.type,
            romanji: reading.romanji,
            isPrimary: reading.isPrimary ?? false,
          })),
        });
      }
    }

    if (dto.examples !== undefined) {
      await client.kanjiExample.deleteMany({ where: { kanjiId } });

      if (dto.examples.length > 0) {
        await client.kanjiExample.createMany({
          data: dto.examples.map((example, position) => ({
            kanjiId,
            word: example.word,
            reading: example.reading,
            meaning: example.meaning,
            jlptLevel: example.jlptLevel ?? null,
            position,
          })),
        });
      }
    }

    if (dto.radicals !== undefined) {
      await client.kanjiRadical.deleteMany({ where: { kanjiId } });

      for (const radicalData of dto.radicals) {
        const radical = await client.radical.upsert({
          where: { character: radicalData.character },
          update: {
            name: radicalData.name,
            meaning: radicalData.meaning,
            strokeCount: radicalData.strokeCount,
            position: radicalData.position,
          },
          create: {
            character: radicalData.character,
            name: radicalData.name,
            meaning: radicalData.meaning,
            strokeCount: radicalData.strokeCount,
            position: radicalData.position,
          },
        });

        await client.kanjiRadical.create({
          data: {
            kanjiId,
            radicalId: radical.id,
            isPrimary: radicalData.isPrimary ?? false,
          },
        });
      }
    }
  }

  /**
   * Construir WHERE conditions baseado em filtros
   * @param filters KanjiFiltersDto
   * @returns Array de condições para AND
   */
  private buildWhere(
    filters: KanjiFiltersDto,
    userId?: string,
  ): Prisma.KanjiWhereInput {
    return {
      AND: this.buildWhereConditions(filters, userId),
    };
  }

  private buildWhereConditions(
    filters: KanjiFiltersDto,
    userId?: string,
  ): Prisma.KanjiWhereInput[] {
    const conditions: Prisma.KanjiWhereInput[] = [];

    if (filters.jlpt) {
      conditions.push({ jlptLevel: filters.jlpt });
    }

    if (filters.grade) {
      conditions.push({ grade: filters.grade });
    }

    if (filters.search && filters.search.length > 0) {
      conditions.push({
        OR: [
          {
            character: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
          {
            meanings: {
              some: {
                meaning: { contains: filters.search, mode: 'insensitive' },
                language: 'pt-BR',
              },
            },
          },
          {
            readings: {
              some: {
                OR: [
                  { reading: { contains: filters.search } },
                  {
                    romanji: { contains: filters.search, mode: 'insensitive' },
                  },
                ],
              },
            },
          },
        ],
      });
    }

    this.addProgressFilter(conditions, userId, 'isFavorite', filters.favorites);
    this.addProgressFilter(conditions, userId, 'isMastered', filters.mastered);
    this.addProgressFilter(
      conditions,
      userId,
      'isSuspended',
      filters.suspended,
    );

    return conditions;
  }

  private addProgressFilter(
    conditions: Prisma.KanjiWhereInput[],
    userId: string | undefined,
    field: 'isFavorite' | 'isMastered' | 'isSuspended',
    value?: boolean,
  ): void {
    if (value === undefined) {
      return;
    }

    if (!userId) {
      if (value) {
        conditions.push({ id: { in: [] } });
      }
      return;
    }

    if (value) {
      conditions.push({
        userProgress: {
          some: {
            userId,
            [field]: true,
          },
        },
      });
      return;
    }

    conditions.push({
      OR: [
        {
          userProgress: {
            none: { userId },
          },
        },
        {
          userProgress: {
            some: {
              userId,
              [field]: false,
            },
          },
        },
      ],
    });
  }

  /**
   * Construir ORDER BY baseado em sort parameter
   * @param sort Campo para ordenação
   * @returns Ordenação Prisma
   */
  private buildOrderBy(
    sort?: string,
    order: SortOrder = 'asc',
  ): Prisma.KanjiOrderByWithRelationInput[] {
    switch (sort) {
      case 'jlpt':
        return [{ jlptLevel: order }, { id: 'asc' }];
      case 'grade':
        return [{ grade: order }, { id: 'asc' }];
      case 'strokes':
        return [{ strokeCount: order }, { id: 'asc' }];
      case 'frequency':
      case 'srsLevel':
      case 'mastered':
      default:
        return [{ frequency: order }, { id: 'asc' }];
    }
  }

  private isProgressSort(sort?: string): sort is ProgressSortField {
    return sort === 'srsLevel' || sort === 'mastered';
  }

  private sortByProgress(
    kanjis: ProgressSortableKanji[],
    sort: ProgressSortField,
    order: SortOrder = 'asc',
  ): KanjiListEntity[] {
    const direction = order === 'asc' ? 1 : -1;

    return [...kanjis].sort((left, right) => {
      const leftProgress = left.userProgress[0];
      const rightProgress = right.userProgress[0];
      const leftValue =
        sort === 'srsLevel'
          ? (leftProgress?.srsLevel ?? 0)
          : leftProgress?.isMastered
            ? 1
            : 0;
      const rightValue =
        sort === 'srsLevel'
          ? (rightProgress?.srsLevel ?? 0)
          : rightProgress?.isMastered
            ? 1
            : 0;

      if (leftValue !== rightValue) {
        return (leftValue - rightValue) * direction;
      }

      return left.id.localeCompare(right.id);
    });
  }
}
