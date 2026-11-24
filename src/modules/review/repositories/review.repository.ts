import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ReviewQuality,
  ReviewSession,
  ReviewSessionStatus,
  SRSItemType,
  UserKanjiProgress,
  UserVocabularyProgress,
} from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { SrsService, SRSQuality } from '../srs.service';
import type { ReviewSessionTypeValue } from '../dto/review-session.dto';
import type {
  ReviewAnswerResponseDto,
  ReviewQueueItemDto,
} from '../dto/review-response.dto';

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
      response: ReviewAnswerResponseDto;
    }
  | {
      ok: false;
      reason:
        | 'session_not_found'
        | 'session_not_active'
        | 'progress_not_found'
        | 'card_not_in_session'
        | 'answer_conflict';
    };

export type SessionStateChangeResult =
  | { ok: true; session: ReviewSession }
  | { ok: false; reason: 'session_not_found' | 'session_not_active' };

@Injectable()
export class ReviewRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly srs: SrsService,
  ) {}

  // ─── Fila de revisão ────────────────────────────────────────────────────────

  async enqueue(
    userId: string,
    itemType: ReviewSessionTypeValue,
    itemId: string,
    now: Date,
  ): Promise<'queued' | 'missing' | 'suspended'> {
    return this.prisma.$transaction(async (tx) => {
      const id = { id: itemId };
      const select = { id: true } as const;
      const item =
        itemType === 'kanji'
          ? await tx.kanji.findUnique({ where: id, select })
          : await tx.vocabulary.findUnique({ where: id, select });
      if (!item) return 'missing';

      const due = { nextReviewAt: now };
      const eligible = { userId, isSuspended: false };
      const future = { nextReviewAt: { gt: now } };

      if (itemType === 'kanji') {
        const kanjiId = item.id;
        await tx.userKanjiProgress.createMany({
          data: { userId, kanjiId, srsLevel: 0, ...due },
          skipDuplicates: true,
        });
        const where = { ...eligible, kanjiId };
        await tx.userKanjiProgress.updateMany({
          where: { ...where, ...future },
          data: due,
        });
        return (await tx.userKanjiProgress.count({ where })) > 0
          ? 'queued'
          : 'suspended';
      }

      const vocabularyId = item.id;
      await tx.userVocabularyProgress.createMany({
        data: { userId, vocabularyId, srsLevel: 1, ...due },
        skipDuplicates: true,
      });
      const where = { ...eligible, vocabularyId };
      await tx.userVocabularyProgress.updateMany({
        where: { ...where, ...future },
        data: due,
      });
      return (await tx.userVocabularyProgress.count({ where })) > 0
        ? 'queued'
        : 'suspended';
    });
  }

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
      orderBy: [{ nextReviewAt: 'asc' }, { srsLevel: 'asc' }, { id: 'asc' }],
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
      orderBy: [{ nextReviewAt: 'asc' }, { srsLevel: 'asc' }, { id: 'asc' }],
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
    cards: ReviewQueueItemDto[],
  ): Promise<ReviewSession> {
    return this.prisma.reviewSession.create({
      data: {
        userId,
        itemType,
        totalItems: cards.length,
        cards: cards as unknown as Prisma.InputJsonValue,
      },
    });
  }

  findSessionWithAnswers(sessionId: string, userId: string) {
    return this.prisma.$transaction(
      (tx) =>
        tx.reviewSession.findUnique({
          where: { id: sessionId, userId },
          include: {
            answers: { orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }] },
          },
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
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

    return this.prisma.$transaction(
      async (tx): Promise<AnswerTransactionResult> => {
        const session = await this.lockSession(tx, userId, sessionId);

        if (!session) {
          return { ok: false, reason: 'session_not_found' };
        }

        const previous = await tx.reviewAnswer.findUnique({
          where: { sessionId_itemType_itemId: { sessionId, itemType, itemId } },
        });
        if (previous) {
          if (previous.quality !== params.qualityValue || !previous.response) {
            return { ok: false, reason: 'answer_conflict' };
          }
          return {
            ok: true,
            response: previous.response as unknown as ReviewAnswerResponseDto,
          };
        }

        if (session.status !== ReviewSessionStatus.IN_PROGRESS) {
          return { ok: false, reason: 'session_not_active' };
        }
        const cards = session.cards as unknown as ReviewQueueItemDto[];
        if (
          session.itemType !== itemType ||
          !cards.some((card) => card.item.id === itemId)
        ) {
          return { ok: false, reason: 'card_not_in_session' };
        }

        if (itemType === SRSItemType.KANJI) {
          await tx.$queryRaw`SELECT "id" FROM "user_kanji_progress"
            WHERE "userId" = ${userId} AND "kanjiId" = ${itemId} FOR UPDATE`;
        } else {
          await tx.$queryRaw`SELECT "id" FROM "user_vocabulary_progress"
            WHERE "userId" = ${userId} AND "vocabularyId" = ${itemId} FOR UPDATE`;
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
          return { ok: false, reason: 'progress_not_found' };
        }

        const answeredAt = new Date(
          Math.max(params.now.getTime(), progress.lastReviewAt?.getTime() ?? 0),
        );
        const srsResult = this.srs.calculateNextReview(
          progress,
          quality,
          answeredAt,
        );

        const progressData: Prisma.UserKanjiProgressUpdateInput = {
          srsLevel: srsResult.newSrsLevel,
          easeFactor: srsResult.newEaseFactor,
          intervalDays: srsResult.newIntervalDays,
          nextReviewAt: srsResult.nextReviewAt,
          lastReviewAt: answeredAt,
          isMastered: srsResult.isMastered,
          masteredAt: srsResult.isMastered
            ? (progress.masteredAt ?? answeredAt)
            : null,
          totalReviews: { increment: 1 },
          correctReviews: { increment: correct ? 1 : 0 },
        };

        if (itemType === SRSItemType.KANJI) {
          await tx.userKanjiProgress.update({
            where: { userId_kanjiId: { userId, kanjiId: itemId } },
            data: progressData,
          });
        } else {
          await tx.userVocabularyProgress.update({
            where: { userId_vocabularyId: { userId, vocabularyId: itemId } },
            data: progressData,
          });
        }

        const reviewed = session.completedItems + 1;
        const correctItems = session.correctItems + Number(correct);
        const response = {
          previous_srs_level: progress.srsLevel,
          new_srs_level: srsResult.newSrsLevel,
          previous_interval: progress.intervalDays,
          new_interval: srsResult.newIntervalDays,
          next_review_at: srsResult.nextReviewAt.toISOString(),
          is_mastered: srsResult.isMastered,
          session_progress: {
            reviewed,
            total: session.totalItems,
            correct: correctItems,
            incorrect: reviewed - correctItems,
          },
        } satisfies ReviewAnswerResponseDto;
        await tx.reviewAnswer.create({
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
            response,
            answeredAt,
          },
        });

        await tx.reviewSession.update({
          where: { id: sessionId },
          data: {
            completedItems: reviewed,
            correctItems,
          },
        });

        return { ok: true, response };
      },
    );
  }

  private async lockSession(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
  ): Promise<ReviewSession | null> {
    const [session] = await tx.$queryRaw<ReviewSession[]>`SELECT *
      FROM "review_sessions"
      WHERE "id" = ${sessionId} AND "userId" = ${userId} FOR UPDATE`;
    return session ?? null;
  }

  async completeSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<SessionStateChangeResult> {
    return this.closeSession(userId, sessionId, now, 'COMPLETED');
  }

  async abandonSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<SessionStateChangeResult> {
    return this.closeSession(userId, sessionId, now, 'ABANDONED');
  }

  private async closeSession(
    userId: string,
    sessionId: string,
    now: Date,
    status: 'COMPLETED' | 'ABANDONED',
  ): Promise<SessionStateChangeResult> {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, userId, sessionId);
      if (!session) {
        return { ok: false as const, reason: 'session_not_found' as const };
      }
      if (session.status === 'COMPLETED' && status === 'COMPLETED') {
        return { ok: true as const, session };
      }
      if (session.status !== ReviewSessionStatus.IN_PROGRESS) {
        return { ok: false as const, reason: 'session_not_active' as const };
      }

      const groups = await tx.reviewAnswer.groupBy({
        by: ['quality'],
        where: { sessionId, itemType: session.itemType },
        _count: { _all: true },
      });
      const completedItems = groups.reduce(
        (sum, group) => sum + group._count._all,
        0,
      );
      const correctItems = groups
        .filter(
          ({ quality }) =>
            quality === 'CORRECT_HARD' || quality === 'CORRECT_EASY',
        )
        .reduce((sum, group) => sum + group._count._all, 0);
      const latestAnswer = await tx.reviewAnswer.findFirst({
        where: { sessionId },
        orderBy: { answeredAt: 'desc' },
        select: { answeredAt: true },
      });
      const closedAt = new Date(
        Math.max(now.getTime(), latestAnswer?.answeredAt.getTime() ?? 0),
      );
      const updated = await tx.reviewSession.update({
        where: { id: sessionId },
        data: {
          status,
          completedItems,
          correctItems,
          ...(status === 'COMPLETED'
            ? {
                completedAt: closedAt,
                accuracyRate: completedItems
                  ? correctItems / completedItems
                  : null,
                durationSeconds: Math.max(
                  0,
                  Math.floor(
                    (closedAt.getTime() - session.startedAt.getTime()) / 1000,
                  ),
                ),
              }
            : { abandonedAt: closedAt }),
        },
      });

      return { ok: true as const, session: updated };
    });
  }
}
