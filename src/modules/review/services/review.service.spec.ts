/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method, @typescript-eslint/no-unnecessary-type-assertion */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  JLPTLevel,
  ReadingType,
  ReviewQuality,
  ReviewSessionStatus,
  SRSItemType,
} from '@prisma/client';
import { ReviewService } from './review.service';
import { SRSService } from './srs.service';
import { StreakService } from './streak.service';
import { DailyGoalService } from './daily-goal.service';
import { ReviewEventsService } from './review-events.service';
import {
  ReviewSessionRepository,
  ReviewAnswerRepository,
} from '../repositories';
import { PrismaService } from '../../auth/repositories/prisma.service';

describe('ReviewService', () => {
  let service: ReviewService;
  let sessionRepo: jest.Mocked<ReviewSessionRepository>;
  let answerRepo: jest.Mocked<ReviewAnswerRepository>;
  let prismaService: any;
  let streakService: jest.Mocked<StreakService>;
  let dailyGoalService: jest.Mocked<DailyGoalService>;
  let eventsService: jest.Mocked<ReviewEventsService>;

  const userId = 'user_123';
  const otherUserId = 'user_456';
  const sessionId = 'session_123';
  const kanjiId = 'kanji_123';

  const mockKanji = {
    id: kanjiId,
    character: '日',
    jlptLevel: JLPTLevel.N5,
    strokeCount: 4,
    grade: 1,
    frequency: 1,
    meanings: [{ meaning: 'sol', language: 'pt', position: 0 }],
    readings: [
      { reading: 'ニチ', type: ReadingType.ONYOMI },
      { reading: 'ひ', type: ReadingType.KUNYOMI },
    ],
  };

  const mockProgress = {
    id: 'progress_123',
    userId,
    kanjiId,
    srsLevel: 2,
    easeFactor: 2.5,
    intervalDays: 6,
    nextReviewAt: new Date('2026-08-10T00:00:00.000Z'),
    lastReviewAt: new Date('2026-08-04T00:00:00.000Z'),
    totalReviews: 3,
    correctReviews: 2,
    isMastered: false,
    isFavorite: false,
    isSuspended: false,
    addedAt: new Date('2026-08-01T00:00:00.000Z'),
    masteredAt: null,
    kanji: mockKanji,
  };

  const mockSession = {
    id: sessionId,
    userId,
    status: ReviewSessionStatus.IN_PROGRESS,
    itemType: SRSItemType.KANJI,
    totalItems: 10,
    completedItems: 2,
    correctItems: 2,
    accuracyRate: 100.0,
    durationSeconds: null,
    startedAt: new Date('2026-08-13T12:00:00.000Z'),
    completedAt: null,
    abandonedAt: null,
  };

  beforeEach(async () => {
    const mockSessionRepo = {
      createSession: jest.fn(),
      findById: jest.fn(),
      findByIdWithAnswers: jest.fn(),
      findByIdAndUser: jest.fn(),
      findByIdAndUserWithAnswers: jest.fn(),
      updateSession: jest.fn(),
      findUserHistory: jest.fn(),
      countUserHistory: jest.fn(),
    };

    const mockAnswerRepo = {
      createAnswer: jest.fn(),
      findBySessionId: jest.fn(),
      findBySessionAndItem: jest.fn(),
      countBySessionId: jest.fn(),
    };

    const mockPrisma = {
      userPreferences: {
        findUnique: jest.fn().mockResolvedValue({ srsMaxReviewsPerDay: 50 }),
      },
      userKanjiProgress: {
        findMany: jest.fn().mockResolvedValue([mockProgress]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(mockProgress),
        update: jest.fn().mockResolvedValue(mockProgress),
      },
      userVocabularyProgress: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
      },
      reviewAnswer: {
        create: jest.fn(),
      },
      reviewSession: {
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => {
        return Promise.resolve(callback(mockPrisma));
      }),
    };

    const mockStreakService = {
      recordActivity: jest
        .fn()
        .mockResolvedValue({ currentStreak: 5, longestStreak: 10 }),
    };

    const mockDailyGoalService = {
      recordReviewProgress: jest.fn().mockResolvedValue({
        isCompleted: false,
        completedReviews: 3,
        targetReviews: 50,
      }),
    };

    const mockEventsService = {
      emitKanjiReviewed: jest.fn(),
      emitKanjiMastered: jest.fn(),
      emitSessionCompleted: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        SRSService,
        { provide: ReviewSessionRepository, useValue: mockSessionRepo },
        { provide: ReviewAnswerRepository, useValue: mockAnswerRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StreakService, useValue: mockStreakService },
        { provide: DailyGoalService, useValue: mockDailyGoalService },
        { provide: ReviewEventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
    sessionRepo = module.get(ReviewSessionRepository);
    answerRepo = module.get(ReviewAnswerRepository);
    prismaService = module.get(PrismaService);
    streakService = module.get(StreakService);
    dailyGoalService = module.get(DailyGoalService);
    eventsService = module.get(ReviewEventsService);
  });

  describe('getQueue & getQueueCount', () => {
    it('should return due review items and counts', async () => {
      const queue = await service.getQueue(userId);

      expect(queue.total_due).toBe(1);
      expect(queue.items.length).toBe(1);
      expect(queue.items[0].progress_id).toBe(mockProgress.id);
      expect(queue.items[0].item_type).toBe('kanji');
      expect(queue.items[0].srs_level).toBe(2);
      expect(queue.by_type.kanji).toBe(1);
      expect(queue.by_type.vocabulary).toBe(0);
    });

    it('should return count for user', async () => {
      const count = await service.getQueueCount(userId);
      expect(count.kanji).toBe(1);
      expect(count.vocabulary).toBe(0);
      expect(count.total).toBe(1);
    });
  });

  describe('createSession', () => {
    it('should create a new in-progress review session', async () => {
      sessionRepo.createSession.mockResolvedValue(mockSession as any);

      const res = await service.createSession(userId, {
        session_type: 'kanji',
      });

      expect(res.id).toBe(sessionId);
      expect(res.status).toBe('in_progress');
      expect(sessionRepo.createSession).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('should return session details if owned by user', async () => {
      sessionRepo.findByIdWithAnswers.mockResolvedValue({
        ...mockSession,
        answers: [],
      } as any);

      const res = await service.getSession(sessionId, userId);
      expect(res.id).toBe(sessionId);
      expect(res.user_id).toBe(userId);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      sessionRepo.findByIdWithAnswers.mockResolvedValue(null);

      await expect(service.getSession('nonexistent', userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if session belongs to another user', async () => {
      sessionRepo.findByIdWithAnswers.mockResolvedValue({
        ...mockSession,
        userId: otherUserId,
      } as any);

      await expect(service.getSession(sessionId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('submitAnswer - Atomic Transaction & Integrations', () => {
    it('should process answer, update SRS, insert answer, update session and integrations', async () => {
      sessionRepo.findById.mockResolvedValue(mockSession as any);
      answerRepo.findBySessionAndItem.mockResolvedValue(null);

      const updatedSessionRecord = {
        ...mockSession,
        completedItems: 3,
        correctItems: 3,
        accuracyRate: 100.0,
      };

      prismaService.reviewSession.update.mockResolvedValue(
        updatedSessionRecord,
      );
      prismaService.userKanjiProgress.update.mockResolvedValue({
        ...mockProgress,
        srsLevel: 3,
      });

      const response = await service.submitAnswer(sessionId, userId, {
        item_id: kanjiId,
        item_type: 'kanji',
        answer_quality: 2,
        response_time_ms: 2500,
      });

      expect(response.previous_srs_level).toBe(2);
      expect(response.new_srs_level).toBe(3);
      expect(response.is_mastered).toBe(false);
      expect(response.session_progress.reviewed).toBe(3);
      expect(response.session_progress.correct).toBe(3);
      expect(response.session_progress.incorrect).toBe(0);

      // Verify transaction was called
      expect(prismaService.$transaction).toHaveBeenCalled();
      // Verify streak and daily goal integration
      expect(streakService.recordActivity).toHaveBeenCalledWith(
        userId,
        'kanji',
        undefined,
        expect.anything(),
      );
      expect(dailyGoalService.recordReviewProgress).toHaveBeenCalledWith(
        userId,
        'kanji',
        undefined,
        expect.anything(),
      );
      // Verify events
      expect(eventsService.emitKanjiReviewed).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          kanjiId,
          quality: 2,
          newSrsLevel: 3,
        }),
      );
    });

    it('should reject duplicate answers for the same item in the same session', async () => {
      sessionRepo.findById.mockResolvedValue(mockSession as any);
      answerRepo.findBySessionAndItem.mockResolvedValue({
        id: 'existing_ans',
      } as any);

      await expect(
        service.submitAnswer(sessionId, userId, {
          item_id: kanjiId,
          answer_quality: 2,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject answering in completed or abandoned session', async () => {
      sessionRepo.findById.mockResolvedValue({
        ...mockSession,
        status: ReviewSessionStatus.COMPLETED,
      } as any);

      await expect(
        service.submitAnswer(sessionId, userId, {
          item_id: kanjiId,
          answer_quality: 2,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid answer qualities', async () => {
      await expect(
        service.submitAnswer(sessionId, userId, {
          item_id: kanjiId,
          answer_quality: 5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit KANJI_MASTERED when item advances to level 5', async () => {
      const nearMasteredProgress = {
        ...mockProgress,
        srsLevel: 4,
        isMastered: false,
      };
      prismaService.userKanjiProgress.findUnique.mockResolvedValue(
        nearMasteredProgress,
      );
      sessionRepo.findById.mockResolvedValue(mockSession as any);
      answerRepo.findBySessionAndItem.mockResolvedValue(null);
      prismaService.reviewSession.update.mockResolvedValue(mockSession);

      await service.submitAnswer(sessionId, userId, {
        item_id: kanjiId,
        item_type: 'kanji',
        answer_quality: 3,
      });

      expect(eventsService.emitKanjiMastered).toHaveBeenCalledWith({
        userId,
        kanjiId,
      });
    });
  });

  describe('endSession & abandonSession', () => {
    it('should end session and compute accuracy and duration', async () => {
      sessionRepo.findByIdWithAnswers.mockResolvedValue({
        ...mockSession,
        completedItems: 10,
        correctItems: 9,
        answers: [],
      } as any);

      sessionRepo.updateSession.mockResolvedValue({
        ...mockSession,
        status: ReviewSessionStatus.COMPLETED,
        completedItems: 10,
        correctItems: 9,
        accuracyRate: 90.0,
        durationSeconds: 120,
        completedAt: new Date(),
      } as any);

      const res = await service.endSession(sessionId, userId);

      expect(res.status).toBe('completed');
      expect(res.accuracy_rate).toBe(90.0);
      expect(eventsService.emitSessionCompleted).toHaveBeenCalled();
    });

    it('should abandon session preserving progress', async () => {
      sessionRepo.findByIdWithAnswers.mockResolvedValue({
        ...mockSession,
        completedItems: 4,
        correctItems: 3,
        answers: [],
      } as any);

      sessionRepo.updateSession.mockResolvedValue({
        ...mockSession,
        status: ReviewSessionStatus.ABANDONED,
        completedItems: 4,
        correctItems: 3,
        accuracyRate: 75.0,
        abandonedAt: new Date(),
      } as any);

      const res = await service.abandonSession(sessionId, userId);
      expect(res.status).toBe('abandoned');
      expect(res.reviewed_items).toBe(4);
    });
  });

  describe('getHistory & getStats', () => {
    it('should return paginated history', async () => {
      sessionRepo.findUserHistory.mockResolvedValue([mockSession as any]);
      sessionRepo.countUserHistory.mockResolvedValue(1);

      const res = await service.getHistory(userId, { page: 1, perPage: 20 });
      expect(res.data.length).toBe(1);
      expect(res.pagination.total).toBe(1);
      expect(res.pagination.pages).toBe(1);
    });

    it('should return session stats with quality breakdown and average response time', async () => {
      sessionRepo.findByIdWithAnswers.mockResolvedValue({
        ...mockSession,
        completedItems: 4,
        correctItems: 3,
        accuracyRate: 75.0,
        durationSeconds: 60,
        answers: [
          {
            quality: ReviewQuality.BLACKOUT,
            responseTimeMs: 3000,
            srsLevelBefore: 2,
            srsLevelAfter: 1,
          },
          {
            quality: ReviewQuality.WRONG,
            responseTimeMs: 2000,
            srsLevelBefore: 2,
            srsLevelAfter: 2,
          },
          {
            quality: ReviewQuality.CORRECT_HARD,
            responseTimeMs: 1500,
            srsLevelBefore: 3,
            srsLevelAfter: 4,
          },
          {
            quality: ReviewQuality.CORRECT_EASY,
            responseTimeMs: 1500,
            srsLevelBefore: 4,
            srsLevelAfter: 5,
          },
        ],
      } as any);

      const stats = await service.getStats(sessionId, userId);

      expect(stats.session_id).toBe(sessionId);
      expect(stats.quality_breakdown.blackout).toBe(1);
      expect(stats.quality_breakdown.wrong).toBe(1);
      expect(stats.quality_breakdown.correct_hard).toBe(1);
      expect(stats.quality_breakdown.correct_easy).toBe(1);
      expect(stats.average_response_time_ms).toBe(2000);
      expect(stats.mastered_count).toBe(1); // One item went from 4 to 5
    });
  });
});
