import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ReviewQuality,
  ReviewSessionStatus,
  SRSItemType,
} from '@prisma/client';
import { ReviewService } from './review.service';
import { ReviewRepository } from './repositories';

describe('ReviewService', () => {
  let service: ReviewService;

  const countDueKanjiMock = jest.fn();
  const countDueVocabularyMock = jest.fn();
  const findDueKanjiProgressMock = jest.fn();
  const findDueVocabularyProgressMock = jest.fn();
  const findUserPreferencesMock = jest.fn();
  const createSessionMock = jest.fn();
  const findSessionByIdMock = jest.fn();
  const findSessionWithAnswersMock = jest.fn();
  const answerTransactionMock = jest.fn();
  const completeSessionMock = jest.fn();
  const abandonSessionMock = jest.fn();
  const findSessionsMock = jest.fn();
  const countSessionsMock = jest.fn();
  const getSessionAnswerStatsMock = jest.fn();

  const baseSession = {
    id: 'session-123',
    userId: 'user-123',
    status: ReviewSessionStatus.IN_PROGRESS,
    itemType: SRSItemType.KANJI,
    totalItems: 2,
    completedItems: 0,
    correctItems: 0,
    accuracyRate: null,
    durationSeconds: null,
    startedAt: new Date('2026-01-01T10:00:00Z'),
    completedAt: null,
    abandonedAt: null,
  };

  const dueKanjiProgress = {
    id: 'progress-1',
    userId: 'user-123',
    kanjiId: 'kanji-1',
    srsLevel: 3,
    easeFactor: 2.5,
    intervalDays: 4,
    nextReviewAt: new Date('2026-01-01T09:00:00Z'),
    lastReviewAt: new Date('2025-12-28T10:00:00Z'),
    totalReviews: 5,
    correctReviews: 4,
    isMastered: false,
    isFavorite: false,
    isSuspended: false,
    addedAt: new Date(),
    masteredAt: null,
    kanji: {
      id: 'kanji-1',
      character: '火',
      jlptLevel: 'N5',
      strokeCount: 4,
      grade: 1,
      frequency: 100,
      meanings: [{ meaning: 'fire', isPrimary: true, position: 0 }],
      readings: [
        { reading: 'カ', type: 'ONYOMI', isPrimary: true },
        { reading: 'ひ', type: 'KUNYOMI', isPrimary: true },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        {
          provide: ReviewRepository,
          useValue: {
            countDueKanji: countDueKanjiMock,
            countDueVocabulary: countDueVocabularyMock,
            findDueKanjiProgress: findDueKanjiProgressMock,
            findDueVocabularyProgress: findDueVocabularyProgressMock,
            findUserPreferences: findUserPreferencesMock,
            createSession: createSessionMock,
            findSessionById: findSessionByIdMock,
            findSessionWithAnswers: findSessionWithAnswersMock,
            answerTransaction: answerTransactionMock,
            completeSession: completeSessionMock,
            abandonSession: abandonSessionMock,
            findSessions: findSessionsMock,
            countSessions: countSessionsMock,
            getSessionAnswerStats: getSessionAnswerStatsMock,
          },
        },
      ],
    }).compile();

    service = module.get(ReviewService);
    jest.clearAllMocks();
    findUserPreferencesMock.mockResolvedValue({ srsMaxReviewsPerDay: 200 });
  });

  describe('getQueue', () => {
    it('returns due items with counts and grammar always 0', async () => {
      countDueKanjiMock.mockResolvedValue(1);
      countDueVocabularyMock.mockResolvedValue(0);
      findDueKanjiProgressMock.mockResolvedValue([dueKanjiProgress]);
      findDueVocabularyProgressMock.mockResolvedValue([]);

      const result = await service.getQueue('user-123');

      expect(result.total_due).toBe(1);
      expect(result.by_type).toEqual({
        kanji: 1,
        vocabulary: 0,
        grammar: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        progress_id: 'progress-1',
        item_type: 'kanji',
        srs_level: 3,
        review_count: 5,
      });
      const item = result.items[0].item as { character: string };
      expect(item.character).toBe('火');
    });

    it('returns empty queue when nothing is due', async () => {
      countDueKanjiMock.mockResolvedValue(0);
      countDueVocabularyMock.mockResolvedValue(0);
      findDueKanjiProgressMock.mockResolvedValue([]);
      findDueVocabularyProgressMock.mockResolvedValue([]);

      const result = await service.getQueue('user-123');

      expect(result.items).toEqual([]);
      expect(findDueKanjiProgressMock).toHaveBeenCalledWith(
        'user-123',
        expect.any(Date),
        200,
      );
    });
  });

  describe('getQueueCount', () => {
    it('sums kanji and vocabulary due counts', async () => {
      countDueKanjiMock.mockResolvedValue(7);
      countDueVocabularyMock.mockResolvedValue(5);

      const result = await service.getQueueCount('user-123');

      expect(result).toEqual({ kanji: 7, vocabulary: 5, total: 12 });
    });
  });

  describe('createSession', () => {
    it('creates a kanji session with totalItems = due count', async () => {
      countDueKanjiMock.mockResolvedValue(3);
      countDueVocabularyMock.mockResolvedValue(10);
      createSessionMock.mockResolvedValue({
        ...baseSession,
        totalItems: 3,
      });

      const result = await service.createSession('user-123', {
        session_type: 'kanji',
      });

      expect(createSessionMock).toHaveBeenCalledWith(
        'user-123',
        SRSItemType.KANJI,
        3,
      );
      expect(result.session_type).toBe('kanji');
      expect(result.total_items).toBe(3);
      expect(result.status).toBe('in_progress');
    });

    it('rejects unsupported session_type', async () => {
      await expect(
        service.createSession('user-123', { session_type: 'sentence' }),
      ).rejects.toThrow(BadRequestException);
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it('accepts camelCase alias sessionType', async () => {
      countDueKanjiMock.mockResolvedValue(0);
      countDueVocabularyMock.mockResolvedValue(2);
      createSessionMock.mockResolvedValue({
        ...baseSession,
        itemType: SRSItemType.VOCABULARY,
        totalItems: 2,
      });

      const result = await service.createSession('user-123', {
        sessionType: 'vocabulary',
      });

      expect(createSessionMock).toHaveBeenCalledWith(
        'user-123',
        SRSItemType.VOCABULARY,
        2,
      );
      expect(result.session_type).toBe('vocabulary');
    });

    it('caps totalItems by due count even when limit is higher', async () => {
      countDueKanjiMock.mockResolvedValue(2);
      countDueVocabularyMock.mockResolvedValue(0);
      createSessionMock.mockResolvedValue({
        ...baseSession,
        totalItems: 2,
      });

      await service.createSession('user-123', {
        session_type: 'kanji',
        limit: 50,
      });

      expect(createSessionMock).toHaveBeenCalledWith(
        'user-123',
        SRSItemType.KANJI,
        2,
      );
    });
  });

  describe('getSession', () => {
    it('returns session with answers for owner', async () => {
      findSessionWithAnswersMock.mockResolvedValue({
        ...baseSession,
        answers: [],
      });

      const result = await service.getSession('user-123', 'session-123');

      expect(result.id).toBe('session-123');
      expect(result.answers).toEqual([]);
    });

    it('throws 404 for another user session (IDOR)', async () => {
      findSessionWithAnswersMock.mockResolvedValue({
        ...baseSession,
        userId: 'other-user',
      });

      await expect(
        service.getSession('user-123', 'session-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when session does not exist', async () => {
      findSessionWithAnswersMock.mockResolvedValue(null);

      await expect(service.getSession('user-123', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('submitAnswer', () => {
    it('returns SRS delta and session progress on success', async () => {
      answerTransactionMock.mockResolvedValue({
        ok: true,
        progress: {
          nextReviewAt: new Date('2026-01-05T10:00:00Z'),
          isMastered: false,
        },
        answer: {
          srsLevelBefore: 3,
          srsLevelAfter: 4,
          intervalBefore: 4,
          intervalAfter: 10,
        },
        session: {
          ...baseSession,
          completedItems: 1,
          correctItems: 1,
        },
      });

      const result = await service.submitAnswer('user-123', 'session-123', {
        item_id: 'kanji-1',
        item_type: 'kanji',
        answer_quality: 2,
        response_time_ms: 3000,
      });

      expect(result.previous_srs_level).toBe(3);
      expect(result.new_srs_level).toBe(4);
      expect(result.previous_interval).toBe(4);
      expect(result.new_interval).toBe(10);
      expect(result.is_mastered).toBe(false);
      expect(result.session_progress).toEqual({
        reviewed: 1,
        total: 2,
        correct: 1,
        incorrect: 0,
      });
      expect(answerTransactionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          sessionId: 'session-123',
          itemId: 'kanji-1',
          itemType: SRSItemType.KANJI,
          quality: 2,
          qualityValue: ReviewQuality.CORRECT_HARD,
        }),
      );
    });

    it('rejects missing item_id with 400', async () => {
      await expect(
        service.submitAnswer('user-123', 'session-123', {
          item_type: 'kanji',
          answer_quality: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects missing answer_quality with 400', async () => {
      await expect(
        service.submitAnswer('user-123', 'session-123', {
          item_id: 'kanji-1',
          item_type: 'kanji',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects quality out of range with 400', async () => {
      await expect(
        service.submitAnswer('user-123', 'session-123', {
          item_id: 'kanji-1',
          item_type: 'kanji',
          answer_quality: 4,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 when session does not exist', async () => {
      answerTransactionMock.mockResolvedValue({
        ok: false,
        reason: 'session_not_found',
      });

      await expect(
        service.submitAnswer('user-123', 'missing', {
          item_id: 'kanji-1',
          item_type: 'kanji',
          answer_quality: 2,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when progress does not exist', async () => {
      answerTransactionMock.mockResolvedValue({
        ok: false,
        reason: 'progress_not_found',
      });

      await expect(
        service.submitAnswer('user-123', 'session-123', {
          item_id: 'missing-kanji',
          item_type: 'kanji',
          answer_quality: 2,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 409 when session is not in progress', async () => {
      answerTransactionMock.mockResolvedValue({
        ok: false,
        reason: 'session_not_active',
      });

      await expect(
        service.submitAnswer('user-123', 'session-123', {
          item_id: 'kanji-1',
          item_type: 'kanji',
          answer_quality: 2,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('endSession / abandonSession', () => {
    it('ends an in-progress session', async () => {
      completeSessionMock.mockResolvedValue({
        ok: true,
        session: {
          ...baseSession,
          status: ReviewSessionStatus.COMPLETED,
          completedAt: new Date(),
          accuracyRate: 0.75,
          durationSeconds: 120,
        },
      });

      const result = await service.endSession('user-123', 'session-123');

      expect(result.status).toBe('completed');
      expect(result.accuracy_rate).toBe(0.75);
    });

    it('throws 409 when ending a completed session', async () => {
      completeSessionMock.mockResolvedValue({
        ok: false,
        reason: 'session_not_active',
      });

      await expect(
        service.endSession('user-123', 'session-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 404 when ending a missing session', async () => {
      completeSessionMock.mockResolvedValue({
        ok: false,
        reason: 'session_not_found',
      });

      await expect(service.endSession('user-123', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('abandons an in-progress session preserving progress', async () => {
      abandonSessionMock.mockResolvedValue({
        ok: true,
        session: {
          ...baseSession,
          status: ReviewSessionStatus.ABANDONED,
          abandonedAt: new Date(),
        },
      });

      const result = await service.abandonSession('user-123', 'session-123');

      expect(result.status).toBe('abandoned');
      expect(result.abandoned_at).toBeTruthy();
    });

    it('throws 404 when abandoning a missing session', async () => {
      abandonSessionMock.mockResolvedValue({
        ok: false,
        reason: 'session_not_found',
      });

      await expect(
        service.abandonSession('user-123', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistory', () => {
    it('returns paginated sessions newest first', async () => {
      findSessionsMock.mockResolvedValue([baseSession]);
      countSessionsMock.mockResolvedValue(1);

      const result = await service.getHistory('user-123', {
        page: 1,
        perPage: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        perPage: 20,
        total: 1,
        pages: 1,
      });
      expect(findSessionsMock).toHaveBeenCalledWith(
        'user-123',
        undefined,
        0,
        20,
      );
    });

    it('filters by status', async () => {
      findSessionsMock.mockResolvedValue([]);
      countSessionsMock.mockResolvedValue(0);

      await service.getHistory('user-123', {
        status: 'completed',
      });

      expect(findSessionsMock).toHaveBeenCalledWith(
        'user-123',
        ReviewSessionStatus.COMPLETED,
        0,
        20,
      );
    });

    it('rejects invalid status with 400', async () => {
      await expect(
        service.getHistory('user-123', {
          status: 'archived' as 'completed',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSessionStats', () => {
    it('computes stats from session and answer aggregates', async () => {
      findSessionByIdMock.mockResolvedValue({
        ...baseSession,
        status: ReviewSessionStatus.COMPLETED,
        completedItems: 4,
        correctItems: 3,
        accuracyRate: 0.75,
        durationSeconds: 90,
        completedAt: new Date('2026-01-01T10:01:30Z'),
      });
      getSessionAnswerStatsMock.mockResolvedValue({
        counts: {
          [ReviewQuality.BLACKOUT]: 0,
          [ReviewQuality.WRONG]: 1,
          [ReviewQuality.CORRECT_HARD]: 2,
          [ReviewQuality.CORRECT_EASY]: 1,
        },
        averageResponseTimeMs: 2500,
        masteredCount: 1,
      });

      const result = await service.getSessionStats('user-123', 'session-123');

      expect(result.reviewed_items).toBe(4);
      expect(result.correct_items).toBe(3);
      expect(result.incorrect_items).toBe(1);
      expect(result.accuracy_rate).toBe(0.75);
      expect(result.duration_seconds).toBe(90);
      expect(result.mastered_count).toBe(1);
      expect(result.quality_breakdown).toEqual({
        blackout: 0,
        wrong: 1,
        correct_hard: 2,
        correct_easy: 1,
      });
    });

    it('throws 404 for another user session (IDOR)', async () => {
      findSessionByIdMock.mockResolvedValue({
        ...baseSession,
        userId: 'other-user',
      });

      await expect(
        service.getSessionStats('user-123', 'session-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
