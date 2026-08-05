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

describe('Vocabulary E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let userId = '';
  let vocabularyId = '';

  const email = `vocabulary-student-${Date.now()}@example.com`;
  const password = 'SecurePass123';
  const uniqueSuffix = Date.now().toString(36);

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
      name: 'Vocabulary Student',
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    assertLoginResponse(login.body);
    accessToken = login.body.accessToken;
    userId = login.body.user.id;

    const vocabulary = await prisma.vocabulary.create({
      data: {
        word: `食べる-${uniqueSuffix}`,
        reading: `たべる-${uniqueSuffix}`,
        jlptLevel: 'N5',
        frequency: 321,
        partOfSpeech: 'verb',
        tags: ['daily', 'test'],
        notes: 'Vocabulário de teste E2E',
        meanings: {
          create: [
            {
              meaning: 'comer',
              isPrimary: true,
              position: 0,
            },
          ],
        },
        examples: {
          create: [
            {
              japanese: '毎日りんごを食べる。',
              reading: 'まいにちりんごをたべる。',
              translation: 'Eu como maça todos os dias.',
              source: 'Teste',
            },
          ],
        },
      },
    });

    vocabularyId = vocabulary.id;
  });

  afterAll(async () => {
    if (vocabularyId) {
      await prisma.userVocabularyProgress.deleteMany({
        where: { vocabularyId },
      });
      await prisma.vocabulary.deleteMany({ where: { id: vocabularyId } });
    }

    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('lista vocabulário com filtros reais', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/vocabulary?search=${encodeURIComponent(uniqueSuffix)}&jlpt=N5&page=1&perPage=20`,
      )
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      (response.body.data as Array<{ id: string }>).some(
        (item) => item.id === vocabularyId,
      ),
    ).toBe(true);
  });

  it('retorna detalhe real por id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/vocabulary/${vocabularyId}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', vocabularyId);
    expect(response.body).toHaveProperty('meanings');
    expect(response.body).toHaveProperty('examples');
  });

  it('marca item como estudado e depois revisado', async () => {
    const studied = await request(app.getHttpServer())
      .post(`/vocabulary/${vocabularyId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ action: 'study' })
      .expect(200);

    expect(studied.body).toHaveProperty('vocabularyId', vocabularyId);
    expect(studied.body).toHaveProperty('srsLevel');

    const reviewed = await request(app.getHttpServer())
      .post(`/vocabulary/${vocabularyId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ action: 'review', correct: true })
      .expect(200);

    expect(reviewed.body).toHaveProperty('totalReviews', 1);
    expect(reviewed.body).toHaveProperty('correctReviews', 1);
  });

  it('bloqueia progresso sem autenticação', async () => {
    await request(app.getHttpServer())
      .post(`/vocabulary/${vocabularyId}/progress`)
      .send({ action: 'study' })
      .expect(401);
  });

  it('retorna 404 para detalhe inexistente', async () => {
    await request(app.getHttpServer())
      .get('/vocabulary/vocabulary-id-inexistente')
      .expect(404);
  });

  it('retorna 404 para progresso de item inexistente', async () => {
    await request(app.getHttpServer())
      .post('/vocabulary/vocabulary-id-inexistente/progress')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ action: 'study' })
      .expect(404);
  });
});
