import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateVocabularyDto,
  UpdateVocabularyProgressDto,
  VocabularyDetailResponseDto,
  PaginatedVocabularyResponseDto,
  VocabularyFiltersDto,
  VocabularyListResponseDto,
  VocabularyProgressResponseDto,
  UpdateVocabularyDto,
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
import { logStructured } from '../../common/logging/structured-log';

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

  async createAdminVocabulary(
    dto: CreateVocabularyDto,
  ): Promise<VocabularyDetailResponseDto> {
    logStructured(
      'info',
      'VocabularyService',
      'vocabulary.admin.create.start',
      {
        word: dto.word,
        reading: dto.reading,
        jlptLevel: dto.jlptLevel,
      },
    );

    const existing = await this.vocabularyRepository.findByWordAndReading(
      dto.word,
      dto.reading,
    );

    if (existing) {
      throw new ConflictException(
        `Vocabulary '${dto.word}' (${dto.reading}) already exists`,
      );
    }

    const vocabulary =
      await this.vocabularyRepository.createAdminVocabulary(dto);

    logStructured(
      'info',
      'VocabularyService',
      'vocabulary.admin.create.success',
      {
        vocabularyId: vocabulary.id,
        word: vocabulary.word,
      },
    );

    return this.toDetailDto(vocabulary);
  }

  async updateAdminVocabulary(
    id: string,
    dto: UpdateVocabularyDto,
  ): Promise<VocabularyDetailResponseDto> {
    logStructured(
      'info',
      'VocabularyService',
      'vocabulary.admin.update.start',
      {
        vocabularyId: id,
        payloadKeys: Object.keys(dto),
      },
    );

    if (dto.word !== undefined && dto.reading !== undefined) {
      const existing = await this.vocabularyRepository.findByWordAndReading(
        dto.word,
        dto.reading,
      );

      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Vocabulary '${dto.word}' (${dto.reading}) already exists`,
        );
      }
    }

    const vocabulary = await this.vocabularyRepository.updateAdminVocabulary(
      id,
      dto,
    );

    if (!vocabulary) {
      throw new NotFoundException(`Vocabulary with id ${id} not found`);
    }

    logStructured(
      'info',
      'VocabularyService',
      'vocabulary.admin.update.success',
      {
        vocabularyId: id,
        word: vocabulary.word,
      },
    );

    return this.toDetailDto(vocabulary);
  }

  async deleteAdminVocabulary(id: string): Promise<void> {
    logStructured(
      'info',
      'VocabularyService',
      'vocabulary.admin.delete.start',
      {
        vocabularyId: id,
      },
    );

    const deleted = await this.vocabularyRepository.deleteAdminVocabulary(id);

    if (!deleted) {
      throw new NotFoundException(`Vocabulary with id ${id} not found`);
    }

    logStructured(
      'info',
      'VocabularyService',
      'vocabulary.admin.delete.success',
      {
        vocabularyId: id,
      },
    );
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

    // action === 'review'
    // O item entra na fila IMEDIATAMENTE (nextReviewAt = now) para que
    // apareça na fila de revisão sem esperar o próximo agendamento.
    if (!progress) {
      progress = await this.userVocabularyProgressRepository.create(
        userId,
        vocabularyId,
      );
    }

    // Força a próxima revisão para agora para que o item apareça na fila.
    progress = await this.userVocabularyProgressRepository.update(
      userId,
      vocabularyId,
      {
        nextReviewAt: new Date(),
      },
    );

    return this.toProgressDto(vocabularyId, progress);
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
}
