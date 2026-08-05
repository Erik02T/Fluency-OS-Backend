import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { GrammarFiltersDto } from '../dto';
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
