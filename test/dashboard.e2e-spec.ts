import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JLPTLevel, Role } from '@prisma/client';
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

interface DashboardSummaryBody {
  kanjiStudied: number;
  kanjiMastered: number;
  dueReviews: number;
  favoriteKanjis: number;
  totalReviews: number;
  accuracyRate: number;
  currentStreak: number;
  longestStreak: number;
  lastReviewAt: string | null;
  vocabularyStudied: number;
  vocabularyMastered: number;
  grammarStudied: number;
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

function assertSummaryBody(
  body: unknown,
): asserts body is DashboardSummaryBody {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Invalid dashboard summary body');
  }
}

describe('Dashboard E2E (Fase 6)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let studentAToken = '';
  let studentAId = '';
  let studentBToken = '';
  let studentBId = '';

  const suffix = Date.now().toString(36).slice(-5);
  const studentAEmail = `dash-student-a-${suffix}@example.com`;
  const studentBEmail = `dash-student-b-${suffix}@example.com`;
  const password = 'SecurePass123';

  const createdKanjiIds: string[] = [];
  const createdVocabularyIds: string[] = [];
  const createdGrammarPointIds: string[] = [];

  async function registerAndLogin(email: string): Promise<LoginResponseBody> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        name: `Dashboard ${email}`,
      });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    assertLoginResponse(login.body);
    return login.body;
  }

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

    const studentA = await registerAndLogin(studentAEmail);
    studentAToken = studentA.accessToken;
    studentAId = studentA.user.id;

    const studentB = await registerAndLogin(studentBEmail);
    studentBToken = studentB.accessToken;
    studentBId = studentB.user.id;

    // Biblioteca compartilhada (2 kanji, 2 vocab, 2 gramáticas) via Prisma.
    // character é VarChar(4) único — usa sufixo curto de timestamp.
    const base = Date.now().toString(36).slice(-2);
    for (let i = 0; i < 2; i += 1) {
      const kanji = await prisma.kanji.create({
        data: {
          character: `D${base}${i}`,
          jlptLevel: JLPTLevel.N4,
          unicodeCodepoint: `U+E6${base}${i}`,
          meanings: {
            create: {
              meaning: `kanji teste dashboard ${i}`,
              isPrimary: true,
            },
          },
        },
      });
      createdKanjiIds.push(kanji.id);

      const vocabulary = await prisma.vocabulary.create({
        data: {
          word: `語彙${suffix}${i}`,
          reading: `ごい${suffix}${i}`,
          jlptLevel: JLPTLevel.N4,
          tags: [],
        },
      });
      createdVocabularyIds.push(vocabulary.id);

      const grammarPoint = await prisma.grammarPoint.create({
        data: {
          pattern: `〜テスト${suffix}${i}`,
          jlptLevel: JLPTLevel.N4,
          title: `Gramática teste dashboard ${i}`,
          shortExplanation: `Ponto gramatical de teste ${i}`,
        },
      });
      createdGrammarPointIds.push(grammarPoint.id);
    }

    const nowDate = new Date();
    const yesterday = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);

    // Progresso do usuário A: kanji (1 dominado e vencido, 1 favorito futuro),
    // vocabulário (1 vencido), gramática (1 estudada) e streak 4/11.
    await prisma.userKanjiProgress.createMany({
      data: [
        {
          userId: studentAId,
          kanjiId: createdKanjiIds[0],
          isMastered: true,
          totalReviews: 10,
          correctReviews: 8,
          lastReviewAt: yesterday,
          nextReviewAt: yesterday,
        },
        {
          userId: studentAId,
          kanjiId: createdKanjiIds[1],
          isFavorite: true,
          totalReviews: 2,
          correctReviews: 2,
          lastReviewAt: nowDate,
          nextReviewAt: tomorrow,
        },
      ],
    });
    await prisma.userVocabularyProgress.create({
      data: {
        userId: studentAId,
        vocabularyId: createdVocabularyIds[0],
        totalReviews: 4,
        correctReviews: 3,
        lastReviewAt: nowDate,
        nextReviewAt: yesterday,
      },
    });
    await prisma.userGrammarProgress.create({
      data: {
        userId: studentAId,
        grammarPointId: createdGrammarPointIds[0],
        isStudied: true,
        studiedAt: nowDate,
      },
    });
    await prisma.streak.update({
      where: { userId: studentAId },
      data: { currentStreak: 4, longestStreak: 11 },
    });

    // Progresso do usuário B: apenas 1 kanji não vencido, sem vocab/gramática.
    await prisma.userKanjiProgress.create({
      data: {
        userId: studentBId,
        kanjiId: createdKanjiIds[0],
        totalReviews: 1,
        correctReviews: 1,
        lastReviewAt: nowDate,
        nextReviewAt: tomorrow,
      },
    });
  });

  afterAll(async () => {
    await prisma.userKanjiProgress.deleteMany({
      where: { userId: { in: [studentAId, studentBId] } },
    });
    await prisma.userVocabularyProgress.deleteMany({
      where: { userId: { in: [studentAId, studentBId] } },
    });
    await prisma.userGrammarProgress.deleteMany({
      where: { userId: { in: [studentAId, studentBId] } },
    });
    await prisma.grammarPoint.deleteMany({
      where: { id: { in: createdGrammarPointIds } },
    });
    await prisma.vocabulary.deleteMany({
      where: { id: { in: createdVocabularyIds } },
    });
    await prisma.kanji.deleteMany({
      where: { id: { in: createdKanjiIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [studentAId, studentBId] } },
    });

    await app.close();
  });

  it('retorna a estrutura contratada com métricas reais do usuário A', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);

    assertSummaryBody(response.body);

    expect(response.body).toMatchObject({
      kanjiStudied: 2,
      kanjiMastered: 1,
      dueReviews: 2, // 1 kanji vencido + 1 vocabulário vencido
      favoriteKanjis: 1,
      totalReviews: 16, // 12 (kanji) + 4 (vocabulário)
      accuracyRate: 81.3, // 13/16
      currentStreak: 4,
      longestStreak: 11,
      vocabularyStudied: 1,
      vocabularyMastered: 0,
      grammarStudied: 1,
    });
    expect(typeof response.body.lastReviewAt).toBe('string');
  });

  it('isola o resumo do usuário B do progresso do usuário A', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${studentBToken}`)
      .expect(200);

    assertSummaryBody(response.body);

    expect(response.body).toMatchObject({
      kanjiStudied: 1,
      kanjiMastered: 0,
      dueReviews: 0,
      favoriteKanjis: 0,
      totalReviews: 1,
      accuracyRate: 100,
      // Streak criado no registro com valores padrão 0/0 (registro real).
      currentStreak: 0,
      longestStreak: 0,
      vocabularyStudied: 0,
      vocabularyMastered: 0,
      grammarStudied: 0,
    });
  });

  it('bloqueia GET /dashboard/summary sem autenticação', async () => {
    await request(app.getHttpServer()).get('/dashboard/summary').expect(401);
  });

  it('mantém os mesmos valores após nova chamada (persistência)', async () => {
    const first = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);

    expect(second.body).toEqual(first.body);
  });
});
