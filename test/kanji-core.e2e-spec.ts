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

describe('Kanji Core E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminAccessToken = '';
  let studentAccessToken = '';
  let studentUserId = '';
  let createdKanjiId = '';

  const studentEmail = `kanji-student-${Date.now()}@example.com`;
  const adminEmail = `kanji-admin-${Date.now()}@example.com`;
  const password = 'SecurePass123';

  const testCharacter = `K${Date.now().toString(36).slice(-3)}`;

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
      name: 'Kanji Student',
    });

    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);

    assertLoginResponse(studentLogin.body);
    studentAccessToken = studentLogin.body.accessToken;
    studentUserId = studentLogin.body.user.id;

    // Cria usuário admin e promove role para ADMIN
    await request(app.getHttpServer()).post('/auth/register').send({
      email: adminEmail,
      password,
      name: 'Kanji Admin',
    });

    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: Role.ADMIN, isActive: true },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    assertLoginResponse(adminLogin.body);
    adminAccessToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    if (createdKanjiId) {
      await prisma.kanji.deleteMany({ where: { id: createdKanjiId } });
    }

    await prisma.user.deleteMany({
      where: { email: { in: [studentEmail, adminEmail] } },
    });
    await app.close();
  });

  it('lista kanjis com paginação', async () => {
    const response = await request(app.getHttpServer())
      .get('/kanji?page=1&perPage=20')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      perPage: 20,
    });
  });

  it('nega payload inválido de filtro', async () => {
    await request(app.getHttpServer())
      .get('/kanji?jlpt=INVALID_LEVEL')
      .expect(400);
  });

  it('cria kanji via rota admin (ADMIN)', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/kanjis')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        character: testCharacter,
        unicodeCodepoint: 'U+E2E1',
        jlptLevel: 'N2',
        grade: 8,
        strokeCount: 6,
        frequency: 9999,
        notes: 'Kanji de teste E2E',
        romanization: 'e2e',
        meanings: [{ meaning: 'teste', language: 'pt-BR', isPrimary: true }],
        readings: [{ reading: 'テスト', type: 'ONYOMI', romanji: 'tesuto' }],
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('character', testCharacter);
    expect(response.body).toHaveProperty('jlpt', 'N2');

    createdKanjiId = response.body.id as string;
  });

  it('busca kanji por query e por filtro', async () => {
    const searchResponse = await request(app.getHttpServer())
      .get(`/kanji/search?q=${encodeURIComponent(testCharacter)}&limit=10`)
      .expect(200);

    expect(Array.isArray(searchResponse.body)).toBe(true);
    expect(
      (searchResponse.body as Array<{ id: string }>).some(
        (kanji) => kanji.id === createdKanjiId,
      ),
    ).toBe(true);

    const filterResponse = await request(app.getHttpServer())
      .get(
        `/kanji?search=${encodeURIComponent(testCharacter)}&jlpt=N2&page=1&perPage=20`,
      )
      .expect(200);

    expect(Array.isArray(filterResponse.body.data)).toBe(true);
    expect(
      (filterResponse.body.data as Array<{ id: string }>).some(
        (kanji) => kanji.id === createdKanjiId,
      ),
    ).toBe(true);
  });

  it('retorna detalhe de kanji por id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/kanji/${createdKanjiId}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', createdKanjiId);
    expect(response.body).toHaveProperty('character', testCharacter);
    expect(response.body).toHaveProperty('meanings');
    expect(response.body).toHaveProperty('readings');
  });

  it('retorna resumo real do dashboard para usuário autenticado', async () => {
    const secondKanjiResponse = await request(app.getHttpServer())
      .post('/admin/kanjis')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        character: `D${Date.now().toString(36).slice(-3)}`,
        unicodeCodepoint: 'U+E2E2',
        jlptLevel: 'N3',
        grade: 9,
        strokeCount: 9,
        frequency: 8888,
        notes: 'Kanji de teste dashboard',
        romanization: 'dash',
        meanings: [{ meaning: 'painel', language: 'pt-BR', isPrimary: true }],
        readings: [{ reading: 'ダッシュ', type: 'ONYOMI', romanji: 'dasshu' }],
      })
      .expect(201);

    const secondKanjiId = secondKanjiResponse.body.id as string;

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await prisma.userKanjiProgress.createMany({
      data: [
        {
          userId: studentUserId,
          kanjiId: createdKanjiId,
          isMastered: true,
          totalReviews: 10,
          correctReviews: 8,
          lastReviewAt: yesterday,
          nextReviewAt: tomorrow,
        },
        {
          userId: studentUserId,
          kanjiId: secondKanjiId,
          isFavorite: true,
          totalReviews: 2,
          correctReviews: 1,
          lastReviewAt: now,
          nextReviewAt: yesterday,
        },
      ],
    });

    await prisma.streak.upsert({
      where: { userId: studentUserId },
      update: {
        currentStreak: 4,
        longestStreak: 11,
        lastActivityDate: now.toISOString().slice(0, 10),
      },
      create: {
        userId: studentUserId,
        currentStreak: 4,
        longestStreak: 11,
        lastActivityDate: now.toISOString().slice(0, 10),
      },
    });

    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      kanjiStudied: 2,
      kanjiMastered: 1,
      dueReviews: 1,
      favoriteKanjis: 1,
      totalReviews: 12,
      accuracyRate: 75,
      currentStreak: 4,
      longestStreak: 11,
    });
    expect(response.body).toHaveProperty('lastReviewAt');

    await prisma.userKanjiProgress.deleteMany({
      where: {
        userId: studentUserId,
        kanjiId: { in: [createdKanjiId, secondKanjiId] },
      },
    });

    await prisma.kanji.delete({ where: { id: secondKanjiId } });
  });

  it('bloqueia resumo do dashboard sem autenticação', async () => {
    await request(app.getHttpServer()).get('/dashboard/summary').expect(401);
  });

  it('retorna 404 para detalhe de kanji inexistente', async () => {
    const response = await request(app.getHttpServer())
      .get('/kanji/kanji-id-inexistente')
      .expect(404);

    expect(response.body).toHaveProperty('message');
  });

  it('edita kanji via rota admin (ADMIN)', async () => {
    const response = await request(app.getHttpServer())
      .put(`/admin/kanjis/${createdKanjiId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        notes: 'Kanji de teste E2E atualizado',
        grade: 7,
      })
      .expect(200);

    expect(response.body).toHaveProperty('id', createdKanjiId);
    expect(response.body).toHaveProperty('grade', 7);
  });

  it('retorna 400 para payload admin inválido', async () => {
    await request(app.getHttpServer())
      .post('/admin/kanjis')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ character: testCharacter })
      .expect(400);
  });

  it('nega acesso admin sem autenticação', async () => {
    await request(app.getHttpServer())
      .post('/admin/kanjis')
      .send({})
      .expect(401);
  });

  it('nega acesso admin para usuário comum', async () => {
    await request(app.getHttpServer())
      .post('/admin/kanjis')
      .set('Authorization', `Bearer ${studentAccessToken}`)
      .send({
        character: 'ZZZ1',
        jlptLevel: 'N5',
        meanings: [{ meaning: 'x' }],
        readings: [{ reading: 'x', type: 'ONYOMI' }],
      })
      .expect(403);
  });

  it('exclui kanji via rota admin e confirma 404 após exclusão', async () => {
    const deletedKanjiId = createdKanjiId;

    await request(app.getHttpServer())
      .delete(`/admin/kanjis/${deletedKanjiId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .expect(204);

    createdKanjiId = '';

    await request(app.getHttpServer())
      .get(`/kanji/${deletedKanjiId}`)
      .expect(404);
  });
});
