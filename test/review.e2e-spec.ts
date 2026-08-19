import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/auth/repositories/prisma.service';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: Role;
  };
}

interface ReviewQueueResponseBody {
  total_due: number;
  items: Array<{ progress_id: string }>;
  by_type: {
    kanji: number;
    vocabulary: number;
  };
}

interface ReviewQueueCountResponseBody {
  kanji: number;
  vocabulary: number;
  total: number;
}

interface ReviewSessionResponseBody {
  id: string;
  user_id: string;
  status: string;
  session_type: string;
  total_items: number;
  reviewed_items: number;
  correct_items: number;
  incorrect_items: number;
  accuracy_rate?: number | null;
  duration_seconds?: number | null;
}

interface ReviewAnswerResponseBody {
  previous_srs_level: number;
  new_srs_level: number;
  previous_interval: number;
  new_interval: number;
  next_review_at: string;
  is_mastered: boolean;
  session_progress: {
    reviewed: number;
    total: number;
    correct: number;
    incorrect: number;
  };
}

interface ReviewStatsResponseBody {
  session_id: string;
  status: string;
  total_items: number;
  reviewed_items: number;
  correct_items: number;
  incorrect_items: number;
  accuracy_rate: number;
  duration_seconds: number;
  quality_breakdown: {
    blackout: number;
    wrong: number;
    correct_hard: number;
    correct_easy: number;
  };
}

interface PaginatedHistoryResponseBody {
  data: Array<{ id: string }>;
  pagination: {
    page: number;
    perPage: number;
    total: number;
  };
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

function assertReviewQueueResponse(
  body: unknown,
): asserts body is ReviewQueueResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('total_due' in body) ||
    !('items' in body) ||
    !('by_type' in body)
  ) {
    throw new Error('Invalid review queue response body');
  }
}

function assertReviewQueueCountResponse(
  body: unknown,
): asserts body is ReviewQueueCountResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('kanji' in body) ||
    !('vocabulary' in body) ||
    !('total' in body)
  ) {
    throw new Error('Invalid review queue count response body');
  }
}

function assertReviewSessionResponse(
  body: unknown,
): asserts body is ReviewSessionResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('status' in body)
  ) {
    throw new Error('Invalid review session response body');
  }
}

function assertReviewAnswerResponse(
  body: unknown,
): asserts body is ReviewAnswerResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('previous_srs_level' in body) ||
    !('new_srs_level' in body) ||
    !('session_progress' in body)
  ) {
    throw new Error('Invalid review answer response body');
  }
}

function assertReviewStatsResponse(
  body: unknown,
): asserts body is ReviewStatsResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('session_id' in body) ||
    !('quality_breakdown' in body)
  ) {
    throw new Error('Invalid review stats response body');
  }
}

function assertPaginatedHistoryResponse(
  body: unknown,
): asserts body is PaginatedHistoryResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    !('pagination' in body) ||
    !Array.isArray((body as { data?: unknown }).data)
  ) {
    throw new Error('Invalid paginated history response body');
  }
}

