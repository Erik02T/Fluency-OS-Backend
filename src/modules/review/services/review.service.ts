import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  Prisma,
  ReviewQuality,
  ReviewSessionStatus,
  SRSItemType,
} from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { RedisService } from '../../../common/services/redis.service';
import { logStructured } from '../../../common/logging/structured-log';
import { SRSService } from './srs.service';
import { StreakService } from './streak.service';
import { DailyGoalService } from './daily-goal.service';
import { ReviewEventsService } from './review-events.service';
import {
  ReviewSessionRepository,
  ReviewAnswerRepository,
} from '../repositories';
import {
  CreateReviewSessionDto,
  PaginatedReviewSessionResponseDto,
  ReviewAnswerResponseDto,
  ReviewHistoryQueryDto,
  ReviewQueueCountResponseDto,
  ReviewQueueItemDto,
  ReviewQueueResponseDto,
  ReviewSessionResponseDto,
  ReviewSessionStatsResponseDto,
  SubmitReviewAnswerDto,
} from '../dto';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionRepo: ReviewSessionRepository,
    private readonly answerRepo: ReviewAnswerRepository,
    private readonly srsService: SRSService,
    private readonly streakService: StreakService,
    private readonly dailyGoalService: DailyGoalService,
    private readonly eventsService: ReviewEventsService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * Helper para formatar ReviewSession -> ReviewSessionResponseDto
   */
  private toSessionDto(session: {
    id: string;
    userId: string;
    itemType: SRSItemType;
    status: ReviewSessionStatus;
    totalItems: number;
    completedItems: number;
    correctItems: number;
    accuracyRate: number | null;
    durationSeconds: number | null;
    startedAt: Date;
    completedAt: Date | null;
    abandonedAt?: Date | null;
    answers?: Array<{
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
    }>;
  }): ReviewSessionResponseDto {
    const incorrectItems = Math.max(
      0,
      session.completedItems - session.correctItems,
    );

    return {
      id: session.id,
      user_id: session.userId,
      session_type: session.itemType.toLowerCase(),
      status: session.status.toLowerCase(),
      total_items: session.totalItems,
      reviewed_items: session.completedItems,
      correct_items: session.correctItems,
      incorrect_items: incorrectItems,
      accuracy_rate: session.accuracyRate,
      duration_seconds: session.durationSeconds,
      started_at: session.startedAt.toISOString(),
      completed_at: session.completedAt
        ? session.completedAt.toISOString()
        : null,
      abandoned_at: session.abandonedAt
        ? session.abandonedAt.toISOString()
        : null,
      answers: session.answers?.map((ans) => ({
        id: ans.id,
        item_type: ans.itemType.toLowerCase(),
        item_id: ans.itemId,
        quality: this.srsService.mapEnumToQuality(ans.quality),
        quality_name: ans.quality,
        response_time_ms: ans.responseTimeMs,
        srs_level_before: ans.srsLevelBefore,
        srs_level_after: ans.srsLevelAfter,
        interval_before: ans.intervalBefore,
        interval_after: ans.intervalAfter,
        answered_at: ans.answeredAt.toISOString(),
      })),
    };
  }

  /**
   * GET /review/queue — Fila de revisão do dia
   */
  async getQueue(userId: string): Promise<ReviewQueueResponseDto> {
    logStructured('info', 'ReviewService', 'review.queue.start', { userId });
    const now = new Date();

    // 1. Obter preferências de limite diário do usuário
    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });
    const maxReviews = prefs?.srsMaxReviewsPerDay ?? 50;

    // 2. Buscar itens vencidos de kanji e vocabulário em paralelo
    const [kanjiProgresses, vocabProgresses, kanjiDueCount, vocabDueCount] =
      await Promise.all([
        this.prisma.userKanjiProgress.findMany({
          where: {
            userId,
            isSuspended: false,
            isMastered: false,
            nextReviewAt: { lte: now },
          },
          include: {
            kanji: {
              include: {
                meanings: {
                  where: { language: { in: ['pt', 'en'] } },
                  orderBy: { position: 'asc' },
                },
                readings: true,
              },
            },
          },
          orderBy: [{ nextReviewAt: 'asc' }, { srsLevel: 'asc' }],
          take: maxReviews,
        }),
        this.prisma.userVocabularyProgress.findMany({
          where: {
            userId,
            isSuspended: false,
            isMastered: false,
            nextReviewAt: { lte: now },
          },
          include: {
            vocabulary: {
              include: {
                meanings: {
                  orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }],
                },
              },
            },
          },
          orderBy: [{ nextReviewAt: 'asc' }, { srsLevel: 'asc' }],
          take: maxReviews,
        }),
        this.prisma.userKanjiProgress.count({
          where: {
            userId,
            isSuspended: false,
            isMastered: false,
            nextReviewAt: { lte: now },
          },
        }),
        this.prisma.userVocabularyProgress.count({
          where: {
            userId,
            isSuspended: false,
            isMastered: false,
            nextReviewAt: { lte: now },
          },
        }),
      ]);

    const totalDue = kanjiDueCount + vocabDueCount;

    // 4. Mapear itens da fila
    const items: ReviewQueueItemDto[] = [
      ...kanjiProgresses.map((p) => {
        const meanings =
          p.kanji.meanings.length > 0
            ? p.kanji.meanings.map((m) => m.meaning)
            : [];

        const onyomi = p.kanji.readings
          .filter((r) => r.type === 'ONYOMI')
          .map((r) => r.reading);

        const kunyomi = p.kanji.readings
          .filter((r) => r.type === 'KUNYOMI')
          .map((r) => r.reading);

        return {
          progress_id: p.id,
          item_type: 'kanji',
          item: {
            id: p.kanji.id,
            character: p.kanji.character,
            meanings,
            readings: {
              onyomi,
              kunyomi,
            },
            jlpt: p.kanji.jlptLevel,
            strokes: p.kanji.strokeCount ?? 0,
            grade: p.kanji.grade ?? 0,
            frequency: p.kanji.frequency ?? 0,
          },
          srs_level: p.srsLevel,
          last_reviewed_at: p.lastReviewAt
            ? p.lastReviewAt.toISOString()
            : null,
          next_review_at: p.nextReviewAt.toISOString(),
          review_count: p.totalReviews,
        };
      }),
      ...vocabProgresses.map((p) => ({
        progress_id: p.id,
        item_type: 'vocabulary',
        item: {
          id: p.vocabulary.id,
          word: p.vocabulary.word,
          reading: p.vocabulary.reading,
          meanings:
            p.vocabulary.meanings.length > 0
              ? p.vocabulary.meanings.map((m) => m.meaning)
              : [],
          jlpt: p.vocabulary.jlptLevel ?? null,
          partOfSpeech: p.vocabulary.partOfSpeech ?? null,
        },
        srs_level: p.srsLevel,
        last_reviewed_at: p.lastReviewAt ? p.lastReviewAt.toISOString() : null,
        next_review_at: p.nextReviewAt.toISOString(),
        review_count: p.totalReviews,
      })),
    ];

    logStructured('info', 'ReviewService', 'review.queue.success', {
      userId,
      totalDue,
      itemCount: items.length,
    });

    return {
      total_due: totalDue,
      items,
      by_type: {
        kanji: kanjiDueCount,
        vocabulary: vocabDueCount,
        // Grammar ainda não tem infraestrutura SRS — mantém 0 até ser implementado
        grammar: 0,
      },
    };
  }

  /**
   * GET /review/queue/count — Contagem rápida de itens na fila
   */
  async getQueueCount(userId: string): Promise<ReviewQueueCountResponseDto> {
    const cacheKey = `user:${userId}:review_queue_count`;

    if (this.redisService) {
      try {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          return JSON.parse(cached) as ReviewQueueCountResponseDto;
        }
      } catch {
        // Ignora erro de cache e consulta o banco
      }
    }

    const now = new Date();
    const [kanji, vocabulary] = await Promise.all([
      this.prisma.userKanjiProgress.count({
        where: {
          userId,
          isSuspended: false,
          isMastered: false,
          nextReviewAt: { lte: now },
        },
      }),
      this.prisma.userVocabularyProgress.count({
        where: {
          userId,
          isSuspended: false,
          isMastered: false,
          nextReviewAt: { lte: now },
        },
      }),
    ]);

    const result: ReviewQueueCountResponseDto = {
      kanji,
      vocabulary,
      total: kanji + vocabulary,
    };

    if (this.redisService) {
      try {
        await this.redisService.set(cacheKey, JSON.stringify(result), 60); // 60 segundos de TTL
      } catch {
        // Ignora erro de escrita em cache
      }
    }

    return result;
  }

  /**
   * Invalida cache de contagem de fila no Redis
   */
  private async invalidateQueueCountCache(userId: string): Promise<void> {
    if (this.redisService) {
      try {
        await this.redisService.del(`user:${userId}:review_queue_count`);
      } catch {
        // Ignora erro
      }
    }
  }

  /**
   * POST /review/sessions — Iniciar nova sessão de revisão
   */
  async createSession(
    userId: string,
    dto?: CreateReviewSessionDto,
  ): Promise<ReviewSessionResponseDto> {
    const rawType = (
      dto?.session_type ||
      dto?.sessionType ||
      'kanji'
    ).toUpperCase();

    // Apenas KANJI e VOCABULARY possuem infraestrutura SRS completa.
    // SENTENCE e GRAMMAR ainda não têm campos SRS no schema — rejeitamos
    // explicitamente para não fingir suporte.
    if (
      rawType === 'SENTENCE' ||
      rawType === 'GRAMMAR' ||
      rawType === 'MIXED'
    ) {
      throw new BadRequestException(
        `Session type '${rawType.toLowerCase()}' is not supported yet. Use 'kanji' or 'vocabulary'.`,
      );
    }

    let itemType: SRSItemType = SRSItemType.KANJI;
    if (rawType === 'VOCABULARY') {
      itemType = SRSItemType.VOCABULARY;
    }

    logStructured('info', 'ReviewService', 'review.session.create.start', {
      userId,
      itemType,
    });

    const now = new Date();
    let dueCount = 0;

    if (itemType === SRSItemType.KANJI) {
      dueCount = await this.prisma.userKanjiProgress.count({
        where: {
          userId,
          isSuspended: false,
          isMastered: false,
          nextReviewAt: { lte: now },
        },
      });
    } else if (itemType === SRSItemType.VOCABULARY) {
      dueCount = await this.prisma.userVocabularyProgress.count({
        where: {
          userId,
          isSuspended: false,
          isMastered: false,
          nextReviewAt: { lte: now },
        },
      });
    }

    if (dueCount === 0) {
      throw new BadRequestException(
        `No ${itemType.toLowerCase()} items are due for review.`,
      );
    }

    const totalItems = dto?.limit ? Math.min(dto.limit, dueCount) : dueCount;

    const session = await this.sessionRepo.createSession({
      userId,
      itemType,
      status: ReviewSessionStatus.IN_PROGRESS,
      totalItems,
      completedItems: 0,
      correctItems: 0,
      startedAt: now,
    });

    logStructured('info', 'ReviewService', 'review.session.create.success', {
      sessionId: session.id,
      userId,
      totalItems,
    });

    return this.toSessionDto(session);
  }

  /**
   * GET /review/sessions/:id — Consultar estado da sessão
   */
  async getSession(
    sessionId: string,
    userId: string,
  ): Promise<ReviewSessionResponseDto> {
    const session = await this.sessionRepo.findByIdWithAnswers(sessionId);

    if (!session) {
      throw new NotFoundException(`Review session ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this review session',
      );
    }

    return this.toSessionDto(session);
  }

  /**
   * POST /review/sessions/:id/answer — Registrar resposta de um item (Atômico)
   */
  async submitAnswer(
    sessionId: string,
    userId: string,
    dto: SubmitReviewAnswerDto,
  ): Promise<ReviewAnswerResponseDto> {
    const itemId = dto.item_id || dto.itemId;
    const itemType = (dto.item_type || dto.itemType || 'kanji').toLowerCase();
    const quality =
      dto.answer_quality !== undefined ? dto.answer_quality : dto.answerQuality;
    const responseTimeMs =
      dto.response_time_ms !== undefined
        ? dto.response_time_ms
        : dto.responseTimeMs;

    if (!itemId) {
      throw new BadRequestException('item_id is required');
    }

    if (
      quality === undefined ||
      quality === null ||
      quality < 0 ||
      quality > 3
    ) {
      throw new BadRequestException('answer_quality must be 0, 1, 2, or 3');
    }

    logStructured('info', 'ReviewService', 'review.session.answer.start', {
      sessionId,
      userId,
      itemId,
      quality,
    });

    // 1. Validar sessão
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new NotFoundException(`Review session ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this review session',
      );
    }

    if (session.status !== ReviewSessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot answer in session with status ${session.status.toLowerCase()}`,
      );
    }

    // 2. Prevenir resposta duplicada para o mesmo item nesta sessão
    const alreadyAnswered = await this.answerRepo.findBySessionAndItem(
      sessionId,
      itemId,
    );
    if (alreadyAnswered) {
      throw new ConflictException(
        'Item already answered in this review session',
      );
    }

    // 3. Buscar progresso atual do item
    type KanjiProgressType = {
      id: string;
      userId: string;
      kanjiId: string;
      srsLevel: number;
      easeFactor: number;
      intervalDays: number;
      nextReviewAt: Date;
      lastReviewAt: Date | null;
      totalReviews: number;
      correctReviews: number;
      isMastered: boolean;
      masteredAt: Date | null;
    };

    type VocabProgressType = {
      id: string;
      userId: string;
      vocabularyId: string;
      srsLevel: number;
      easeFactor: number;
      intervalDays: number;
      nextReviewAt: Date;
      lastReviewAt: Date | null;
      totalReviews: number;
      correctReviews: number;
      isMastered: boolean;
      masteredAt: Date | null;
    };

    let progressKanji: KanjiProgressType | null = null;
    let progressVocab: VocabProgressType | null = null;

    if (itemType === 'kanji') {
      progressKanji = await this.prisma.userKanjiProgress.findUnique({
        where: {
          userId_kanjiId: { userId, kanjiId: itemId },
        },
      });

      if (!progressKanji) {
        throw new NotFoundException(
          `User progress for kanji ${itemId} not found`,
        );
      }
    } else if (itemType === 'vocabulary') {
      progressVocab = await this.prisma.userVocabularyProgress.findUnique({
        where: {
          userId_vocabularyId: { userId, vocabularyId: itemId },
        },
      });

      if (!progressVocab) {
        throw new NotFoundException(
          `User progress for vocabulary ${itemId} not found`,
        );
      }
    } else {
      throw new BadRequestException(`Unsupported item_type '${itemType}'`);
    }

    const currentProgress = (progressKanji || progressVocab)!;

    // 4. Calcular próximo estado SRS usando SRSService centralizado
    const now = new Date();
    const srsResult = this.srsService.calculateNextReview(
      {
        srsLevel: currentProgress.srsLevel,
        easeFactor: currentProgress.easeFactor,
        intervalDays: currentProgress.intervalDays,
        isMastered: currentProgress.isMastered,
      },
      quality,
      now,
    );

    const isCorrect = quality >= 2;
    const enumItemType =
      itemType === 'vocabulary' ? SRSItemType.VOCABULARY : SRSItemType.KANJI;

    // 5. Execução Atômica via prisma.$transaction
    const { updatedSession } = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // A) Atualizar Progresso do Usuário
        if (itemType === 'kanji') {
          await tx.userKanjiProgress.update({
            where: { id: progressKanji!.id },
            data: {
              srsLevel: srsResult.newSrsLevel,
              easeFactor: srsResult.newEaseFactor,
              intervalDays: srsResult.newInterval,
              nextReviewAt: srsResult.nextReviewAt,
              lastReviewAt: now,
              totalReviews: { increment: 1 },
              correctReviews: isCorrect ? { increment: 1 } : undefined,
              isMastered: srsResult.isMastered,
              masteredAt:
                srsResult.isMastered && !progressKanji!.isMastered
                  ? now
                  : progressKanji!.masteredAt,
            },
          });
        } else {
          await tx.userVocabularyProgress.update({
            where: { id: progressVocab!.id },
            data: {
              srsLevel: srsResult.newSrsLevel,
              easeFactor: srsResult.newEaseFactor,
              intervalDays: srsResult.newInterval,
              nextReviewAt: srsResult.nextReviewAt,
              lastReviewAt: now,
              totalReviews: { increment: 1 },
              correctReviews: isCorrect ? { increment: 1 } : undefined,
              isMastered: srsResult.isMastered,
              masteredAt:
                srsResult.isMastered && !progressVocab!.isMastered
                  ? now
                  : progressVocab!.masteredAt,
            },
          });
        }

        // B) Inserir ReviewAnswer
        await tx.reviewAnswer.create({
          data: {
            sessionId: session.id,
            itemType: enumItemType,
            itemId,
            quality: srsResult.quality,
            responseTimeMs:
              responseTimeMs !== undefined ? responseTimeMs : null,
            srsLevelBefore: srsResult.previousSrsLevel,
            srsLevelAfter: srsResult.newSrsLevel,
            intervalBefore: srsResult.previousInterval,
            intervalAfter: srsResult.newInterval,
            answeredAt: now,
          },
        });

        // C) Atualizar ReviewSession
        const newCompleted = session.completedItems + 1;
        const newCorrect = session.correctItems + (isCorrect ? 1 : 0);
        const accuracyRate = Number(
          ((newCorrect / newCompleted) * 100).toFixed(1),
        );

        const updatedSessionRecord = await tx.reviewSession.update({
          where: { id: session.id },
          data: {
            completedItems: newCompleted,
            correctItems: newCorrect,
            accuracyRate,
          },
        });

        // D) Atualizar Streak e Daily Goal
        await this.streakService.recordActivity(
          userId,
          itemType,
          undefined,
          tx,
        );
        await this.dailyGoalService.recordReviewProgress(
          userId,
          itemType,
          undefined,
          tx,
        );

        return { updatedSession: updatedSessionRecord };
      },
    );

    // 6. Invalidação de cache e disparo de eventos
    await this.invalidateQueueCountCache(userId);

    if (itemType === 'kanji') {
      this.eventsService.emitKanjiReviewed({
        userId,
        kanjiId: itemId,
        quality,
        newSrsLevel: srsResult.newSrsLevel,
      });

      if (srsResult.isMastered && !progressKanji?.isMastered) {
        this.eventsService.emitKanjiMastered({
          userId,
          kanjiId: itemId,
        });
      }
    }

    const reviewed = updatedSession.completedItems;
    const correct = updatedSession.correctItems;
    const incorrect = Math.max(0, reviewed - correct);
    const total = Math.max(reviewed, updatedSession.totalItems);

    logStructured('info', 'ReviewService', 'review.session.answer.success', {
      sessionId,
      itemId,
      newSrsLevel: srsResult.newSrsLevel,
      reviewed,
      total,
    });

    return {
      previous_srs_level: srsResult.previousSrsLevel,
      new_srs_level: srsResult.newSrsLevel,
      previous_interval: srsResult.previousInterval,
      new_interval: srsResult.newInterval,
      next_review_at: srsResult.nextReviewAt.toISOString(),
      is_mastered: srsResult.isMastered,
      session_progress: {
        reviewed,
        total,
        correct,
        incorrect,
      },
    };
  }

  /**
   * POST /review/sessions/:id/end — Encerrar sessão normalmente
   */
  async endSession(
    sessionId: string,
    userId: string,
  ): Promise<ReviewSessionResponseDto> {
    logStructured('info', 'ReviewService', 'review.session.end.start', {
      sessionId,
      userId,
    });

    const session = await this.sessionRepo.findByIdWithAnswers(sessionId);
    if (!session) {
      throw new NotFoundException(`Review session ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this review session',
      );
    }

    if (session.status === ReviewSessionStatus.COMPLETED) {
      return this.toSessionDto(session);
    }

    const now = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((now.getTime() - session.startedAt.getTime()) / 1000),
    );

    const accuracyRate =
      session.completedItems > 0
        ? Number(
            ((session.correctItems / session.completedItems) * 100).toFixed(1),
          )
        : 0;

    const updated = await this.sessionRepo.updateSession(sessionId, {
      status: ReviewSessionStatus.COMPLETED,
      completedAt: now,
      accuracyRate,
      durationSeconds,
    });

    this.eventsService.emitSessionCompleted({
      userId,
      sessionId,
      totalItems: updated.totalItems,
      reviewedItems: updated.completedItems,
      correctItems: updated.correctItems,
      accuracyRate,
      durationSeconds,
    });

    logStructured('info', 'ReviewService', 'review.session.end.success', {
      sessionId,
      userId,
      accuracyRate,
      durationSeconds,
    });

    return this.toSessionDto({
      ...updated,
      answers: session.answers,
    });
  }

  /**
   * Abandonar sessão (preserva respostas já respondidas)
   */
  async abandonSession(
    sessionId: string,
    userId: string,
  ): Promise<ReviewSessionResponseDto> {
    const session = await this.sessionRepo.findByIdWithAnswers(sessionId);
    if (!session) {
      throw new NotFoundException(`Review session ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this review session',
      );
    }

    if (session.status !== ReviewSessionStatus.IN_PROGRESS) {
      return this.toSessionDto(session);
    }

    const now = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((now.getTime() - session.startedAt.getTime()) / 1000),
    );

    const accuracyRate =
      session.completedItems > 0
        ? Number(
            ((session.correctItems / session.completedItems) * 100).toFixed(1),
          )
        : null;

    const updated = await this.sessionRepo.updateSession(sessionId, {
      status: ReviewSessionStatus.ABANDONED,
      abandonedAt: now,
      accuracyRate,
      durationSeconds,
    });

    return this.toSessionDto({
      ...updated,
      answers: session.answers,
    });
  }

  /**
   * GET /review/sessions/history — Histórico de sessões do usuário
   */
  async getHistory(
    userId: string,
    query: ReviewHistoryQueryDto,
  ): Promise<PaginatedReviewSessionResponseDto> {
    const page = Math.max(1, query.page || 1);
    const perPage = Math.min(100, Math.max(1, query.perPage || 20));
    const skip = (page - 1) * perPage;

    let statusEnum: ReviewSessionStatus | undefined = undefined;
    if (query.status) {
      const upper = query.status.toUpperCase();
      if (upper in ReviewSessionStatus) {
        statusEnum = upper as ReviewSessionStatus;
      }
    }

    const [sessions, total] = await Promise.all([
      this.sessionRepo.findUserHistory(userId, {
        skip,
        take: perPage,
        status: statusEnum,
      }),
      this.sessionRepo.countUserHistory(userId, statusEnum),
    ]);

    const data = sessions.map((s) => this.toSessionDto(s));
    const pages = Math.ceil(total / perPage);

    return {
      data,
      pagination: {
        page,
        perPage,
        total,
        pages,
      },
    };
  }

  /**
   * GET /review/sessions/:id/stats — Estatísticas completas da sessão
   */
  async getStats(
    sessionId: string,
    userId: string,
  ): Promise<ReviewSessionStatsResponseDto> {
    const session = await this.sessionRepo.findByIdWithAnswers(sessionId);

    if (!session) {
      throw new NotFoundException(`Review session ${sessionId} not found`);
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'You do not have access to this review session',
      );
    }

    const answers = session.answers || [];

    let blackoutCount = 0;
    let wrongCount = 0;
    let correctHardCount = 0;
    let correctEasyCount = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;
    let masteredCount = 0;

    for (const ans of answers) {
      if (ans.quality === ReviewQuality.BLACKOUT) blackoutCount++;
      else if (ans.quality === ReviewQuality.WRONG) wrongCount++;
      else if (ans.quality === ReviewQuality.CORRECT_HARD) correctHardCount++;
      else if (ans.quality === ReviewQuality.CORRECT_EASY) correctEasyCount++;

      if (ans.responseTimeMs !== null && ans.responseTimeMs !== undefined) {
        totalResponseTime += ans.responseTimeMs;
        responseTimeCount++;
      }

      if (ans.srsLevelBefore < 5 && ans.srsLevelAfter >= 5) {
        masteredCount++;
      }
    }

    const averageResponseTimeMs =
      responseTimeCount > 0
        ? Math.round(totalResponseTime / responseTimeCount)
        : null;

    const accuracyRate =
      session.accuracyRate !== null && session.accuracyRate !== undefined
        ? session.accuracyRate
        : session.completedItems > 0
          ? Number(
              ((session.correctItems / session.completedItems) * 100).toFixed(
                1,
              ),
            )
          : 0;

    const durationSeconds =
      session.durationSeconds ??
      Math.max(
        0,
        Math.round(
          ((session.completedAt || new Date()).getTime() -
            session.startedAt.getTime()) /
            1000,
        ),
      );

    return {
      session_id: session.id,
      status: session.status.toLowerCase(),
      session_type: session.itemType.toLowerCase(),
      total_items: session.totalItems,
      reviewed_items: session.completedItems,
      correct_items: session.correctItems,
      incorrect_items: Math.max(
        0,
        session.completedItems - session.correctItems,
      ),
      accuracy_rate: accuracyRate,
      duration_seconds: durationSeconds,
      average_response_time_ms: averageResponseTimeMs,
      mastered_count: masteredCount,
      quality_breakdown: {
        blackout: blackoutCount,
        wrong: wrongCount,
        correct_hard: correctHardCount,
        correct_easy: correctEasyCount,
      },
      started_at: session.startedAt.toISOString(),
      completed_at: session.completedAt
        ? session.completedAt.toISOString()
        : null,
    };
  }
}
