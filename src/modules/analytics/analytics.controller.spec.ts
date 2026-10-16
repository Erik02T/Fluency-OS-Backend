import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('AnalyticsController', () => {
  let app: INestApplication;
  const analyticsService = {
    getOverview: jest.fn(),
  };

  let jwtGuardError: Error | null = null;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        { provide: AnalyticsService, useValue: analyticsService },
        JwtAuthGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn((context: ExecutionContext) => {
          if (jwtGuardError) {
            throw jwtGuardError;
          }
          const req = context
            .switchToHttp()
            .getRequest<{ user?: { id: string } }>();
          req.user = { id: 'user-123' };
          return true;
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    jwtGuardError = null;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  const httpServer = (): Server => app.getHttpServer() as Server;

  const overviewResponse = {
    summary: {
      totalKanji: 10,
      masteredKanji: 4,
      totalVocabulary: 20,
      masteredVocabulary: 8,
      totalGrammar: 100,
      studiedGrammar: 5,
      totalReviews: 50,
      accuracyRate: 82,
      totalImmersionMinutes: 300,
      currentStreakDays: 3,
      longestStreakDays: 7,
    },
    studyTimeSeries: [
      {
        date: '2026-10-10',
        kanjiAdded: 1,
        vocabularyAdded: 2,
        grammarStudied: 0,
        kanjiReviewed: 3,
        vocabularyReviewed: 4,
        immersionMinutes: 25,
      },
    ],
    immersionBreakdown: [{ type: 'ANIME', totalMinutes: 300 }],
  };

  it('GET /analytics/overview repassa period/granularity', async () => {
    analyticsService.getOverview.mockResolvedValue(overviewResponse);

    await request(httpServer())
      .get('/analytics/overview')
      .query({ period: '30d', granularity: 'day' })
      .expect(200)
      .expect((res: { body: { summary: { accuracyRate: number } } }) => {
        expect(res.body.summary.accuracyRate).toBe(82);
      });

    expect(analyticsService.getOverview).toHaveBeenCalledWith('user-123', {
      period: '30d',
      granularity: 'day',
    });
  });

  it('GET /analytics/overview funciona sem query params', async () => {
    analyticsService.getOverview.mockResolvedValue(overviewResponse);

    await request(httpServer()).get('/analytics/overview').expect(200);

    expect(analyticsService.getOverview).toHaveBeenCalledWith('user-123', {});
  });

  it('rejeita period inválido com 400', async () => {
    await request(httpServer())
      .get('/analytics/overview')
      .query({ period: '999y' })
      .expect(400);

    expect(analyticsService.getOverview).not.toHaveBeenCalled();
  });

  it('retorna 401 sem token JWT', async () => {
    jwtGuardError = new UnauthorizedException();
    await request(httpServer()).get('/analytics/overview').expect(401);
  });
});
