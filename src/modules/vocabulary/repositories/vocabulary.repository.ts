import { Injectable } from '@nestjs/common';
import { JLPTLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { VocabularyFiltersDto } from '../dto';
import {
  vocabularyDetailInclude,
  vocabularyListInclude,
  VocabularyDetailEntity,
  VocabularyListEntity,
} from '../types/vocabulary.types';

type VocabularySortField = 'frequency' | 'jlpt' | 'word' | 'createdAt';
type SortOrder = 'asc' | 'desc';

@Injectable()
export class VocabularyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filters: VocabularyFiltersDto): Promise<VocabularyListEntity[]> {
    const skip = (filters.page - 1) * filters.perPage;

    return this.prisma.vocabulary.findMany({
      where: this.buildWhere(filters),
      orderBy: this.buildOrderBy(filters.sort, filters.order),
      skip,
      take: filters.perPage,
      include: vocabularyListInclude,
    });
  }

  count(filters: VocabularyFiltersDto): Promise<number> {
    return this.prisma.vocabulary.count({ where: this.buildWhere(filters) });
  }

  findByIdFull(id: string): Promise<VocabularyDetailEntity | null> {
    return this.prisma.vocabulary.findUnique({
      where: { id },
      include: vocabularyDetailInclude,
    });
  }

  private buildWhere(
    filters: VocabularyFiltersDto,
  ): Prisma.VocabularyWhereInput {
    const where: Prisma.VocabularyWhereInput = {};

    if (filters.jlpt) {
      where.jlptLevel = filters.jlpt as JLPTLevel;
    }

    if (filters.search) {
      where.OR = [
        { word: { contains: filters.search, mode: 'insensitive' } },
        { reading: { contains: filters.search, mode: 'insensitive' } },
        {
          meanings: {
            some: {
              meaning: { contains: filters.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    return where;
  }

  private buildOrderBy(
    sort: VocabularySortField | undefined,
    order: SortOrder | undefined,
  ): Prisma.VocabularyOrderByWithRelationInput[] {
    const sortField = sort || 'frequency';
    const sortOrder = order || 'asc';

    if (sortField === 'jlpt') {
      return [{ jlptLevel: sortOrder }, { frequency: 'asc' }, { word: 'asc' }];
    }

    if (sortField === 'word') {
      return [{ word: sortOrder }];
    }

    if (sortField === 'createdAt') {
      return [{ createdAt: sortOrder }];
    }

    return [{ frequency: sortOrder }, { word: 'asc' }];
  }
}
