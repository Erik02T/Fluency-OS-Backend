import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ReviewAnswer,
  ReviewQuality,
  ReviewSession,
  ReviewSessionStatus,
  SRSItemType,
  UserKanjiProgress,
  UserVocabularyProgress,
} from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { SrsService, SRSQuality } from '../srs.service';

export type ReviewProgressEntity = UserKanjiProgress | UserVocabularyProgress;

export type DueKanjiProgressWithRelations = UserKanjiProgress & {
  kanji: {
    id: string;
    character: string;
    jlptLevel: string;
    strokeCount: number | null;
    grade: number | null;
    frequency: number | null;
    meanings: { meaning: string; isPrimary: boolean; position: number }[];
    readings: { reading: string; type: string; isPrimary: boolean }[];
  };
};

export type DueVocabularyProgressWithRelations = UserVocabularyProgress & {
  vocabulary: {
    id: string;
    word: string;
    reading: string;
    jlptLevel: string | null;
    partOfSpeech: string | null;
    meanings: { meaning: string; isPrimary: boolean; position: number }[];
  };
};

export type AnswerTransactionResult =
  | {
      ok: true;
      progress: ReviewProgressEntity;
      answer: ReviewAnswer;
      session: ReviewSession;
    }
  | {
      ok: false;
      reason: 'session_not_found' | 'session_not_active' | 'progress_not_found';
    };

export type SessionStateChangeResult =
  | { ok: true; session: ReviewSession }
  | { ok: false; reason: 'session_not_found' | 'session_not_active' };

class RollbackAnswerError extends Error {
  constructor(
    readonly reason:
      | 'session_not_found'
      | 'session_not_active'
      | 'progress_not_found',
  ) {
    super(`answer rollback: ${reason}`);
  }
}

