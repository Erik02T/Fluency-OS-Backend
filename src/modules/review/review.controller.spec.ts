/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewController } from './review.controller';
import { ReviewService } from './services/review.service';

describe('ReviewController', () => {
  let controller: ReviewController;
  let service: jest.Mocked<ReviewService>;

  const mockUser = {
    id: 'user_123',
    email: 'test@example.com',
    role: 'STUDENT',
  };

  const mockReq: any = {
    user: mockUser,
  };

  beforeEach(async () => {
    const mockReviewService = {
      getQueue: jest.fn().mockResolvedValue({
        total_due: 1,
        items: [],
        by_type: { kanji: 1, vocabulary: 0 },
      }),
      getQueueCount: jest.fn().mockResolvedValue({
        kanji: 1,
        vocabulary: 0,
        total: 1,
      }),
      createSession: jest.fn().mockResolvedValue({
        id: 'session_123',
        user_id: 'user_123',
        session_type: 'kanji',
        status: 'in_progress',
        total_items: 1,
        reviewed_items: 0,
        correct_items: 0,
        incorrect_items: 0,
        accuracy_rate: null,
        duration_seconds: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      }),
      getSession: jest.fn().mockResolvedValue({
        id: 'session_123',
        user_id: 'user_123',
        status: 'in_progress',
      }),
      submitAnswer: jest.fn().mockResolvedValue({
        previous_srs_level: 2,
        new_srs_level: 3,
        previous_interval: 6,
        new_interval: 15,
        next_review_at: new Date().toISOString(),
        is_mastered: false,
        session_progress: {
          reviewed: 1,
          total: 1,
          correct: 1,
          incorrect: 0,
        },
      }),
      endSession: jest.fn().mockResolvedValue({
        id: 'session_123',
        status: 'completed',
      }),
      abandonSession: jest.fn().mockResolvedValue({
        id: 'session_123',
        status: 'abandoned',
      }),
      getHistory: jest.fn().mockResolvedValue({
        data: [],
        pagination: { page: 1, perPage: 20, total: 0, pages: 0 },
      }),
      getStats: jest.fn().mockResolvedValue({
        session_id: 'session_123',
        status: 'completed',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: mockReviewService }],
    }).compile();

    controller = module.get<ReviewController>(ReviewController);
    service = module.get(ReviewService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should get review queue', async () => {
    const res = await controller.getQueue(mockReq);
    expect(service.getQueue).toHaveBeenCalledWith('user_123');
    expect(res.total_due).toBe(1);
  });

  it('should get queue count', async () => {
    const res = await controller.getQueueCount(mockReq);
    expect(service.getQueueCount).toHaveBeenCalledWith('user_123');
    expect(res.total).toBe(1);
  });

  it('should create session', async () => {
    const res = await controller.createSession(
      { session_type: 'kanji' },
      mockReq,
    );
    expect(service.createSession).toHaveBeenCalledWith('user_123', {
      session_type: 'kanji',
    });
    expect(res.id).toBe('session_123');
  });

  it('should get session by id', async () => {
    const res = await controller.getSession('session_123', mockReq);
    expect(service.getSession).toHaveBeenCalledWith('session_123', 'user_123');
    expect(res.id).toBe('session_123');
  });

  it('should submit answer', async () => {
    const res = await controller.submitAnswer(
      'session_123',
      { item_id: 'kanji_123', answer_quality: 2 },
      mockReq,
    );
    expect(service.submitAnswer).toHaveBeenCalledWith(
      'session_123',
      'user_123',
      { item_id: 'kanji_123', answer_quality: 2 },
    );
    expect(res.new_srs_level).toBe(3);
  });

  it('should end session', async () => {
    const res = await controller.endSession('session_123', mockReq);
    expect(service.endSession).toHaveBeenCalledWith('session_123', 'user_123');
    expect(res.status).toBe('completed');
  });

  it('should abandon session', async () => {
    const res = await controller.abandonSession('session_123', mockReq);
    expect(service.abandonSession).toHaveBeenCalledWith(
      'session_123',
      'user_123',
    );
    expect(res.status).toBe('abandoned');
  });

  it('should get history', async () => {
    const res = await controller.getHistory({ page: 1, perPage: 20 }, mockReq);
    expect(service.getHistory).toHaveBeenCalledWith('user_123', {
      page: 1,
      perPage: 20,
    });
    expect(res.data).toBeDefined();
  });

  it('should get session stats', async () => {
    const res = await controller.getStats('session_123', mockReq);
    expect(service.getStats).toHaveBeenCalledWith('session_123', 'user_123');
    expect(res.session_id).toBe('session_123');
  });
});
