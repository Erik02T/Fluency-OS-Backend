import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import {
  CreateVocabularyDto,
  UpdateVocabularyDto,
  VocabularyFiltersDto,
} from '../dto';
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

  async findByWordAndReading(
    word: string,
    reading: string,
  ): Promise<VocabularyDetailEntity | null> {
    return this.prisma.vocabulary.findUnique({
      where: { word_reading: { word, reading } },
      include: vocabularyDetailInclude,
    });
  }

  async createAdminVocabulary(
    dto: CreateVocabularyDto,
  ): Promise<VocabularyDetailEntity> {
    return this.prisma.$transaction(async (tx) => {
      const vocabulary = await tx.vocabulary.create({
        data: this.buildVocabularyCreateData(dto),
      });

      await this.syncVocabularyRelations(tx, vocabulary.id, dto);

      return this.findByIdFullWithClient(tx, vocabulary.id);
    });
  }

  async updateAdminVocabulary(
    id: string,
    dto: UpdateVocabularyDto,
  ): Promise<VocabularyDetailEntity | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.vocabulary.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        return null;
      }

      await tx.vocabulary.update({
        where: { id },
        data: this.buildVocabularyUpdateData(dto),
      });

      await this.syncVocabularyRelations(tx, id, dto);

      return this.findByIdFullWithClient(tx, id);
    });
  }

  async deleteAdminVocabulary(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.vocabulary.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      await tx.vocabulary.delete({ where: { id } });

      return true;
    });
  }

  private async findByIdFullWithClient(
    client: Prisma.TransactionClient,
    id: string,
  ): Promise<VocabularyDetailEntity> {
    const vocabulary = await client.vocabulary.findUnique({
      where: { id },
      include: vocabularyDetailInclude,
    });

    if (!vocabulary) {
      throw new Error(
        `Vocabulary with id ${id} not found after write operation`,
      );
    }

    return vocabulary;
  }

  private buildVocabularyCreateData(
    dto: CreateVocabularyDto,
  ): Prisma.VocabularyCreateInput {
    return {
      word: dto.word,
      reading: dto.reading,
      jlptLevel: dto.jlptLevel,
      frequency: dto.frequency ?? null,
      partOfSpeech: dto.partOfSpeech ?? null,
      tags: dto.tags ?? [],
      notes: dto.notes ?? null,
      audioUrl: dto.audioUrl ?? null,
    };
  }

  private buildVocabularyUpdateData(
    dto: UpdateVocabularyDto,
  ): Prisma.VocabularyUpdateInput {
    const data: Prisma.VocabularyUpdateInput = {};

    if (dto.word !== undefined) data.word = dto.word;
    if (dto.reading !== undefined) data.reading = dto.reading;
    if (dto.jlptLevel !== undefined) data.jlptLevel = dto.jlptLevel;
    if (dto.frequency !== undefined) {
      data.frequency = dto.frequency === null ? null : dto.frequency;
    }
    if (dto.partOfSpeech !== undefined) {
      data.partOfSpeech = dto.partOfSpeech === null ? null : dto.partOfSpeech;
    }
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.notes !== undefined) {
      data.notes = dto.notes === null ? null : dto.notes;
    }
    if (dto.audioUrl !== undefined) {
      data.audioUrl = dto.audioUrl === null ? null : dto.audioUrl;
    }

    return data;
  }

  private async syncVocabularyRelations(
    client: Prisma.TransactionClient,
    vocabularyId: string,
    dto: CreateVocabularyDto | UpdateVocabularyDto,
  ): Promise<void> {
    if (dto.meanings !== undefined) {
      await client.vocabularyMeaning.deleteMany({ where: { vocabularyId } });

      if (dto.meanings.length > 0) {
        await client.vocabularyMeaning.createMany({
          data: dto.meanings.map((meaning, position) => ({
            vocabularyId,
            meaning: meaning.meaning,
            context: meaning.context ?? null,
            isPrimary: meaning.isPrimary ?? position === 0,
            position,
          })),
        });
      }
    }

    if (dto.examples !== undefined) {
      await client.vocabularyExample.deleteMany({ where: { vocabularyId } });

      if (dto.examples.length > 0) {
        await client.vocabularyExample.createMany({
          data: dto.examples.map((example) => ({
            vocabularyId,
            japanese: example.japanese,
            reading: example.reading ?? null,
            translation: example.translation,
            source: example.source ?? null,
          })),
        });
      }
    }
  }

  private buildWhere(
    filters: VocabularyFiltersDto,
  ): Prisma.VocabularyWhereInput {
    const where: Prisma.VocabularyWhereInput = {};

    if (filters.jlpt) {
      where.jlptLevel = filters.jlpt;
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
