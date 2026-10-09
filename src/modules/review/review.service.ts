import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ReviewQuality,
  ReviewSession,
  ReviewSessionStatus,
  SRSItemType,
} from '@prisma/client';
import { logStructured } from '../../common/logging/structured-log';
import {
  CreateReviewSessionDto,
  PaginatedReviewSessionResponseDto,
  ReviewAnswerItemDto,
  ReviewAnswerResponseDto,
  ReviewHistoryQueryDto,
  ReviewQueueCountResponseDto,
  ReviewQueueItemDto,
  ReviewQueueKanjiItemDto,
  ReviewQueueResponseDto,
  ReviewQueueVocabularyItemDto,
  ReviewSessionResponseDto,
  ReviewSessionStatsResponseDto,
  ReviewStatusValue,
  SubmitReviewAnswerDto,
} from './dto';
import { ReviewRepository } from './repositories';
import { SRSQuality } from './srs.service';

const QUALITY_NAMES: Record<ReviewQuality, string> = {
  [ReviewQuality.BLACKOUT]: 'blackout',
  [ReviewQuality.WRONG]: 'wrong',
  [ReviewQuality.CORRECT_HARD]: 'correct_hard',
  [ReviewQuality.CORRECT_EASY]: 'correct_easy',
};

const STATUS_TO_VALUE: Record<ReviewSessionStatus, ReviewStatusValue> = {
  [ReviewSessionStatus.IN_PROGRESS]: 'in_progress',
  [ReviewSessionStatus.COMPLETED]: 'completed',
  [ReviewSessionStatus.ABANDONED]: 'abandoned',
};

const VALUE_TO_SRS_ITEM_TYPE: Record<string, SRSItemType> = {
  kanji: SRSItemType.KANJI,
  vocabulary: SRSItemType.VOCABULARY,
  sentence: SRSItemType.SENTENCE,
};

const VALUE_TO_STATUS: Record<string, ReviewSessionStatus> = {
  in_progress: ReviewSessionStatus.IN_PROGRESS,
  completed: ReviewSessionStatus.COMPLETED,
  abandoned: ReviewSessionStatus.ABANDONED,
};

@Injectable()
export class ReviewService {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  // ─── Fila ───────────────────────────────────────────────────────────────────

  async getQueue(userId: string): Promise<ReviewQueueResponseDto> {
    const now = new Date();
    const preferences = await this.reviewRepository.findUserPreferences(userId);
    const limit = preferences?.srsMaxReviewsPerDay ?? 200;

    const [kanjiCount, vocabularyCount, kanjiProgress, vocabularyProgress] =
      await Promise.all([
        this.reviewRepository.countDueKanji(userId, now),
        this.reviewRepository.countDueVocabulary(userId, now),
        this.reviewRepository.findDueKanjiProgress(userId, now, limit),
        this.reviewRepository.findDueVocabularyProgress(userId, now, limit),
      ]);

    const kanjiItems: ReviewQueueItemDto[] = kanjiProgress.map((progress) => ({
      progress_id: progress.id,
      item_type: 'kanji',
      item: this.toQueueKanjiItem(progress),
      srs_level: progress.srsLevel,
      last_reviewed_at: progress.lastReviewAt?.toISOString() ?? null,
      next_review_at: progress.nextReviewAt.toISOString(),
      review_count: progress.totalReviews,
    }));

    const vocabularyItems: ReviewQueueItemDto[] = vocabularyProgress.map(
      (progress) => ({
        progress_id: progress.id,
        item_type: 'vocabulary',
        item: this.toQueueVocabularyItem(progress),
        srs_level: progress.srsLevel,
        last_reviewed_at: progress.lastReviewAt?.toISOString() ?? null,
        next_review_at: progress.nextReviewAt.toISOString(),
        review_count: progress.totalReviews,
      }),
    );

    // vencidos primeiro (nextReviewAt asc), depois por srsLevel asc
    const items = [...kanjiItems, ...vocabularyItems]
      .sort((a, b) => {
        const byDate = a.next_review_at.localeCompare(b.next_review_at);
        if (byDate !== 0) return byDate;
        return a.srs_level - b.srs_level;
      })
      .slice(0, limit);

    return {
      total_due: kanjiCount + vocabularyCount,
      items,
      by_type: {
        kanji: kanjiCount,
        vocabulary: vocabularyCount,
        // Grammar não possui campos SRS no schema — sempre 0
        grammar: 0,
      },
    };
  }

