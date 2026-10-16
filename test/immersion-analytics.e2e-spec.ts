import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/auth/repositories/prisma.service';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

interface ImmersionLogBody {
  id: string;
  userId: string;
  type: string;
  title: string;
  episode: string | null;
  durationMinutes: number;
  comprehension: number | null;
  isActive: boolean;
  notes: string | null;
  loggedAt: string;
  createdAt: string;
}

interface PaginatedImmersionBody {
  data: ImmersionLogBody[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
}

interface AnalyticsOverviewBody {
  summary: {
    totalKanji: number;
    masteredKanji: number;
    totalVocabulary: number;
    masteredVocabulary: number;
    totalGrammar: number;
    studiedGrammar: number;
    totalReviews: number;
    accuracyRate: number | null;
    totalImmersionMinutes: number;
    currentStreakDays: number;
    longestStreakDays: number;
  };
  studyTimeSeries: Array<{
    date: string;
    kanjiAdded: number;
    vocabularyAdded: number;
    grammarStudied: number;
    kanjiReviewed: number;
    vocabularyReviewed: number;
    immersionMinutes: number;
  }>;
  immersionBreakdown: Array<{ type: string; totalMinutes: number }>;
}

function assertLoginResponse(body: unknown): asserts body is LoginResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    !('user' in body)
  ) {
    throw new Error('Invalid login response body');
  }
}

function assertPaginatedImmersion(
  body: unknown,
): asserts body is PaginatedImmersionBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    !('pagination' in body)
  ) {
    throw new Error('Invalid paginated immersion response body');
  }
}

function assertOverview(body: unknown): asserts body is AnalyticsOverviewBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('summary' in body) ||
    !('studyTimeSeries' in body) ||
    !('immersionBreakdown' in body)
  ) {
    throw new Error('Invalid analytics overview response body');
  }
}

describe('Immersion & Analytics E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let userId = '';
  let otherAccessToken = '';

  const suffix = Date.now().toString(36);
  const email = `immersion-student-${suffix}@example.com`;
  const otherEmail = `immersion-other-${suffix}@example.com`;
  const password = 'SecurePass123';

  const authHeader = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, name: 'Immersion Student' });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    assertLoginResponse(login.body);
    accessToken = login.body.accessToken;
    userId = login.body.user.id;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password, name: 'Immersion Other' });

    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);

    assertLoginResponse(otherLogin.body);
    otherAccessToken = otherLogin.body.accessToken;
  }, 60_000);

  afterAll(async () => {
    await prisma.minedSentence.deleteMany({ where: { userId } });
    await prisma.immersionLog.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });
    await app.close();
  });

  describe('GET /immersion (regressão do 404)', () => {
    it('não responde mais 404 — lista paginada vazia para novo usuário', async () => {
      const response = await request(app.getHttpServer())
        .get('/immersion')
        .set(authHeader(accessToken))
        .query({ page: 1, perPage: 50, sort: 'loggedAt', order: 'desc' })
        .expect(200);

      assertPaginatedImmersion(response.body);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.perPage).toBe(50);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('retorna 401 sem token', async () => {
      await request(app.getHttpServer()).get('/immersion').expect(401);
    });
  });

  describe('POST /immersion', () => {
    it('cria sessão e reflete no total de minutos', async () => {
      const created = await request(app.getHttpServer())
        .post('/immersion')
        .set(authHeader(accessToken))
        .send({
          type: 'ANIME',
          title: 'Shingeki no Kyojin',
          episode: 'EP 01',
          durationMinutes: 25,
          comprehension: 70,
          isActive: true,
        })
        .expect(201);

      const body = created.body as ImmersionLogBody;
      expect(body.id).toEqual(expect.any(String));
      expect(body.durationMinutes).toBe(25);
      expect(body.type).toBe('ANIME');
      expect(body.userId).toBe(userId);

      const list = await request(app.getHttpServer())
        .get('/immersion')
        .set(authHeader(accessToken))
        .expect(200);

      assertPaginatedImmersion(list.body);
      expect(list.body.pagination.total).toBe(1);
    });

    it('rejeita payload inválido com 400', async () => {
      await request(app.getHttpServer())
        .post('/immersion')
        .set(authHeader(accessToken))
        .send({ type: 'ANIME', title: '', durationMinutes: 0 })
        .expect(400);
    });
  });

  describe('GET /immersion/:id + PATCH + DELETE', () => {
    let logId = '';

    beforeAll(async () => {
      const created = await request(app.getHttpServer())
        .post('/immersion')
        .set(authHeader(accessToken))
        .send({ type: 'MANGA', title: 'Berserk', durationMinutes: 40 });
      logId = (created.body as ImmersionLogBody).id;
    });

    it('retorna o log pelo id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/immersion/${logId}`)
        .set(authHeader(accessToken))
        .expect(200);
      expect((response.body as ImmersionLogBody).id).toBe(logId);
    });

    it('atualiza o log', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/immersion/${logId}`)
        .set(authHeader(accessToken))
        .send({ durationMinutes: 55, comprehension: 80 })
        .expect(200);
      const body = response.body as ImmersionLogBody;
      expect(body.durationMinutes).toBe(55);
      expect(body.comprehension).toBe(80);
    });

    it('outro usuário não acessa o log (404)', async () => {
      await request(app.getHttpServer())
        .get(`/immersion/${logId}`)
        .set(authHeader(otherAccessToken))
        .expect(404);
    });

    it('remove o log', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/immersion/${logId}`)
        .set(authHeader(accessToken))
        .expect(200);
      expect(response.body).toEqual({ success: true, id: logId });
    });
  });

  describe('GET /analytics/overview (regressão do 404)', () => {
    it('não responde mais 404 — devolve resumo, série e breakdown', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/overview')
        .set(authHeader(accessToken))
        .query({ period: '30d', granularity: 'day' })
        .expect(200);

      assertOverview(response.body);
      expect(
        response.body.summary.totalImmersionMinutes,
      ).toBeGreaterThanOrEqual(25);
      expect(Array.isArray(response.body.studyTimeSeries)).toBe(true);
      expect(response.body.studyTimeSeries.length).toBe(30);
      expect(
        response.body.immersionBreakdown.some((p) => p.type === 'ANIME'),
      ).toBe(true);
    });

    it('funciona sem query params (defaults)', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/overview')
        .set(authHeader(accessToken))
        .expect(200);

      assertOverview(response.body);
      expect(response.body.studyTimeSeries.length).toBe(30);
    });

    it('rejeita period inválido com 400', async () => {
      await request(app.getHttpServer())
        .get('/analytics/overview')
        .set(authHeader(accessToken))
        .query({ period: '999y' })
        .expect(400);
    });

    it('retorna 401 sem token', async () => {
      await request(app.getHttpServer()).get('/analytics/overview').expect(401);
    });
  });
});
