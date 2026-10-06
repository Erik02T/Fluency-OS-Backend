import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  UpdateGrammarProgressDto,
  GrammarDetailResponseDto,
  PaginatedGrammarResponseDto,
  GrammarFiltersDto,
  GrammarListResponseDto,
  GrammarProgressResponseDto,
} from './dto';
import {
  GrammarRepository,
  UserGrammarProgressRepository,
} from './repositories';
import {
  UserGrammarProgressEntity,
  GrammarDetailEntity,
  GrammarListInput,
} from './types/grammar.types';

@Injectable()
export class GrammarService {
  constructor(
    private readonly grammarRepository: GrammarRepository,
    private readonly userGrammarProgressRepository: UserGrammarProgressRepository,
  ) {}

  async findAll(
    filters: GrammarFiltersDto,
    userId?: string,
  ): Promise<PaginatedGrammarResponseDto> {
    const [items, total] = await Promise.all([
      this.grammarRepository.findAll(filters),
      this.grammarRepository.count(filters),
    ]);

    let progressMap = new Map<string, UserGrammarProgressEntity>();
    if (userId) {
      progressMap =
        await this.userGrammarProgressRepository.findByUserAndGrammarPoints(
          userId,
          items.map((item) => item.id),
        );
    }

    const data = items.map((item) => this.toListDto(item, progressMap));

    return {
      data,
      pagination: {
        page: filters.page,
        perPage: filters.perPage,
        total,
        pages: Math.ceil(total / filters.perPage),
      },
    };
  }

  async findById(
    id: string,
    userId?: string,
  ): Promise<GrammarDetailResponseDto> {
    const grammarPoint = await this.grammarRepository.findByIdFull(id);

    if (!grammarPoint) {
      throw new NotFoundException(`Grammar point with id ${id} not found`);
    }

    const progress = userId
      ? await this.userGrammarProgressRepository.findByUserAndGrammarPoint(
          userId,
          id,
        )
      : null;

    return this.toDetailDto(grammarPoint, progress);
  }

  async updateProgress(
    userId: string,
    grammarPointId: string,
    dto: UpdateGrammarProgressDto,
  ): Promise<GrammarProgressResponseDto> {
    const grammarPoint =
      await this.grammarRepository.findByIdFull(grammarPointId);

    if (!grammarPoint) {
      throw new NotFoundException(
        `Grammar point with id ${grammarPointId} not found`,
      );
    }

    let progress =
      await this.userGrammarProgressRepository.findByUserAndGrammarPoint(
        userId,
        grammarPointId,
      );

    if (dto.action === 'study') {
      if (!progress) {
        progress = await this.userGrammarProgressRepository.create(
          userId,
          grammarPointId,
        );
      }

      return this.toProgressDto(grammarPointId, progress);
    }

    if (!progress) {
      progress = await this.userGrammarProgressRepository.create(
        userId,
        grammarPointId,
      );
    }

    const updateData = this.buildReviewUpdate(progress, dto);
    const updated = await this.userGrammarProgressRepository.update(
      userId,
      grammarPointId,
      updateData,
    );

    return this.toProgressDto(grammarPointId, updated);
  }

  private toListDto(
    item: GrammarListInput,
    progressMap: Map<string, UserGrammarProgressEntity>,
  ): GrammarListResponseDto {
    const progress = progressMap.get(item.id);
    const examples = 'examples' in item ? item.examples : [];

    return {
      id: item.id,
      pattern: item.pattern,
      title: item.title,
      jlpt: item.jlptLevel,
      difficulty: item.difficulty,
      position: item.position,
      formalityLevel: item.formalityLevel,
      tags: item.tags,
      shortExplanation: item.shortExplanation,
      examplesPreview: examples.map((example) => ({
        japanese: example.japanese,
        reading: example.reading,
        translation: example.translation,
      })),
      userProgress: progress
        ? {
            isStudied: progress.isStudied,
            isFavorited: progress.isFavorite,
            confidenceLevel: progress.confidenceLevel,
            reviewCount: progress.reviewCount,
          }
        : undefined,
    };
  }

  private toDetailDto(
    grammarPoint: GrammarDetailEntity,
    progress?: UserGrammarProgressEntity | null,
  ): GrammarDetailResponseDto {
    return {
      id: grammarPoint.id,
      pattern: grammarPoint.pattern,
      title: grammarPoint.title,
      jlpt: grammarPoint.jlptLevel,
      difficulty: grammarPoint.difficulty,
      position: grammarPoint.position,
      formalityLevel: grammarPoint.formalityLevel,
      tags: grammarPoint.tags,
      shortExplanation: grammarPoint.shortExplanation,
      detailedExplanation: grammarPoint.detailedExplanation,
      examples: grammarPoint.examples.map((example) => ({
        japanese: example.japanese,
        reading: example.reading,
        translation: example.translation,
        notes: example.notes,
        isNatural: example.isNatural,
      })),
      userProgress: progress
        ? {
            isStudied: progress.isStudied,
            studiedAt: progress.studiedAt ?? undefined,
            isFavorited: progress.isFavorite,
            confidenceLevel: progress.confidenceLevel,
            notes: progress.notes,
            reviewCount: progress.reviewCount,
          }
        : undefined,
    };
  }

  private toProgressDto(
    grammarPointId: string,
    progress: UserGrammarProgressEntity,
  ): GrammarProgressResponseDto {
    return {
      grammarPointId,
      isStudied: progress.isStudied,
      studiedAt: progress.studiedAt ?? undefined,
      isFavorited: progress.isFavorite,
      confidenceLevel: progress.confidenceLevel,
      notes: progress.notes,
      reviewCount: progress.reviewCount,
    };
  }

  private buildReviewUpdate(
    progress: UserGrammarProgressEntity,
    dto: UpdateGrammarProgressDto,
  ): Prisma.UserGrammarProgressUpdateInput {
    const nextConfidence =
      dto.confidenceLevel !== undefined
        ? dto.confidenceLevel
        : dto.understood === true
          ? Math.min(progress.confidenceLevel + 1, 5)
          : Math.max(progress.confidenceLevel - 1, 0);

    return {
      reviewCount: progress.reviewCount + 1,
      confidenceLevel: nextConfidence,
      isStudied: true,
      studiedAt: progress.studiedAt ?? new Date(),
    };
  }
}
