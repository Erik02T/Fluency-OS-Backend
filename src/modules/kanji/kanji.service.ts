import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReadingType } from '@prisma/client';
import { KanjiRepository, UserKanjiProgressRepository } from './repositories';
import {
  CreateKanjiDto,
  KanjiFiltersDto,
  KanjiListResponseDto,
  KanjiDetailResponseDto,
  PaginatedKanjiResponseDto,
  UpdateKanjiDto,
  UpdateKanjiProgressDto,
  KanjiProgressResponseDto,
} from './dto';
import {
  KanjiDetailEntity,
  KanjiListInput,
  UserKanjiProgressEntity,
} from './types/kanji.types';
import { logStructured } from '../../common/logging/structured-log';
import { SrsService } from '../review/srs.service';

@Injectable()
export class KanjiService {
  constructor(
    private kanjiRepository: KanjiRepository,
    private userProgressRepository: UserKanjiProgressRepository,
    private readonly srsService: SrsService,
  ) {}

  /**
   * Listar kanjis com filtros, paginação e progresso do usuário
   * @param filters KanjiFiltersDto
   * @param userId ID do usuário logado
   * @returns PaginatedKanjiResponseDto
   */
  async findAll(
    filters: KanjiFiltersDto,
    userId?: string,
  ): Promise<PaginatedKanjiResponseDto> {
    logStructured('info', 'KanjiService', 'kanji.findAll.start', {
      userId,
      filters,
    });

    const kanjis = await this.kanjiRepository.findAll(filters, userId);
    const total = await this.kanjiRepository.count(filters, userId);

    let progressMap = new Map<string, UserKanjiProgressEntity>();
    if (userId) {
      const kanjiIds = kanjis.map((kanji) => kanji.id);
      progressMap = await this.userProgressRepository.findByUserAndKanjis(
        userId,
        kanjiIds,
      );
    }

    const data = kanjis.map((kanji) => this.toListDto(kanji, progressMap));

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

  /**
   * Buscar detalhe de um kanji por ID
   * @param id ID do kanji
   * @param userId ID do usuário (opcional)
   * @returns KanjiDetailResponseDto
   */
  async findById(id: string, userId?: string): Promise<KanjiDetailResponseDto> {
    logStructured('info', 'KanjiService', 'kanji.findById.start', {
      kanjiId: id,
      userId,
    });

    const kanji = await this.kanjiRepository.findByIdFull(id);

    if (!kanji) {
      throw new NotFoundException(`Kanji with id ${id} not found`);
    }

    let progress: UserKanjiProgressEntity | null = null;
    if (userId) {
      progress = await this.userProgressRepository.findByUserAndKanji(
        userId,
        id,
      );
    }

    return this.toDetailDto(kanji, progress);
  }

  /**
   * Buscar detalhe de um kanji por character
   * @param character Caractere do kanji (ex: "日")
   * @param userId ID do usuário (opcional)
   * @returns KanjiDetailResponseDto
   */
  async findByCharacter(
    character: string,
    userId?: string,
  ): Promise<KanjiDetailResponseDto> {
    const kanji = await this.kanjiRepository.findByCharacter(character);

    if (!kanji) {
      throw new NotFoundException(`Kanji '${character}' not found`);
    }

    let progress: UserKanjiProgressEntity | null = null;
    if (userId) {
      progress = await this.userProgressRepository.findByUserAndKanji(
        userId,
        kanji.id,
      );
    }

    return this.toDetailDto(kanji, progress);
  }

  /**
   * Buscar kanjis por termo (character, meaning, reading)
   * @param query Termo de busca
   * @param userId ID do usuário (opcional)
   * @returns Array de KanjiListResponseDto
   */
  async search(
    query: string,
    userId?: string,
    limit?: number,
  ): Promise<KanjiListResponseDto[]> {
    logStructured('info', 'KanjiService', 'kanji.search.start', {
      query,
      userId,
      limit,
    });

    const kanjis = await this.kanjiRepository.search(query, limit);

    let progressMap = new Map<string, UserKanjiProgressEntity>();
    if (userId) {
      const kanjiIds = kanjis.map((kanji) => kanji.id);
      progressMap = await this.userProgressRepository.findByUserAndKanjis(
        userId,
        kanjiIds,
      );
    }

    return kanjis.map((kanji) => this.toListDto(kanji, progressMap));
  }

  async createAdminKanji(dto: CreateKanjiDto): Promise<KanjiDetailResponseDto> {
    logStructured('info', 'KanjiService', 'kanji.admin.create.start', {
      character: dto.character,
      jlptLevel: dto.jlptLevel,
    });

    const existingKanji = await this.kanjiRepository.findByCharacter(
      dto.character,
    );

    if (existingKanji) {
      throw new ConflictException(`Kanji '${dto.character}' already exists`);
    }

    const kanji = await this.kanjiRepository.createAdminKanji(dto);

    logStructured('info', 'KanjiService', 'kanji.admin.create.success', {
      kanjiId: kanji.id,
      character: kanji.character,
    });

    return this.toDetailDto(kanji);
  }

  async updateAdminKanji(
    id: string,
    dto: UpdateKanjiDto,
  ): Promise<KanjiDetailResponseDto> {
    logStructured('info', 'KanjiService', 'kanji.admin.update.start', {
      kanjiId: id,
      payloadKeys: Object.keys(dto),
    });

    if (dto.character) {
      const existingKanji = await this.kanjiRepository.findByCharacter(
        dto.character,
      );

      if (existingKanji && existingKanji.id !== id) {
        throw new ConflictException(`Kanji '${dto.character}' already exists`);
      }
    }

    const kanji = await this.kanjiRepository.updateAdminKanji(id, dto);

    if (!kanji) {
      throw new NotFoundException(`Kanji with id ${id} not found`);
    }

    logStructured('info', 'KanjiService', 'kanji.admin.update.success', {
      kanjiId: id,
      character: kanji.character,
    });

    return this.toDetailDto(kanji);
  }

  async deleteAdminKanji(id: string): Promise<void> {
    logStructured('info', 'KanjiService', 'kanji.admin.delete.start', {
      kanjiId: id,
    });

    const deleted = await this.kanjiRepository.deleteAdminKanji(id);

    if (!deleted) {
      throw new NotFoundException(`Kanji with id ${id} not found`);
    }

    logStructured('info', 'KanjiService', 'kanji.admin.delete.success', {
      kanjiId: id,
    });
  }

  /**
   * Contar kanjis por nível JLPT
   * @returns Object com contagem por nível
   */
  countByJlpt(): Promise<Record<string, number>> {
    // TODO: Implementar quando necessário
    return Promise.resolve({});
  }

  async updateProgress(
    userId: string,
    kanjiId: string,
    dto: UpdateKanjiProgressDto,
  ): Promise<KanjiProgressResponseDto> {
    const kanji = await this.kanjiRepository.findByIdFull(kanjiId);

    if (!kanji) {
      throw new NotFoundException(`Kanji with id ${kanjiId} not found`);
    }

    let progress = await this.userProgressRepository.findByUserAndKanji(
      userId,
      kanjiId,
    );

    if (dto.action === 'study') {
      if (!progress) {
        progress = await this.userProgressRepository.create(userId, kanjiId);
      }

      return this.toProgressDto(kanjiId, progress);
    }

    if (!progress) {
      progress = await this.userProgressRepository.create(userId, kanjiId);
    }

    const updateData = this.buildReviewUpdate(progress, dto.correct === true);
    const updated = await this.userProgressRepository.update(
      userId,
      kanjiId,
      updateData,
    );

    return this.toProgressDto(kanjiId, updated);
  }

  /**
   * Regra de revisao do progresso - SM-2 adaptado (fonte autoritativa:
   * docs/architecture.md + fluency-os-backend-spec.md RN-SRS001..008),
   * delegada ao SrsService para garantir UMA unica implementacao do
   * algoritmo em todo o backend (review sessions e progress endpoints).
   *
   * Mapeamento do contrato booleano legado para as qualidades SM-2:
   *   correct: true  -> quality 2 (acertou com dificuldade)
   *   correct: false -> quality 0 (falhou / reset do ciclo)
   */
  private buildReviewUpdate(
    progress: UserKanjiProgressEntity,
    correct: boolean,
  ): Prisma.UserKanjiProgressUpdateInput {
    const now = new Date();
    const srs = this.srsService.calculateNextReview(
      progress,
      correct ? 2 : 0,
      now,
    );

    return {
      srsLevel: srs.newSrsLevel,
      easeFactor: srs.newEaseFactor,
      intervalDays: srs.newIntervalDays,
      nextReviewAt: srs.nextReviewAt,
      lastReviewAt: now,
      totalReviews: progress.totalReviews + 1,
      correctReviews: progress.correctReviews + (correct ? 1 : 0),
      isMastered: srs.isMastered,
      masteredAt: srs.isMastered ? (progress.masteredAt ?? now) : null,
    };
  }

  private toProgressDto(
    kanjiId: string,
    progress: UserKanjiProgressEntity,
  ): KanjiProgressResponseDto {
    return {
      kanjiId,
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

  private toListDto(
    kanji: KanjiListInput,
    progressMap: Map<string, UserKanjiProgressEntity>,
  ): KanjiListResponseDto {
    const progress = progressMap.get(kanji.id);
    const readings = 'readings' in kanji ? kanji.readings : [];
    const meanings = 'meanings' in kanji ? kanji.meanings : [];

    const onyomi = readings
      .filter((reading) => reading.type === ReadingType.ONYOMI)
      .map((reading) => reading.reading);

    const kunyomi = readings
      .filter((reading) => reading.type === ReadingType.KUNYOMI)
      .map((reading) => reading.reading);

    return {
      id: kanji.id,
      character: kanji.character,
      meanings: meanings.map((meaning) => meaning.meaning),
      onyomi,
      kunyomi,
      jlpt: kanji.jlptLevel,
      strokes: kanji.strokeCount ?? 0,
      frequency: kanji.frequency ?? 0,
      grade: kanji.grade ?? 0,
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
    kanji: KanjiDetailEntity,
    progress?: UserKanjiProgressEntity | null,
  ): KanjiDetailResponseDto {
    const onyomi = kanji.readings
      .filter((reading) => reading.type === ReadingType.ONYOMI)
      .map((reading) => ({
        reading: reading.reading,
        romanization: reading.romanji ?? '',
        isCommon: reading.isPrimary,
      }));

    const kunyomi = kanji.readings
      .filter((reading) => reading.type === ReadingType.KUNYOMI)
      .map((reading) => ({
        reading: reading.reading,
        romanization: reading.romanji ?? '',
        isCommon: reading.isPrimary,
      }));

    const nanori = kanji.readings
      .filter((reading) => reading.type === ReadingType.NANORI)
      .map((reading) => ({
        reading: reading.reading,
        romanization: reading.romanji ?? '',
      }));

    return {
      id: kanji.id,
      character: kanji.character,
      unicodeCodepoint: kanji.unicodeCodepoint ?? '',
      jlpt: kanji.jlptLevel,
      strokes: kanji.strokeCount ?? 0,
      frequency: kanji.frequency ?? 0,
      grade: kanji.grade ?? 0,
      meanings: kanji.meanings.map((meaning) => ({
        meaning: meaning.meaning,
        language: meaning.language,
        isPrimary: meaning.isPrimary,
      })),
      readings: {
        onyomi,
        kunyomi,
        nanori: nanori.length > 0 ? nanori : undefined,
      },
      examples: kanji.examples.map((example) => ({
        word: example.word,
        reading: example.reading,
        meaning: example.meaning,
        jlpt: example.jlptLevel ?? kanji.jlptLevel,
      })),
      radicals: kanji.radicals.map((kanjiRadical) => ({
        character: kanjiRadical.radical.character,
        name: kanjiRadical.radical.name,
        meaning: kanjiRadical.radical.meaning,
        isPrimary: kanjiRadical.isPrimary,
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
            streak: 0,
          }
        : undefined,
    };
  }
}