  async getQueueCount(userId: string): Promise<ReviewQueueCountResponseDto> {
    const now = new Date();
    const [kanji, vocabulary] = await Promise.all([
      this.reviewRepository.countDueKanji(userId, now),
      this.reviewRepository.countDueVocabulary(userId, now),
    ]);

    return { kanji, vocabulary, total: kanji + vocabulary };
  }

  // ─── Sessões ────────────────────────────────────────────────────────────────

  async createSession(
    userId: string,
    dto: CreateReviewSessionDto,
  ): Promise<ReviewSessionResponseDto> {
    const typeValue = dto.session_type ?? dto.sessionType ?? 'kanji';
    const itemType = VALUE_TO_SRS_ITEM_TYPE[typeValue];

    if (!itemType || itemType === SRSItemType.SENTENCE) {
      throw new BadRequestException(`Unsupported session_type '${typeValue}'`);
    }

    const now = new Date();
    const [kanjiDue, vocabularyDue, preferences] = await Promise.all([
      this.reviewRepository.countDueKanji(userId, now),
      this.reviewRepository.countDueVocabulary(userId, now),
      this.reviewRepository.findUserPreferences(userId),
    ]);

    const dueCount = itemType === SRSItemType.KANJI ? kanjiDue : vocabularyDue;
    const limit = preferences?.srsMaxReviewsPerDay ?? 200;
    const totalItems = Math.min(dto.limit ?? dueCount, dueCount, limit);

    const session = await this.reviewRepository.createSession(
      userId,
      itemType,
      totalItems,
    );

    logStructured('info', 'ReviewService', 'review.session.create.success', {
      sessionId: session.id,
      itemType,
      totalItems,
    });

    return this.toSessionDto(session);
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<ReviewSessionResponseDto> {
    const session =
      await this.reviewRepository.findSessionWithAnswers(sessionId);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        `Review session with id ${sessionId} not found`,
      );
    }

