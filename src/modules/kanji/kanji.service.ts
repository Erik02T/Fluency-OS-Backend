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
} from './dto';
import {
  KanjiDetailEntity,
  KanjiListInput,
  UserKanjiProgressEntity,
} from './types/kanji.types';

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
    const existingKanji = await this.kanjiRepository.findByCharacter(
      dto.character,
    );

    if (existingKanji) {
      throw new ConflictException(`Kanji '${dto.character}' already exists`);
    }

    const kanji = await this.kanjiRepository.createAdminKanji(dto);

    return this.toDetailDto(kanji);
  }

  async updateAdminKanji(
    id: string,
    dto: UpdateKanjiDto,
  ): Promise<KanjiDetailResponseDto> {
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

    return this.toDetailDto(kanji);
  }

  async deleteAdminKanji(id: string): Promise<void> {
    const deleted = await this.kanjiRepository.deleteAdminKanji(id);

    if (!deleted) {
      throw new NotFoundException(`Kanji with id ${id} not found`);
    }
  }

  /**
   * Contar kanjis por nível JLPT
   * @returns Object com contagem por nível
   */
  countByJlpt(): Promise<Record<string, number>> {
    // TODO: Implementar quando necessário
    return Promise.resolve({});
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
