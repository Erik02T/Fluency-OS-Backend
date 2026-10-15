import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardSummaryService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('DashboardController', () => {
  let app: INestApplication;
  const dashboardSummaryService = {
    getSummary: jest.fn(),
  };

  let jwtGuardError: Error | null = null;
  let authenticatedUserId = 'user-123';

  const summaryResponse = {
    kanjiStudied: 12,
    kanjiMastered: 5,
    dueReviews: 7,
    favoriteKanjis: 2,
    totalReviews: 50,
    accuracyRate: 80,
    currentStreak: 6,
    longestStreak: 15,
    lastReviewAt: '2026-10-05T10:00:00.000Z',
    vocabularyStudied: 30,
    vocabularyMastered: 8,
    grammarStudied: 7,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardSummaryService,
          useValue: dashboardSummaryService,
        },
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
          req.user = { id: authenticatedUserId };
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
    authenticatedUserId = 'user-123';
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  const httpServer = (): Server => app.getHttpServer() as Server;

  it('GET /dashboard/summary retorna a estrutura contratada', async () => {
    dashboardSummaryService.getSummary.mockResolvedValue(summaryResponse);

    const response = await request(httpServer())
      .get('/dashboard/summary')
      .expect(200);

    expect(response.body).toMatchObject({
      kanjiStudied: 12,
      kanjiMastered: 5,
      dueReviews: 7,
      favoriteKanjis: 2,
      totalReviews: 50,
      accuracyRate: 80,
      currentStreak: 6,
      longestStreak: 15,
      lastReviewAt: '2026-10-05T10:00:00.000Z',
      vocabularyStudied: 30,
      vocabularyMastered: 8,
      grammarStudied: 7,
    });

    // Tipos numéricos e booleanos do contrato.
    const body = response.body as Record<string, unknown>;
    for (const field of [
      'kanjiStudied',
      'kanjiMastered',
      'dueReviews',
      'favoriteKanjis',
      'totalReviews',
      'accuracyRate',
      'currentStreak',
      'longestStreak',
      'vocabularyStudied',
      'vocabularyMastered',
      'grammarStudied',
    ]) {
      expect(typeof body[field]).toBe('number');
    }
    expect(typeof body.lastReviewAt).toBe('string');
  });

  it('usa o id do usuário autenticado, ignorando userId de query', async () => {
    dashboardSummaryService.getSummary.mockResolvedValue(summaryResponse);
    authenticatedUserId = 'user-authenticated';

    await request(httpServer())
      .get('/dashboard/summary?userId=user-ajeno')
      .expect(200);

    expect(dashboardSummaryService.getSummary).toHaveBeenCalledWith(
      'user-authenticated',
    );
  });

  it('retorna 401 sem token JWT', async () => {
    jwtGuardError = new UnauthorizedException();

    await request(httpServer()).get('/dashboard/summary').expect(401);

    expect(dashboardSummaryService.getSummary).not.toHaveBeenCalled();
  });

  it('não expõe detalhes internos em erro inesperado', async () => {
    dashboardSummaryService.getSummary.mockRejectedValue(
      new Error('connection string secreta'),
    );

    const response = await request(httpServer())
      .get('/dashboard/summary')
      .expect(500);

    expect(JSON.stringify(response.body)).not.toContain('connection string');
  });
});