    return this.toSessionDto(session, session.answers);
  }

  async endSession(
    userId: string,
    sessionId: string,
  ): Promise<ReviewSessionResponseDto> {
    const result = await this.reviewRepository.completeSession(
      userId,
      sessionId,
      new Date(),
    );

    if (!result.ok) {
      if (result.reason === 'session_not_found') {
        throw new NotFoundException(
          `Review session with id ${sessionId} not found`,
        );
      }
      throw new ConflictException(
        `Review session with id ${sessionId} is not in progress`,
      );
    }

    logStructured('info', 'ReviewService', 'review.session.end.success', {
      sessionId,
      accuracyRate: result.session.accuracyRate,
    });

    return this.toSessionDto(result.session);
  }

  async abandonSession(
    userId: string,
    sessionId: string,
  ): Promise<ReviewSessionResponseDto> {
    const result = await this.reviewRepository.abandonSession(
      userId,
      sessionId,
      new Date(),
    );

    if (!result.ok) {
      if (result.reason === 'session_not_found') {
        throw new NotFoundException(
          `Review session with id ${sessionId} not found`,
        );
      }
      throw new ConflictException(
        `Review session with id ${sessionId} is not in progress`,
      );
    }

    logStructured('info', 'ReviewService', 'review.session.abandon.success', {
      sessionId,
    });

    return this.toSessionDto(result.session);
  }

  // ─── Resposta ───────────────────────────────────────────────────────────────

  async submitAnswer(
    userId: string,
    sessionId: string,
    dto: SubmitReviewAnswerDto,
  ): Promise<ReviewAnswerResponseDto> {
    const itemId = dto.item_id ?? dto.itemId;
    const itemTypeValue = dto.item_type ?? dto.itemType;
    const quality = dto.answer_quality ?? dto.answerQuality ?? dto.quality;
    const responseTimeMs = dto.response_time_ms ?? dto.responseTimeMs ?? null;

    if (!itemId) {
      throw new BadRequestException('item_id is required');
    }

    if (!itemTypeValue) {
      throw new BadRequestException('item_type is required');
    }

    if (quality === undefined) {
      throw new BadRequestException('answer_quality is required');
    }

    const itemType = VALUE_TO_SRS_ITEM_TYPE[itemTypeValue];

    if (!itemType || itemType === SRSItemType.SENTENCE) {
      throw new BadRequestException(`Unsupported item_type '${itemTypeValue}'`);
    }

    const qualityValue = this.toReviewQuality(quality);

    const result = await this.reviewRepository.answerTransaction({
      userId,
      sessionId,
      itemType,
      itemId,
      quality: quality as SRSQuality,
      qualityValue,
      responseTimeMs,
      now: new Date(),
    });

    if (!result.ok) {
      if (result.reason === 'session_not_found') {
        throw new NotFoundException(
          `Review session with id ${sessionId} not found`,
        );
      }
      if (result.reason === 'progress_not_found') {
        throw new NotFoundException(
          `Progress for ${itemTypeValue} ${itemId} not found`,
        );
      }
      throw new ConflictException(
        `Review session with id ${sessionId} is not in progress`,
      );
    }

    const previousSrsLevel = result.answer.srsLevelBefore;
    const previousInterval = result.answer.intervalBefore;
    const session = result.session;

    logStructured('info', 'ReviewService', 'review.answer.success', {
      sessionId,
      itemId,
      quality,
      newSrsLevel: result.answer.srsLevelAfter,
    });

    return {
      previous_srs_level: previousSrsLevel,
      new_srs_level: result.answer.srsLevelAfter,
      previous_interval: previousInterval,
      new_interval: result.answer.intervalAfter,
      next_review_at: result.progress.nextReviewAt.toISOString(),
      is_mastered: result.progress.isMastered,
      session_progress: {
        reviewed: session.completedItems,
        total: session.totalItems,
        correct: session.correctItems,
        incorrect: session.completedItems - session.correctItems,
      },
    };
  }

  // ─── Histórico ──────────────────────────────────────────────────────────────

  async getHistory(
    userId: string,
    query: ReviewHistoryQueryDto,
  ): Promise<PaginatedReviewSessionResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const status = query.status ? VALUE_TO_STATUS[query.status] : undefined;

    if (query.status && !status) {
      throw new BadRequestException(`Invalid status '${query.status}'`);
    }

    const [sessions, total] = await Promise.all([
      this.reviewRepository.findSessions(
        userId,
        status,
        (page - 1) * perPage,
        perPage,
      ),
      this.reviewRepository.countSessions(userId, status),
    ]);

    return {
      data: sessions.map((session) => this.toSessionDto(session)),
      pagination: {
        page,
        perPage,
        total,
        pages: Math.ceil(total / perPage),
      },
    };
  }

  // ─── Estatísticas ───────────────────────────────────────────────────────────

  async getSessionStats(
    userId: string,
    sessionId: string,
  ): Promise<ReviewSessionStatsResponseDto> {
    const session = await this.reviewRepository.findSessionById(sessionId);

    if (!session || session.userId !== userId) {
      throw new NotFoundException(
        `Review session with id ${sessionId} not found`,
      );
    }

    const answerStats =
      await this.reviewRepository.getSessionAnswerStats(sessionId);

    const reviewedItems = session.completedItems;
    const correctItems = session.correctItems;

    const accuracyRate =
      session.accuracyRate ??
      (reviewedItems > 0 ? correctItems / reviewedItems : 0);
    const durationSeconds =
      session.durationSeconds ??
      Math.max(
        0,
        Math.floor((Date.now() - session.startedAt.getTime()) / 1000),
      );

    return {
      session_id: session.id,
      status: STATUS_TO_VALUE[session.status],
      session_type: this.toItemTypeValue(session.itemType),
      total_items: session.totalItems,
      reviewed_items: reviewedItems,
      correct_items: correctItems,
      incorrect_items: reviewedItems - correctItems,
      accuracy_rate: accuracyRate,
      duration_seconds: durationSeconds,
      average_response_time_ms: answerStats.averageResponseTimeMs,
      mastered_count: answerStats.masteredCount,
      quality_breakdown: {
        blackout: answerStats.counts[ReviewQuality.BLACKOUT] ?? 0,
        wrong: answerStats.counts[ReviewQuality.WRONG] ?? 0,
        correct_hard: answerStats.counts[ReviewQuality.CORRECT_HARD] ?? 0,
        correct_easy: answerStats.counts[ReviewQuality.CORRECT_EASY] ?? 0,
      },
      started_at: session.startedAt.toISOString(),
      completed_at: session.completedAt?.toISOString() ?? null,
    };
  }

  // ─── Mapeamentos ────────────────────────────────────────────────────────────

  private toReviewQuality(quality: number): ReviewQuality {
    switch (quality) {
      case 0:
        return ReviewQuality.BLACKOUT;
      case 1:
        return ReviewQuality.WRONG;
      case 2:
        return ReviewQuality.CORRECT_HARD;
      case 3:
        return ReviewQuality.CORRECT_EASY;
      default:
        throw new BadRequestException(
          `Invalid answer_quality ${quality} (expected 0-3)`,
        );
    }
  }

  private toItemTypeValue(
    itemType: SRSItemType,
  ): 'kanji' | 'vocabulary' | 'sentence' {
    switch (itemType) {
      case SRSItemType.VOCABULARY:
        return 'vocabulary';
      case SRSItemType.SENTENCE:
        return 'sentence';
      default:
        return 'kanji';
    }
  }

  private toQueueKanjiItem(progress: {
    kanji: {
      id: string;
      character: string;
      jlptLevel: string;
      strokeCount: number | null;
      grade: number | null;
      frequency: number | null;
      meanings: { meaning: string }[];
      readings: { reading: string; type: string }[];
    };
  }): ReviewQueueKanjiItemDto {
    const kanji = progress.kanji;
    const onyomi = kanji.readings
      .filter((reading) => reading.type === 'ONYOMI')
      .map((reading) => reading.reading);
    const kunyomi = kanji.readings
      .filter((reading) => reading.type === 'KUNYOMI')
      .map((reading) => reading.reading);

    const item: ReviewQueueKanjiItemDto = {
      id: kanji.id,
      character: kanji.character,
      meanings: kanji.meanings.map((meaning) => meaning.meaning),
      readings: { onyomi, kunyomi },
      jlpt: kanji.jlptLevel,
      strokes: kanji.strokeCount ?? 0,
    };

    if (kanji.grade !== null) item.grade = kanji.grade;
    if (kanji.frequency !== null) item.frequency = kanji.frequency;

    return item;
  }

  private toQueueVocabularyItem(progress: {
    vocabulary: {
      id: string;
      word: string;
      reading: string;
      jlptLevel: string;
      partOfSpeech: string | null;
      meanings: { meaning: string }[];
    };
  }): ReviewQueueVocabularyItemDto {
    const vocabulary = progress.vocabulary;

    return {
      id: vocabulary.id,
      word: vocabulary.word,
      reading: vocabulary.reading,
      meanings: vocabulary.meanings.map((meaning) => meaning.meaning),
      jlpt: vocabulary.jlptLevel,
      partOfSpeech: vocabulary.partOfSpeech,
    };
  }

  private toSessionDto(
    session: ReviewSession,
    answers?: {
      id: string;
      itemType: SRSItemType;
      itemId: string;
      quality: ReviewQuality;
      responseTimeMs: number | null;
      srsLevelBefore: number;
      srsLevelAfter: number;
      intervalBefore: number;
      intervalAfter: number;
      answeredAt: Date;
    }[],
  ): ReviewSessionResponseDto {
    const dto: ReviewSessionResponseDto = {
      id: session.id,
      user_id: session.userId,
      session_type: this.toItemTypeValue(session.itemType),
      status: STATUS_TO_VALUE[session.status],
      total_items: session.totalItems,
      reviewed_items: session.completedItems,
      correct_items: session.correctItems,
      incorrect_items: session.completedItems - session.correctItems,
      accuracy_rate: session.accuracyRate,
      duration_seconds: session.durationSeconds,
      started_at: session.startedAt.toISOString(),
      completed_at: session.completedAt?.toISOString() ?? null,
      abandoned_at: session.abandonedAt?.toISOString() ?? null,
    };

    if (answers) {
      dto.answers = answers.map((answer) => this.toAnswerItemDto(answer));
    }

    return dto;
  }

  private toAnswerItemDto(answer: {
    id: string;
    itemType: SRSItemType;
    itemId: string;
    quality: ReviewQuality;
    responseTimeMs: number | null;
    srsLevelBefore: number;
    srsLevelAfter: number;
    intervalBefore: number;
    intervalAfter: number;
    answeredAt: Date;
  }): ReviewAnswerItemDto {
    return {
      id: answer.id,
      item_type: this.toItemTypeValue(answer.itemType),
      item_id: answer.itemId,
      quality: this.qualityToNumber(answer.quality),
      quality_name: QUALITY_NAMES[answer.quality],
      response_time_ms: answer.responseTimeMs,
      srs_level_before: answer.srsLevelBefore,
      srs_level_after: answer.srsLevelAfter,
      interval_before: answer.intervalBefore,
      interval_after: answer.intervalAfter,
      answered_at: answer.answeredAt.toISOString(),
    };
  }

  private qualityToNumber(quality: ReviewQuality): number {
    switch (quality) {
      case ReviewQuality.WRONG:
        return 1;
      case ReviewQuality.CORRECT_HARD:
        return 2;
      case ReviewQuality.CORRECT_EASY:
        return 3;
      default:
        return 0;
    }
  }
}