@Injectable()
export class ReviewRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly srs: SrsService,
  ) {}

  // ─── Fila de revisão ────────────────────────────────────────────────────────

  findDueKanjiProgress(
    userId: string,
    now: Date,
    take: number,
  ): Promise<DueKanjiProgressWithRelations[]> {
    return this.prisma.userKanjiProgress.findMany({
      where: {
        userId,
        isSuspended: false,
        nextReviewAt: { lte: now },
      },
      orderBy: [{ nextReviewAt: 'asc' }, { srsLevel: 'asc' }],
      take,
      include: {
        kanji: {
          include: {
            meanings: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }] },
            readings: { orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }] },
          },
        },
      },
    });
  }

  findDueVocabularyProgress(
    userId: string,
    now: Date,
    take: number,
  ): Promise<DueVocabularyProgressWithRelations[]> {
    return this.prisma.userVocabularyProgress.findMany({
      where: {
        userId,
        isSuspended: false,
        nextReviewAt: { lte: now },
      },
      orderBy: [{ nextReviewAt: 'asc' }, { srsLevel: 'asc' }],
      take,
      include: {
        vocabulary: {
          include: {
            meanings: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }] },
          },
        },
      },
    });
  }

  countDueKanji(userId: string, now: Date): Promise<number> {
    return this.prisma.userKanjiProgress.count({
      where: { userId, isSuspended: false, nextReviewAt: { lte: now } },
    });
  }

  countDueVocabulary(userId: string, now: Date): Promise<number> {
    return this.prisma.userVocabularyProgress.count({
      where: { userId, isSuspended: false, nextReviewAt: { lte: now } },
    });
  }

  findUserPreferences(userId: string) {
    return this.prisma.userPreferences.findUnique({ where: { userId } });
  }

  // ─── Sessões ────────────────────────────────────────────────────────────────

  createSession(
    userId: string,
    itemType: SRSItemType,
    totalItems: number,
  ): Promise<ReviewSession> {
    return this.prisma.reviewSession.create({
      data: {
        userId,
        itemType,
        totalItems,
      },
    });
  }

  findSessionById(sessionId: string): Promise<ReviewSession | null> {
    return this.prisma.reviewSession.findUnique({ where: { id: sessionId } });
  }

  findSessionWithAnswers(sessionId: string) {
    return this.prisma.reviewSession.findUnique({
      where: { id: sessionId },
      include: {
        answers: { orderBy: { answeredAt: 'asc' } },
      },
    });
  }

  findSessions(
    userId: string,
    status: ReviewSessionStatus | undefined,
    skip: number,
    take: number,
  ): Promise<ReviewSession[]> {
    return this.prisma.reviewSession.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { startedAt: 'desc' },
      skip,
      take,
    });
  }

  countSessions(
    userId: string,
    status: ReviewSessionStatus | undefined,
  ): Promise<number> {
    return this.prisma.reviewSession.count({
      where: { userId, ...(status ? { status } : {}) },
    });
  }

  // ─── Resposta (transação atômica) ──────────────────────────────────────────

  /**
   * Aplica uma resposta de revisão em uma única transação:
   * 1. valida sessão (propriedade + status IN_PROGRESS)
   * 2. carrega o progresso do item
   * 3. calcula o novo SRS (SM-2 adaptado)
   * 4. UPDATE user_{kanji,vocabulary}_progress
   * 5. INSERT review_answers
   * 6. UPDATE review_sessions (contadores atômicos)
   *
   * Qualquer violação lança RollbackAnswerError → transação desfaz tudo.
   */
  async answerTransaction(params: {
    userId: string;
    sessionId: string;
    itemType: SRSItemType;
    itemId: string;
    quality: SRSQuality;
    qualityValue: ReviewQuality;
    responseTimeMs: number | null;
    now: Date;
  }): Promise<AnswerTransactionResult> {
    const { userId, sessionId, itemType, itemId, quality } = params;
    const correct = quality >= 2;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const session = await tx.reviewSession.findUnique({
          where: { id: sessionId },
        });

        if (!session || session.userId !== userId) {
          throw new RollbackAnswerError('session_not_found');
        }

        if (session.status !== ReviewSessionStatus.IN_PROGRESS) {
          throw new RollbackAnswerError('session_not_active');
        }

        const progress =
          itemType === SRSItemType.KANJI
            ? await tx.userKanjiProgress.findUnique({
                where: { userId_kanjiId: { userId, kanjiId: itemId } },
              })
            : await tx.userVocabularyProgress.findUnique({
                where: {
                  userId_vocabularyId: { userId, vocabularyId: itemId },
                },
              });

        if (!progress) {
          throw new RollbackAnswerError('progress_not_found');
        }

        const srsResult = this.srs.calculateNextReview(
          progress,
          quality,
          params.now,
        );

        const progressData: Prisma.UserKanjiProgressUpdateInput = {
          srsLevel: srsResult.newSrsLevel,
          easeFactor: srsResult.newEaseFactor,
          intervalDays: srsResult.newIntervalDays,
          nextReviewAt: srsResult.nextReviewAt,
          lastReviewAt: params.now,
          isMastered: srsResult.isMastered,
          masteredAt: srsResult.isMastered
            ? (progress.masteredAt ?? params.now)
            : null,
          totalReviews: { increment: 1 },
          correctReviews: { increment: correct ? 1 : 0 },
        };

        const updatedProgress =
          itemType === SRSItemType.KANJI
            ? await tx.userKanjiProgress.update({
                where: { userId_kanjiId: { userId, kanjiId: itemId } },
                data: progressData,
              })
            : await tx.userVocabularyProgress.update({
                where: {
                  userId_vocabularyId: { userId, vocabularyId: itemId },
                },
                data: progressData,
              });

        const answer = await tx.reviewAnswer.create({
          data: {
            sessionId,
            itemType,
            itemId,
            quality: params.qualityValue,
            responseTimeMs: params.responseTimeMs,
            srsLevelBefore: progress.srsLevel,
            srsLevelAfter: srsResult.newSrsLevel,
            intervalBefore: progress.intervalDays,
            intervalAfter: srsResult.newIntervalDays,
            answeredAt: params.now,
          },
        });

        const updatedSession = await tx.reviewSession.update({
          where: { id: sessionId },
          data: {
            completedItems: { increment: 1 },
            correctItems: { increment: correct ? 1 : 0 },
          },
        });

        return {
          ok: true as const,
          progress: updatedProgress,
          answer,
          session: updatedSession,
        };
      });
    } catch (error) {
      if (error instanceof RollbackAnswerError) {
        return { ok: false, reason: error.reason };
      }
      throw error;
    }
  }

  async completeSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<SessionStateChangeResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.reviewSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        return { ok: false as const, reason: 'session_not_found' as const };
      }

      if (session.status !== ReviewSessionStatus.IN_PROGRESS) {
        return { ok: false as const, reason: 'session_not_active' as const };
      }

      const accuracyRate =
        session.completedItems > 0
          ? session.correctItems / session.completedItems
          : null;
      const durationSeconds = Math.max(
        0,
        Math.floor((now.getTime() - session.startedAt.getTime()) / 1000),
      );

      // Guard atômico: só completa se ainda estiver IN_PROGRESS
      const guarded = await tx.reviewSession.updateMany({
        where: {
          id: sessionId,
          userId,
          status: ReviewSessionStatus.IN_PROGRESS,
        },
        data: {
          status: ReviewSessionStatus.COMPLETED,
          completedAt: now,
          accuracyRate,
          durationSeconds,
        },
      });

      if (guarded.count === 0) {
        return { ok: false as const, reason: 'session_not_active' as const };
      }

      const updated = await tx.reviewSession.findUniqueOrThrow({
        where: { id: sessionId },
      });

      return { ok: true as const, session: updated };
    });
  }

  async abandonSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<SessionStateChangeResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.reviewSession.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.userId !== userId) {
        return { ok: false as const, reason: 'session_not_found' as const };
      }

      if (session.status !== ReviewSessionStatus.IN_PROGRESS) {
        return { ok: false as const, reason: 'session_not_active' as const };
      }

      const guarded = await tx.reviewSession.updateMany({
        where: {
          id: sessionId,
          userId,
          status: ReviewSessionStatus.IN_PROGRESS,
        },
        data: {
          status: ReviewSessionStatus.ABANDONED,
          abandonedAt: now,
        },
      });

      if (guarded.count === 0) {
        return { ok: false as const, reason: 'session_not_active' as const };
      }

      const updated = await tx.reviewSession.findUniqueOrThrow({
        where: { id: sessionId },
      });

      return { ok: true as const, session: updated };
    });
  }

  // ─── Estatísticas ───────────────────────────────────────────────────────────

  async getSessionAnswerStats(sessionId: string): Promise<{
    counts: Partial<Record<ReviewQuality, number>>;
    averageResponseTimeMs: number | null;
    masteredCount: number;
  }> {
    const [groups, aggregate, masteredCount] = await Promise.all([
      this.prisma.reviewAnswer.groupBy({
        by: ['quality'],
        where: { sessionId },
        _count: { _all: true },
      }),
      this.prisma.reviewAnswer.aggregate({
        where: { sessionId, responseTimeMs: { not: null } },
        _avg: { responseTimeMs: true },
      }),
      this.prisma.reviewAnswer.count({
        where: {
          sessionId,
          srsLevelBefore: { lt: 5 },
          srsLevelAfter: { gte: 5 },
        },
      }),
    ]);

    const counts: Partial<Record<ReviewQuality, number>> = {};
    for (const group of groups) {
      counts[group.quality] = group._count._all;
    }

    return {
      counts,
      averageResponseTimeMs: aggregate._avg.responseTimeMs ?? null,
      masteredCount,
    };
  }
}
