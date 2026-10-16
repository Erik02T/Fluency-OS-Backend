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

interface ReviewQueueResponseBody {
  total_due: number;
  items: Array<{
    progress_id: string;
    item_type: string;
    item: { id: string; character?: string; word?: string };
    srs_level: number;
    last_reviewed_at: string | null;
    next_review_at: string;
    review_count: number;
  }>;
  by_type: { kanji: number; vocabulary: number; grammar: number };
}

interface ReviewSessionResponseBody {
  id: string;
  user_id: string;
  session_type: string;
  status: string;
  total_items: number;
  reviewed_items: number;
  correct_items: number;
  incorrect_items: number;
  accuracy_rate: number | null;
  duration_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  answers?: Array<{
    id: string;
    item_type: string;
    item_id: string;
    quality: number;
    quality_name: string;
    srs_level_before: number;
    srs_level_after: number;
  }>;
}

interface ReviewStatsResponseBody {
  session_id: string;
  status: string;
  reviewed_items: number;
  correct_items: number;
  accuracy_rate: number;
  quality_breakdown: {
    blackout: number;
    wrong: number;
    correct_hard: number;
    correct_easy: number;
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

function assertQueueBody(
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

function assertSessionBody(
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

function assertStatsBody(
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

interface ReviewAnswerResponseBody {
  previous_srs_level: number;
  new_srs_level: number;
  previous_interval: number;
  new_interval: number;
  is_mastered: boolean;
  session_progress: {
    reviewed: number;
    total: number;
    correct: number;
    incorrect: number;
  };
}

function assertAnswerBody(
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

interface ReviewHistoryResponseBody {
  data: Array<{ status: string }>;
  pagination: { page: number; perPage: number; total: number; pages: number };
}

function assertHistoryBody(
  body: unknown,
): asserts body is ReviewHistoryResponseBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    !('pagination' in body) ||
    !Array.isArray((body as { data?: unknown }).data)
  ) {
    throw new Error('Invalid review history response body');
  }
}

describe('Review E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let userId = '';
  let otherAccessToken = '';
  let kanjiId = '';
  let vocabId = '';
  let suspendedKanjiId = '';
  let futureVocabId = '';

  const email = `review-student-${Date.now()}@example.com`;
  const otherEmail = `review-other-${Date.now()}@example.com`;
  const password = 'SecurePass123';
  const uniqueSuffix = Date.now().toString(36);

  const dueDate = new Date(Date.now() - 60 * 60 * 1000);
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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

    await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password,
      name: 'Review Student',
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    assertLoginResponse(login.body);
    accessToken = login.body.accessToken;
    userId = login.body.user.id;

    await request(app.getHttpServer()).post('/auth/register').send({
      email: otherEmail,
      password,
      name: 'Review Other',
    });

    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);

    assertLoginResponse(otherLogin.body);
    otherAccessToken = otherLogin.body.accessToken;

    const kanji = await prisma.kanji.create({
      data: {
        character: `火-${uniqueSuffix}`.slice(0, 4),
        jlptLevel: 'N5',
        meanings: { create: [{ meaning: `fogo ${uniqueSuffix}` }] },
        readings: {
          create: [
            { reading: 'カ', type: 'ONYOMI' },
            { reading: 'ひ', type: 'KUNYOMI' },
          ],
        },
      },
    });
    kanjiId = kanji.id;

    // Progresso kanji vencido (srsLevel 3, ease 2.5, interval 4)
    await prisma.userKanjiProgress.create({
      data: {
        userId,
        kanjiId,
        srsLevel: 3,
        easeFactor: 2.5,
        intervalDays: 4,
        nextReviewAt: dueDate,
        totalReviews: 5,
        correctReviews: 4,
      },
    });

    const suspendedKanji = await prisma.kanji.create({
      data: {
        character: `水-${uniqueSuffix}`.slice(0, 4),
        jlptLevel: 'N5',
        meanings: { create: [{ meaning: `água ${uniqueSuffix}` }] },
        readings: { create: [{ reading: 'スイ', type: 'ONYOMI' }] },
      },
    });
    suspendedKanjiId = suspendedKanji.id;

    // Kanji suspenso — NÃO entra na fila
    await prisma.userKanjiProgress.create({
      data: {
        userId,
        kanjiId: suspendedKanjiId,
        srsLevel: 1,
        nextReviewAt: dueDate,
        isSuspended: true,
      },
    });

    // Vocabulário vencido (srsLevel 2, ease 2.5, interval 2)
    const vocabulary = await prisma.vocabulary.create({
      data: {
        word: `食べる-${uniqueSuffix}`.slice(0, 20),
        reading: 'たべる',
        jlptLevel: 'N5',
        partOfSpeech: 'verb',
        meanings: {
          create: [{ meaning: `comer ${uniqueSuffix}`, isPrimary: true }],
        },
      },
    });
    vocabId = vocabulary.id;

    await prisma.userVocabularyProgress.create({
      data: {
        userId,
        vocabularyId: vocabId,
        srsLevel: 2,
        easeFactor: 2.5,
        intervalDays: 2,
        nextReviewAt: dueDate,
        totalReviews: 2,
        correctReviews: 1,
      },
    });

    // Vocabulário futuro — NÃO entra na fila
    const futureVocab = await prisma.vocabulary.create({
      data: {
        word: `飲む-${uniqueSuffix}`.slice(0, 20),
        reading: 'のむ',
        jlptLevel: 'N5',
        meanings: {
          create: [{ meaning: `beber ${uniqueSuffix}`, isPrimary: true }],
        },
      },
    });
    futureVocabId = futureVocab.id;

    await prisma.userVocabularyProgress.create({
      data: {
        userId,
        vocabularyId: futureVocabId,
        srsLevel: 1,
        nextReviewAt: futureDate,
      },
    });
  });

  afterAll(async () => {
    const sessionIds = await prisma.reviewSession.findMany({
      where: { userId },
      select: { id: true },
    });
    await prisma.reviewAnswer.deleteMany({
      where: { sessionId: { in: sessionIds.map((s) => s.id) } },
    });
    await prisma.reviewSession.deleteMany({ where: { userId } });
    await prisma.userKanjiProgress.deleteMany({ where: { userId } });
    await prisma.userVocabularyProgress.deleteMany({ where: { userId } });
    await prisma.kanji.deleteMany({
      where: { id: { in: [kanjiId, suspendedKanjiId] } },
    });
    await prisma.vocabulary.deleteMany({
      where: { id: { in: [vocabId, futureVocabId] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });

    await app.close();
  });

  it('retorna fila com itens vencidos excluindo suspensos e futuros', async () => {
    const response = await request(app.getHttpServer())
      .get('/review/queue')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assertQueueBody(response.body);
    // 1 kanji vencido + 1 vocabulário vencido
    expect(response.body.total_due).toBe(2);
    expect(response.body.by_type).toEqual({
      kanji: 1,
      vocabulary: 1,
      grammar: 0,
    });

    const itemIds = response.body.items.map((item) => item.item.id);
    expect(itemIds).toContain(kanjiId);
    expect(itemIds).toContain(vocabId);
    expect(itemIds).not.toContain(suspendedKanjiId);
    expect(itemIds).not.toContain(futureVocabId);

    const kanjiItem = response.body.items.find(
      (item) => item.item.id === kanjiId,
    );
    expect(kanjiItem?.item_type).toBe('kanji');
    expect(kanjiItem?.srs_level).toBe(3);
    expect(kanjiItem?.review_count).toBe(5);
  });

  it('retorna contagem da fila para o badge de revisão', async () => {
    await request(app.getHttpServer())
      .get('/review/queue/count')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({ kanji: 1, vocabulary: 1, total: 2 });
  });

  it('nega fila sem autenticação', async () => {
    await request(app.getHttpServer()).get('/review/queue').expect(401);
  });

  it('executa fluxo completo com SM-2 verificado no banco', async () => {
    // Cria sessão de kanji (apenas 1 kanji vencido do tipo)
    const created = await request(app.getHttpServer())
      .post('/review/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ session_type: 'kanji' })
      .expect(201);

    assertSessionBody(created.body);
    const sessionId: string = created.body.id;
    expect(created.body.session_type).toBe('kanji');
    expect(created.body.status).toBe('in_progress');
    expect(created.body.total_items).toBe(1);

    // quality 2 (OK): level 3→4, interval ceil(4×2.5)=10
    const answered = await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        item_id: kanjiId,
        item_type: 'kanji',
        answer_quality: 2,
        response_time_ms: 3200,
      })
      .expect(200);

    assertAnswerBody(answered.body);
    expect(answered.body.previous_srs_level).toBe(3);
    expect(answered.body.new_srs_level).toBe(4);
    expect(answered.body.previous_interval).toBe(4);
    expect(answered.body.new_interval).toBe(10);
    expect(answered.body.is_mastered).toBe(false);
    expect(answered.body.session_progress).toEqual({
      reviewed: 1,
      total: 1,
      correct: 1,
      incorrect: 0,
    });

    // Valida persistência real no banco: progresso + resposta
    const persistedProgress = await prisma.userKanjiProgress.findUnique({
      where: { userId_kanjiId: { userId, kanjiId } },
    });
    expect(persistedProgress?.srsLevel).toBe(4);
    expect(persistedProgress?.intervalDays).toBe(10);
    expect(persistedProgress?.totalReviews).toBe(6);
    expect(persistedProgress?.correctReviews).toBe(5);

    const persistedAnswers = await prisma.reviewAnswer.findMany({
      where: { sessionId },
    });
    expect(persistedAnswers).toHaveLength(1);
    expect(persistedAnswers[0]).toMatchObject({
      itemId: kanjiId,
      quality: 'CORRECT_HARD',
      srsLevelBefore: 3,
      srsLevelAfter: 4,
      intervalBefore: 4,
      intervalAfter: 10,
      responseTimeMs: 3200,
    });
  });

  it('encerra sessão, retorna stats e rejeita end duplicado', async () => {
    const created = await request(app.getHttpServer())
      .post('/review/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ session_type: 'vocabulary' })
      .expect(201);

    assertSessionBody(created.body);
    const sessionId: string = created.body.id;

    // quality 1 (difícil) no vocabulário
    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        item_id: vocabId,
        item_type: 'vocabulary',
        answer_quality: 1,
        response_time_ms: 5000,
      })
      .expect(200);

    const ended = await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assertSessionBody(ended.body);
    expect(ended.body.status).toBe('completed');
    expect(ended.body.reviewed_items).toBe(1);
    expect(ended.body.correct_items).toBe(0);
    expect(ended.body.accuracy_rate).toBe(0);

    const stats = await request(app.getHttpServer())
      .get(`/review/sessions/${sessionId}/stats`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assertStatsBody(stats.body);
    expect(stats.body.reviewed_items).toBe(1);
    expect(stats.body.accuracy_rate).toBe(0);
    expect(stats.body.quality_breakdown).toMatchObject({
      blackout: 0,
      wrong: 1,
      correct_hard: 0,
      correct_easy: 0,
    });

    // end duplicado → 409
    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);

    // answer após end → 409
    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        item_id: vocabId,
        item_type: 'vocabulary',
        answer_quality: 2,
      })
      .expect(409);
  });

  it('abandon preserva progresso e retorna 404 para item sem progresso', async () => {
    const created = await request(app.getHttpServer())
      .post('/review/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ session_type: 'vocabulary' })
      .expect(201);

    assertSessionBody(created.body);
    const sessionId: string = created.body.id;

    // Item existente no banco mas SEM linha de progresso do usuário → 404
    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        item_id: 'cmx0000000000000000000000',
        item_type: 'kanji',
        answer_quality: 2,
      })
      .expect(404);

    // quality inválida → 400
    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/answer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        item_id: vocabId,
        item_type: 'vocabulary',
        answer_quality: 9,
      })
      .expect(400);

    const abandoned = await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/abandon`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assertSessionBody(abandoned.body);
    expect(abandoned.body.status).toBe('abandoned');

    // end após abandon → 409
    await request(app.getHttpServer())
      .post(`/review/sessions/${sessionId}/end`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  it('retorna history paginado e nega acesso cruzado (IDOR)', async () => {
    const history = await request(app.getHttpServer())
      .get('/review/sessions/history?page=1&perPage=20')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assertHistoryBody(history.body);
    expect(Array.isArray(history.body.data)).toBe(true);
    expect(history.body.data.length).toBeGreaterThanOrEqual(3);
    expect(history.body.pagination).toMatchObject({ page: 1, perPage: 20 });

    const filtered = await request(app.getHttpServer())
      .get('/review/sessions/history?status=completed')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    assertHistoryBody(filtered.body);
    expect(filtered.body.data.every((s) => s.status === 'completed')).toBe(
      true,
    );

    const otherHistory = await request(app.getHttpServer())
      .get('/review/sessions/history')
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(200);

    assertHistoryBody(otherHistory.body);
    expect(otherHistory.body.data).toEqual([]);
  });

  it('nega leitura de sessão de outro usuário (IDOR)', async () => {
    const created = await request(app.getHttpServer())
      .post('/review/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ session_type: 'kanji' })
      .expect(201);

    assertSessionBody(created.body);

    await request(app.getHttpServer())
      .get(`/review/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/review/sessions/${created.body.id}/stats`)
      .set('Authorization', `Bearer ${otherAccessToken}`)
      .expect(404);
  });

  it('retorna 404 para sessão inexistente', async () => {
    await request(app.getHttpServer())
      .get('/review/sessions/session-inexistente')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
