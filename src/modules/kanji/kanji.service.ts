import { Injectable, NotFoundException } from '@nestjs/common';
import { KanjiRepository, UserKanjiProgressRepository } from './repositories';
import { KanjiFiltersDto, KanjiListResponseDto, KanjiDetailResponseDto, PaginatedKanjiResponseDto } from './dto';

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
    // Buscar kanjis
    const kanjis = await this.kanjiRepository.findAll(filters);
    const total = await this.kanjiRepository.count(filters);

    // Se usuário está logado, injetar progresso
    let progressMap: Map<string, any> = new Map();
    if (userId) {
      const kanjiIds = kanjis.map(k => k.id);
      progressMap = await this.userProgressRepository.findByUserAndKanjis(userId, kanjiIds);
    }

    // Transformar em DTOs
    const data = kanjis.map(kanji => this.toListDto(kanji, progressMap));

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

    // Buscar progresso do usuário
    let progress = null;
    if (userId) {
      progress = await this.userProgressRepository.findByUserAndKanji(userId, id);
    }

    return this.toDetailDto(kanji, progress);
  }

  /**
   * Buscar detalhe de um kanji por character
   * @param character Caractere do kanji (ex: "日")
   * @param userId ID do usuário (opcional)
   * @returns KanjiDetailResponseDto
   */
  async findByCharacter(character: string, userId?: string): Promise<KanjiDetailResponseDto> {
    const kanji = await this.kanjiRepository.findByCharacter(character);

    if (!kanji) {
      throw new NotFoundException(`Kanji '${character}' not found`);
    }

    let progress = null;
    if (userId) {
      progress = await this.userProgressRepository.findByUserAndKanji(userId, kanji.id);
    }

    return this.toDetailDto(kanji, progress);
  }

  /**
   * Buscar kanjis por termo (character, meaning, reading)
   * @param query Termo de busca
   * @param userId ID do usuário (opcional)
   * @returns Array de KanjiListResponseDto
   */
  async search(query: string, userId?: string): Promise<KanjiListResponseDto[]> {
    const kanjis = await this.kanjiRepository.search(query);

    let progressMap: Map<string, any> = new Map();
    if (userId) {
      const kanjiIds = kanjis.map(k => k.id);
      progressMap = await this.userProgressRepository.findByUserAndKanjis(userId, kanjiIds);
    }

    return kanjis.map(kanji => this.toListDto(kanji, progressMap));
  }

  /**
   * Contar kanjis por nível JLPT
   * @returns Object com contagem por nível
   */
  async countByJlpt(): Promise<any> {
    // TODO: Implementar quando necessário
    return {};
  }

  /**
   * Transformar Kanji em KanjiListResponseDto
   * @param kanji Kanji com relations
   * @param progressMap Map de progresso (userId_kanjiId -> progress)
   * @returns KanjiListResponseDto
   */
  private toListDto(kanji: any, progressMap: Map<string, any>): KanjiListResponseDto {
    const progress = progressMap.get(kanji.id);

    // Extrair leituras por tipo
    const onyomi = kanji.readings
      .filter(r => r.readingType === 'onyomi')
      .map(r => r.reading);

    const kunyomi = kanji.readings
      .filter(r => r.readingType === 'kunyomi')
      .map(r => r.reading);

    return {
      id: kanji.id,
      character: kanji.character,
      meanings: kanji.meanings.map(m => m.meaning),
      onyomi,
      kunyomi,
      jlpt: kanji.jlptLevel,
      strokes: kanji.strokeCount,
      frequency: kanji.frequencyRank,
      grade: kanji.grade,
      userProgress: progress
        ? {
            srsLevel: progress.srsLevel,
            isMastered: progress.isMastered,
            isFavorited: progress.isFavorited,
            isSuspended: progress.isSuspended,
          }
        : undefined,
    };
  }

  /**
   * Transformar Kanji em KanjiDetailResponseDto
   * @param kanji Kanji com relations completas
   * @param progress UserKanjiProgress (opcional)
   * @returns KanjiDetailResponseDto
   */
  private toDetailDto(kanji: any, progress?: any): KanjiDetailResponseDto {
    // Agrupar leituras por tipo
    const onyomi = kanji.readings
      .filter(r => r.readingType === 'onyomi')
      .map(r => ({
        reading: r.reading,
        romanization: r.romanization,
        isCommon: r.isCommon,
      }));

    const kunyomi = kanji.readings
      .filter(r => r.readingType === 'kunyomi')
      .map(r => ({
        reading: r.reading,
        romanization: r.romanization,
        isCommon: r.isCommon,
      }));

    const nanori = kanji.readings
      .filter(r => r.readingType === 'nanori')
      .map(r => ({
        reading: r.reading,
        romanization: r.romanization,
      }));

    return {
      id: kanji.id,
      character: kanji.character,
      unicodeCodepoint: kanji.unicodeCodepoint,
      jlpt: kanji.jlptLevel,
      strokes: kanji.strokeCount,
      frequency: kanji.frequencyRank,
      grade: kanji.grade,
      meanings: kanji.meanings.map(m => ({
        meaning: m.meaning,
        language: m.language,
        isPrimary: m.isPrimary,
      })),
      readings: {
        onyomi,
        kunyomi,
        nanori: nanori.length > 0 ? nanori : undefined,
      },
      examples: kanji.examples.map(e => ({
        word: e.word,
        reading: e.reading,
        meaning: e.meaning,
        jlpt: e.jlptLevel,
        audioUrl: e.audioUrl,
      })),
      radicals: kanji.radicals.map(kr => ({
        character: kr.radical.character,
        name: kr.radical.name,
        meaning: kr.radical.meaning,
        isPrimary: kr.isPrimary,
      })),
      userProgress: progress
        ? {
            srsLevel: progress.srsLevel,
            isMastered: progress.isMastered,
            isFavorited: progress.isFavorited,
            isSuspended: progress.isSuspended,
            easeFactor: parseFloat(progress.easeFactor),
            intervalDays: progress.intervalDays,
            nextReviewAt: progress.nextReviewAt,
            lastReviewedAt: progress.lastReviewedAt,
            totalReviews: progress.totalReviews,
            correctReviews: progress.correctReviews,
            streak: progress.streakDays,
          }
        : undefined,
    };
  }
}