describe('Review E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let studentAccessToken = '';
  let studentUserId = '';
  let createdKanjiId = '';
  let createdSessionId = '';

  const studentEmail = `review-student-${Date.now()}@example.com`;
  const password = 'SecurePass123';
  const testCharacter = `R${Date.now().toString(36).slice(-3)}`;

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

    // Cria usuário comum
    await request(app.getHttpServer()).post('/auth/register').send({
      email: studentEmail,
      password,
      name: 'Review Student',
    });

    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);

    assertLoginResponse(studentLogin.body);
    studentAccessToken = studentLogin.body.accessToken;
    studentUserId = studentLogin.body.user.id;
  });

  afterAll(async () => {
    if (createdSessionId) {
      await prisma.reviewAnswer.deleteMany({
        where: { sessionId: createdSessionId },
      });
      await prisma.reviewSession.deleteMany({
        where: { id: createdSessionId },
      });
    }

    if (createdKanjiId) {
      await prisma.userKanjiProgress.deleteMany({
        where: { userId: studentUserId, kanjiId: createdKanjiId },
      });
      await prisma.kanji.deleteMany({ where: { id: createdKanjiId } });
    }

    await prisma.user.deleteMany({
      where: { email: studentEmail },
    });
    await app.close();
  });

  it('cria kanji via admin e adiciona ao progresso do usuário', async () => {
    // Cria kanji via prisma direto (sem depender de admin)
    const kanji = await prisma.kanji.create({
      data: {
        character: testCharacter,
        jlptLevel: 'N5',
        grade: 1,
        strokeCount: 4,
        frequency: 1,
        meanings: {
          create: [{ meaning: 'teste', language: 'pt', isPrimary: true }],
        },
        readings: {
          create: [{ reading: 'テスト', type: 'ONYOMI' }],
        },
      },
    });
    createdKanjiId = kanji.id;

    // Adiciona ao progresso do usuário com nextReviewAt no passado (vencido)
    await prisma.userKanjiProgress.create({
      data: {
        userId: studentUserId,
        kanjiId: kanji.id,
        srsLevel: 2,
        easeFactor: 2.5,
        intervalDays: 6,
        nextReviewAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // vencido
        lastReviewAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        totalReviews: 3,
        correctReviews: 2,
      },
    });
  });

  it('GET /review/queue retorna itens vencidos', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/queue')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    assertReviewQueueResponse(response.body);
    expect(response.body.total_due).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.by_type.kanji).toBeGreaterThanOrEqual(1);
    expect(response.body.by_type.vocabulary).toBeGreaterThanOrEqual(0);
  });

  it('GET /review/queue/count retorna contagem', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/queue/count')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    assertReviewQueueCountResponse(response.body);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.kanji).toBeGreaterThanOrEqual(1);
  });

  it('POST /review/sessions cria sessão in_progress', async () => {
    const response = await request(app.getHttpServer())
      .post('/review/sessions')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({ session_type: 'kanji' })
      .expect(201);

    assertReviewSessionResponse(response.body);
    expect(response.body.status).toBe('in_progress');
    expect(response.body.session_type).toBe('kanji');
    expect(response.body.reviewed_items).toBe(0);
    expect(response.body.correct_items).toBe(0);
    expect(response.body.incorrect_items).toBe(0);

    createdSessionId = response.body.id;
  });

  it('GET /review/sessions/:id retorna sessão', async () => {
    const response = await request(app.getHttpServer())
      .get(`/review/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    assertReviewSessionResponse(response.body);
    expect(response.body.id).toBe(createdSessionId);
    expect(response.body.user_id).toBe(studentUserId);
    expect(response.body.status).toBe('in_progress');
  });

  it('POST /review/sessions/:id/answer registra resposta e atualiza SRS', async () => {
    const response = await request(app.getHttpServer())
      .post(`/review/sessions/${createdSessionId}/answer`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({
        item_id: createdKanjiId,
        item_type: 'kanji',
        answer_quality: 2,
        response_time_ms: 2500,
      })
      .expect(200);

    assertReviewAnswerResponse(response.body);
    expect(response.body.previous_srs_level).toBe(2);
    expect(response.body.new_srs_level).toBe(3);
    expect(response.body.session_progress.reviewed).toBe(1);
    expect(response.body.session_progress.correct).toBe(1);
    expect(response.body.session_progress.incorrect).toBe(0);
  });

  it('POST /review/sessions/:id/answer rejeita resposta duplicada', async () => {
    await request(app.getHttpServer())
      .post(`/review/sessions/${createdSessionId}/answer`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({
        item_id: createdKanjiId,
        item_type: 'kanji',
        answer_quality: 3,
      })
      .expect(409);
  });

  it('POST /review/sessions/:id/end finaliza sessão', async () => {
    const response = await request(app.getHttpServer())
      .post(`/review/sessions/${createdSessionId}/end`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    assertReviewSessionResponse(response.body);
    expect(response.body.id).toBe(createdSessionId);
    expect(response.body.status).toBe('completed');
    expect(response.body.accuracy_rate).toBeDefined();
    expect(response.body.duration_seconds).toBeDefined();
  });

  it('GET /review/sessions/:id/stats retorna estatísticas', async () => {
    const response = await request(app.getHttpServer())
      .get(`/review/sessions/${createdSessionId}/stats`)
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    assertReviewStatsResponse(response.body);
    expect(response.body.session_id).toBe(createdSessionId);
    expect(response.body.status).toBe('completed');
    expect(response.body.reviewed_items).toBe(1);
    expect(response.body.correct_items).toBe(1);
    expect(response.body.incorrect_items).toBe(0);
    expect(response.body.quality_breakdown.correct_hard).toBe(1);
  });

  it('GET /review/sessions/history retorna histórico paginado', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/sessions/history?page=1&perPage=20')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    assertPaginatedHistoryResponse(response.body);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      perPage: 20,
    });
    expect(response.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('bloqueia acesso sem autenticação', async () => {
    await request(app.getHttpServer()).get('/review/queue').expect(401);
    await request(app.getHttpServer()).get('/review/queue/count').expect(401);
    await request(app.getHttpServer()).post('/review/sessions').expect(401);
    await request(app.getHttpServer())
      .get(`/review/sessions/${createdSessionId}`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/review/sessions/${createdSessionId}/answer`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/review/sessions/${createdSessionId}/end`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/review/sessions/history')
      .expect(401);
    await request(app.getHttpServer())
      .get(`/review/sessions/${createdSessionId}/stats`)
      .expect(401);
  });

  it('bloqueia acesso a sessão de outro usuário', async () => {
    // Cria segundo usuário
    const otherEmail = `review-other-${Date.now()}@example.com`;
    await request(app.getHttpServer()).post('/auth/register').send({
      email: otherEmail,
      password,
      name: 'Other User',
    });

    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);

    assertLoginResponse(otherLogin.body);
    const otherToken = otherLogin.body.accessToken;

    // Tenta acessar sessão do primeiro usuário
    await request(app.getHttpServer())
      .get(`/review/sessions/${createdSessionId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/review/sessions/${createdSessionId}/answer`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        item_id: createdKanjiId,
        item_type: 'kanji',
        answer_quality: 2,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/review/sessions/${createdSessionId}/end`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/review/sessions/${createdSessionId}/stats`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  it('retorna 404 para sessão inexistente', async () => {
    await request(app.getHttpServer())
      .get('/review/sessions/sessao-inexistente')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(404);
  });
});
