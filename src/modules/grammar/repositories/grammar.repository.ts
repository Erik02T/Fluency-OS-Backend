import { Injectable } from '@nestjs/common';
import { Prisma, JLPTLevel } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import {
  GrammarFiltersDto,
  CreateGrammarPointDto,
  UpdateGrammarPointDto,
} from '../dto';
import {
  grammarDetailInclude,
  grammarListInclude,
  GrammarDetailEntity,
  GrammarListEntity,
} from '../types/grammar.types';

type GrammarSortField =
  | 'difficulty'
  | 'jlpt'
  | 'pattern'
  | 'createdAt'
  | 'position';
type SortOrder = 'asc' | 'desc';

@Injectable()
export class GrammarRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: GrammarFiltersDto): Promise<GrammarListEntity[]> {
    const skip = (filters.page - 1) * filters.perPage;

    return this.prisma.grammarPoint.findMany({
      where: this.buildWhere(filters),
      orderBy: this.buildOrderBy(filters.sort, filters.order),
      skip,
      take: filters.perPage,
      include: grammarListInclude,
    });
  }

  count(filters: GrammarFiltersDto): Promise<number> {
    return this.prisma.grammarPoint.count({ where: this.buildWhere(filters) });
  }

  findByIdFull(id: string): Promise<GrammarDetailEntity | null> {
    return this.prisma.grammarPoint.findUnique({
      where: { id },
      include: grammarDetailInclude,
    });
  }

  findByPatternAndJlpt(
    pattern: string,
    jlptLevel: JLPTLevel,
  ): Promise<GrammarDetailEntity | null> {
    return this.prisma.grammarPoint.findFirst({
      where: { pattern, jlptLevel },
      include: grammarDetailInclude,
    });
  }

  async createAdminGrammarPoint(
    dto: CreateGrammarPointDto,
  ): Promise<GrammarDetailEntity> {
    return this.prisma.$transaction(async (tx) => {
      const grammarPoint = await tx.grammarPoint.create({
        data: {
          pattern: dto.pattern,
          jlptLevel: dto.jlptLevel,
          title: dto.title,
          shortExplanation: dto.shortExplanation,
          detailedExplanation: dto.detailedExplanation,
          formalityLevel: dto.formalityLevel,
          difficulty: dto.difficulty,
          position: dto.position,
          tags: dto.tags ?? [],
        },
      });

      await this.syncGrammarExamples(tx, grammarPoint.id, dto);

      const full = await tx.grammarPoint.findUnique({
        where: { id: grammarPoint.id },
        include: grammarDetailInclude,
      });

      if (!full) {
        throw new Error('GrammarPoint not found after create');
      }

      return full;
    });
  }

  async updateAdminGrammarPoint(
    id: string,
    dto: UpdateGrammarPointDto,
  ): Promise<GrammarDetailEntity | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.grammarPoint.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      const data: Prisma.GrammarPointUpdateInput = {};
      if (dto.pattern !== undefined) data.pattern = dto.pattern;
      if (dto.jlptLevel !== undefined) data.jlptLevel = dto.jlptLevel;
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.shortExplanation !== undefined) {
        data.shortExplanation = dto.shortExplanation;
      }
      if (dto.detailedExplanation !== undefined) {
        data.detailedExplanation = dto.detailedExplanation;
      }
      if (dto.formalityLevel !== undefined) {
        data.formalityLevel = dto.formalityLevel;
      }
      if (dto.difficulty !== undefined) data.difficulty = dto.difficulty;
      if (dto.position !== undefined) data.position = dto.position;
      if (dto.tags !== undefined) data.tags = dto.tags;

      await tx.grammarPoint.update({ where: { id }, data });

      await this.syncGrammarExamples(tx, id, dto);

      return tx.grammarPoint.findUnique({
        where: { id },
        include: grammarDetailInclude,
      });
    });
  }

  async deleteAdminGrammarPoint(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.grammarPoint.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      await tx.grammarPoint.delete({ where: { id } });

      return true;
    });
  }

  private async syncGrammarExamples(
    client: Prisma.TransactionClient,
    grammarPointId: string,
    dto: CreateGrammarPointDto | UpdateGrammarPointDto,
  ): Promise<void> {
    if (dto.examples !== undefined) {
      await client.grammarExample.deleteMany({ where: { grammarPointId } });

      if (dto.examples.length > 0) {
        await client.grammarExample.createMany({
          data: dto.examples.map((example, position) => ({
            grammarPointId,
            japanese: example.japanese,
            reading: example.reading ?? null,
            translation: example.translation,
            notes: example.notes ?? null,
            isNatural: example.isNatural ?? true,
            position,
          })),
        });
      }
    }
  }

  private buildWhere(
    filters: GrammarFiltersDto,
  ): Prisma.GrammarPointWhereInput {
    const where: Prisma.GrammarPointWhereInput = {};

    if (filters.jlpt) {
      where.jlptLevel = filters.jlpt;
    }

    if (filters.search) {
      where.OR = [
        { pattern: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { shortExplanation: { contains: filters.search, mode: 'insensitive' } },
        {
          detailedExplanation: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          examples: {
            some: {
              japanese: { contains: filters.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    return where;
  }

  private buildOrderBy(
    sort: GrammarSortField | undefined,
    order: SortOrder | undefined,
  ): Prisma.GrammarPointOrderByWithRelationInput[] {
    const sortField = sort || 'position';
    const sortOrder = order || 'asc';

    if (sortField === 'jlpt') {
      return [
        { jlptLevel: sortOrder },
        { position: 'asc' },
        { difficulty: 'asc' },
      ];
    }

    if (sortField === 'pattern') {
      return [{ pattern: sortOrder }];
    }

    if (sortField === 'createdAt') {
      return [{ createdAt: sortOrder }];
    }

    if (sortField === 'difficulty') {
      return [{ difficulty: sortOrder }, { position: 'asc' }];
    }

    return [
      { jlptLevel: 'asc' },
      { position: sortOrder },
      { difficulty: 'asc' },
    ];
  }
}
