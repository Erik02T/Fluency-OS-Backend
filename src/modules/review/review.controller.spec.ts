import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('ReviewController', () => {
  let app: INestApplication;
  const reviewService = {
    getQueue: jest.fn(),
    getQueueCount: jest.fn(),
    createSession: jest.fn(),
    getSession: jest.fn(),
    submitAnswer: jest.fn(),
    endSession: jest.fn(),
    abandonSession: jest.fn(),
    getHistory: jest.fn(),
    getSessionStats: jest.fn(),
  };

  let jwtGuardError: Error | null = null;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [
        {
          provide: ReviewService,
          useValue: reviewService,
        },
        JwtAuthGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        // Emula JwtAuthGuard real: autoriza + popula req.user (via strategy)
        canActivate: jest.fn((context: ExecutionContext) => {
          if (jwtGuardError) {
            throw jwtGuardError;
          }

          const request = context.switchToHttp().getRequest<{
            user?: { id: string };
          }>();
          request.user = { id: 'user-123' };

          return true;
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtGuardError = null;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  const httpServer = (): Server => app.getHttpServer() as Server;

  const queueResponse = {
    total_due: 1,
    items: [],
    by_type: { kanji: 1, vocabulary: 0, grammar: 0 },
  };

  const sessionResponse = {
    id: 'session-123',
    user_id: 'user-123',
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
  };

  it('should return review queue for authenticated user', async () => {
    reviewService.getQueue.mockResolvedValue(queueResponse);

    await request(httpServer())
      .get('/review/queue')
      .expect(200)
      .expect((response: { body: { total_due: number } }) => {
        expect(response.body.total_due).toBe(1);
      });
  });

  it('should return queue count for authenticated user', async () => {
    reviewService.getQueueCount.mockResolvedValue({
      kanji: 7,
      vocabulary: 5,
      total: 12,
    });

    await request(httpServer())
      .get('/review/queue/count')
      .expect(200)
      .expect((response: { body: { total: number } }) => {
        expect(response.body.total).toBe(12);
      });
  });

  it('should create a session with 201', async () => {
    reviewService.createSession.mockResolvedValue(sessionResponse);

    await request(httpServer())
      .post('/review/sessions')
      .send({ session_type: 'kanji' })
      .expect(201)
      .expect((response: { body: { id: string } }) => {
        expect(response.body.id).toBe('session-123');
      });
  });

  it('should return session detail with answers', async () => {
    reviewService.getSession.mockResolvedValue({
      ...sessionResponse,
      answers: [],
    });

    await request(httpServer())
      .get('/review/sessions/session-123')
      .expect(200)
      .expect((response: { body: { id: string } }) => {
        expect(response.body.id).toBe('session-123');
      });
  });

  it('should route history before :id and return paginated sessions', async () => {
    reviewService.getHistory.mockResolvedValue({
      data: [],
      pagination: { page: 1, perPage: 20, total: 0, pages: 0 },
    });

    await request(httpServer())
      .get('/review/sessions/history?page=1&perPage=20')
      .expect(200)
      .expect((response: { body: { data: unknown[] } }) => {
        expect(response.body.data).toEqual([]);
      });

    expect(reviewService.getHistory).toHaveBeenCalled();
    expect(reviewService.getSession).not.toHaveBeenCalled();
  });

  it('should submit an answer and return SRS delta', async () => {
    reviewService.submitAnswer.mockResolvedValue({
      previous_srs_level: 2,
      new_srs_level: 3,
      previous_interval: 4,
      new_interval: 10,
      next_review_at: new Date().toISOString(),
      is_mastered: false,
      session_progress: { reviewed: 1, total: 1, correct: 1, incorrect: 0 },
    });

    await request(httpServer())
      .post('/review/sessions/session-123/answer')
      .send({
        item_id: 'kanji-1',
        item_type: 'kanji',
        answer_quality: 2,
        response_time_ms: 3000,
      })
      .expect(200)
      .expect((response: { body: { new_srs_level: number } }) => {
        expect(response.body.new_srs_level).toBe(3);
      });
  });

  it('should reject out-of-range quality with 400', async () => {
    await request(httpServer())
      .post('/review/sessions/session-123/answer')
      .send({
        item_id: 'kanji-1',
        item_type: 'kanji',
        answer_quality: 9,
      })
      .expect(400);

    expect(reviewService.submitAnswer).not.toHaveBeenCalled();
  });

  it('should end a session', async () => {
    reviewService.endSession.mockResolvedValue({
      ...sessionResponse,
      status: 'completed',
    });

    await request(httpServer())
      .post('/review/sessions/session-123/end')
      .expect(200)
      .expect((response: { body: { status: string } }) => {
        expect(response.body.status).toBe('completed');
      });
  });

  it('should return 409 when ending a finished session', async () => {
    reviewService.endSession.mockRejectedValue(
      new ConflictException(
        'Review session with id session-123 is not in progress',
      ),
    );

    await request(httpServer())
      .post('/review/sessions/session-123/end')
      .expect(409);
  });

  it('should abandon a session preserving progress', async () => {
    reviewService.abandonSession.mockResolvedValue({
      ...sessionResponse,
      status: 'abandoned',
    });

    await request(httpServer())
      .post('/review/sessions/session-123/abandon')
      .expect(200)
      .expect((response: { body: { status: string } }) => {
        expect(response.body.status).toBe('abandoned');
      });
  });

  it('should return session stats', async () => {
    reviewService.getSessionStats.mockResolvedValue({
      session_id: 'session-123',
      status: 'completed',
      session_type: 'kanji',
      total_items: 4,
      reviewed_items: 4,
      correct_items: 3,
      incorrect_items: 1,
      accuracy_rate: 0.75,
      duration_seconds: 90,
      average_response_time_ms: 2500,
      mastered_count: 1,
      quality_breakdown: {
        blackout: 0,
        wrong: 1,
        correct_hard: 2,
        correct_easy: 1,
      },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    await request(httpServer())
      .get('/review/sessions/session-123/stats')
      .expect(200)
      .expect((response: { body: { session_id: string } }) => {
        expect(response.body.session_id).toBe('session-123');
      });
  });

  it('should return 404 when session is missing', async () => {
    reviewService.getSession.mockRejectedValue(
      new NotFoundException('Review session with id missing not found'),
    );

    await request(httpServer()).get('/review/sessions/missing').expect(404);
  });

  it('should return 401 without jwt access', async () => {
    jwtGuardError = new UnauthorizedException();

    await request(httpServer()).get('/review/queue').expect(401);
  });
});
