import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  UpdateVocabularyProgressDto,
  VocabularyDetailResponseDto,
  PaginatedVocabularyResponseDto,
  VocabularyFiltersDto,
  VocabularyListResponseDto,
  VocabularyProgressResponseDto,
} from './dto';
import {
  UserVocabularyProgressRepository,
  VocabularyRepository,
} from './repositories';
import {
  UserVocabularyProgressEntity,
  VocabularyDetailEntity,
  VocabularyListInput,
} from './types/vocabulary.types';

@Injectable()
export class VocabularyService {
  constructor(
    private readonly vocabularyRepository: VocabularyRepository,
    private readonly userVocabularyProgressRepository: UserVocabularyProgressRepository,
  ) {}

  async findAll(
    filters: VocabularyFiltersDto,
    userId?: string,
  ): Promise<PaginatedVocabularyResponseDto> {
    const [items, total] = await Promise.all([
      this.vocabularyRepository.findAll(filters),
      this.vocabularyRepository.count(filters),
    ]);

    let progressMap = new Map<string, UserVocabularyProgressEntity>();
    if (userId) {
      progressMap =
        await this.userVocabularyProgressRepository.findByUserAndVocabularies(
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
  ): Promise<VocabularyDetailResponseDto> {
    const vocabulary = await this.vocabularyRepository.findByIdFull(id);

    if (!vocabulary) {
      throw new NotFoundException(`Vocabulary with id ${id} not found`);
    }

    const progress = userId
      ? await this.userVocabularyProgressRepository.findByUserAndVocabulary(
          userId,
          id,
        )
      : null;

    return this.toDetailDto(vocabulary, progress);
  }

  async updateProgress(
    userId: string,
    vocabularyId: string,
    dto: UpdateVocabularyProgressDto,
  ): Promise<VocabularyProgressResponseDto> {
    const vocabulary =
      await this.vocabularyRepository.findByIdFull(vocabularyId);

    if (!vocabulary) {
      throw new NotFoundException(
        `Vocabulary with id ${vocabularyId} not found`,
      );
    }

    let progress =
      await this.userVocabularyProgressRepository.findByUserAndVocabulary(
        userId,
        vocabularyId,
      );

    if (dto.action === 'study') {
      if (!progress) {
        progress = await this.userVocabularyProgressRepository.create(
          userId,
          vocabularyId,
        );
      }

      return this.toProgressDto(vocabularyId, progress);
    }

    if (!progress) {
      progress = await this.userVocabularyProgressRepository.create(
        userId,
        vocabularyId,
      );
    }

    const updateData = this.buildReviewUpdate(progress, dto.correct === true);
    const updated = await this.userVocabularyProgressRepository.update(
      userId,
      vocabularyId,
      updateData,
    );

    return this.toProgressDto(vocabularyId, updated);
  }

  private toListDto(
    item: VocabularyListInput,
    progressMap: Map<string, UserVocabularyProgressEntity>,
  ): VocabularyListResponseDto {
    const progress = progressMap.get(item.id);

    return {
      id: item.id,
      word: item.word,
      reading: item.reading,
      jlpt: item.jlptLevel,
      frequency: item.frequency,
      partOfSpeech: item.partOfSpeech,
      tags: item.tags,
      primaryMeaning:
        'meanings' in item
          ? item.meanings.find((meaning) => meaning.isPrimary)?.meaning ||
            item.meanings[0]?.meaning ||
            ''
          : '',
      userProgress: progress
        ? {
            srsLevel: progress.srsLevel,
            isMastered: progress.isMastered,
            isFavorited: progress.isFavorite,
            isSuspended: progress.isSuspended,
          }
        : undefined,
    };
  }

  private toDetailDto(
    vocabulary: VocabularyDetailEntity,
    progress?: UserVocabularyProgressEntity | null,
  ): VocabularyDetailResponseDto {
    return {
      id: vocabulary.id,
      word: vocabulary.word,
      reading: vocabulary.reading,
      jlpt: vocabulary.jlptLevel,
      frequency: vocabulary.frequency,
      partOfSpeech: vocabulary.partOfSpeech,
      tags: vocabulary.tags,
      notes: vocabulary.notes,
      audioUrl: vocabulary.audioUrl,
      meanings: vocabulary.meanings.map((meaning) => ({
        meaning: meaning.meaning,
        context: meaning.context,
        isPrimary: meaning.isPrimary,
      })),
      examples: vocabulary.examples.map((example) => ({
        japanese: example.japanese,
        reading: example.reading,
        translation: example.translation,
        source: example.source,
      })),
      userProgress: progress
        ? {
            srsLevel: progress.srsLevel,
            isMastered: progress.isMastered,
            isFavorited: progress.isFavorite,
            isSuspended: progress.isSuspended,
            easeFactor: progress.easeFactor,
            intervalDays: progress.intervalDays,
            nextReviewAt: progress.nextReviewAt,
            lastReviewedAt: progress.lastReviewAt ?? undefined,
            totalReviews: progress.totalReviews,
            correctReviews: progress.correctReviews,
          }
        : undefined,
    };
  }

  private toProgressDto(
    vocabularyId: string,
    progress: UserVocabularyProgressEntity,
  ): VocabularyProgressResponseDto {
    return {
      vocabularyId,
      srsLevel: progress.srsLevel,
      isMastered: progress.isMastered,
      isFavorited: progress.isFavorite,
      isSuspended: progress.isSuspended,
      easeFactor: progress.easeFactor,
      intervalDays: progress.intervalDays,
      nextReviewAt: progress.nextReviewAt,
      lastReviewedAt: progress.lastReviewAt ?? undefined,
      totalReviews: progress.totalReviews,
      correctReviews: progress.correctReviews,
      addedAt: progress.addedAt,
      masteredAt: progress.masteredAt ?? undefined,
    };
  }

  private buildReviewUpdate(
    progress: UserVocabularyProgressEntity,
    correct: boolean,
  ): Prisma.UserVocabularyProgressUpdateInput {
    const now = new Date();
    const nextSrsLevel = correct
      ? Math.min(progress.srsLevel + 1, 10)
      : Math.max(progress.srsLevel - 1, 1);
    const nextIntervalDays = correct
      ? Math.min(Math.max(progress.intervalDays * 2, 1), 365)
      : 1;
    const nextReviewAt = new Date(now);
    nextReviewAt.setDate(nextReviewAt.getDate() + nextIntervalDays);
    const isMastered = nextSrsLevel >= 5;

    return {
      srsLevel: nextSrsLevel,
      intervalDays: nextIntervalDays,
      nextReviewAt,
      lastReviewAt: now,
      totalReviews: progress.totalReviews + 1,
      correctReviews: progress.correctReviews + (correct ? 1 : 0),
      isMastered,
      masteredAt: isMastered ? (progress.masteredAt ?? now) : null,
    };
  }
}
