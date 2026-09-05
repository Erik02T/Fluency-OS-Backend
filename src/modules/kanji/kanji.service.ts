import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReadingType } from '@prisma/client';
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

@Injectable()
export class KanjiService {
  constructor(
    private kanjiRepository: KanjiRepository,
    private userProgressRepository: UserKanjiProgressRepository,
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

  /**
   * Atualizar progresso de kanji (estudar ou enviar para review)
   * @param userId ID do usuário
   * @param kanjiId ID do kanji
   * @param dto DTO com action
   * @returns KanjiProgressResponseDto
   */
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
      progress = await this.userProgressRepository.upsert(userId, kanjiId);
      return this.toProgressDto(kanjiId, progress);
    }

    // action === 'review'
    // O item entra na fila IMEDIATAMENTE (nextReviewAt = now) para que
    // apareça na fila de revisão sem esperar o próximo agendamento.
    if (!progress) {
      progress = await this.userProgressRepository.upsert(userId, kanjiId);
    }

    // Força a próxima revisão para agora para que o item apareça na fila.
    progress = await this.userProgressRepository.update(userId, kanjiId, {
      nextReviewAt: new Date(),
    });

    return this.toProgressDto(kanjiId, progress);
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
}
