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

describe('Grammar E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let userId = '';
  let grammarPointId = '';

  const email = `grammar-student-${Date.now()}@example.com`;
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
      name: 'Grammar Student',
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    assertLoginResponse(login.body);
    accessToken = login.body.accessToken;
    userId = login.body.user.id;

    const grammarPoint = await prisma.grammarPoint.create({
      data: {
        pattern: `〜ている-${uniqueSuffix}`,
        jlptLevel: 'N5',
        title: `Ação contínua ${uniqueSuffix}`,
        shortExplanation: 'Indica ação em progresso ou estado contínuo',
        detailedExplanation:
          'Formação: Verbo no TE-form + いる. Usado para ações em andamento.',
        formalityLevel: 'neutral',
        difficulty: 1,
        position: 1,
        tags: ['verb', 'tense', 'te-form'],
        examples: {
          create: [
            {
              japanese: '毎日日本語を勉強している。',
              reading: 'まいにちにほんごをべんきょうしている。',
              translation: 'Eu estudo japonês todos os dias.',
              notes: 'Exemplo de hábito contínuo',
              isNatural: true,
              position: 0,
            },
          ],
        },
      },
    });

    grammarPointId = grammarPoint.id;
  });

  afterAll(async () => {
    if (grammarPointId) {
      await prisma.userGrammarProgress.deleteMany({
        where: { grammarPointId },
      });
      await prisma.grammarPoint.deleteMany({ where: { id: grammarPointId } });
    }

    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('lista gramática com filtros reais', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/grammar?search=${encodeURIComponent(uniqueSuffix)}&jlpt=N5&page=1&perPage=20`,
      )
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(
      (response.body.data as Array<{ id: string }>).some(
        (item) => item.id === grammarPointId,
      ),
    ).toBe(true);
  });

  it('retorna detalhe real por id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/grammar/${grammarPointId}`)
      .expect(200);

    expect(response.body).toHaveProperty('id', grammarPointId);
    expect(response.body).toHaveProperty('pattern');
    expect(response.body).toHaveProperty('examples');
    expect(Array.isArray(response.body.examples)).toBe(true);
  });

  it('marca item como estudado e depois revisado', async () => {
    const studied = await request(app.getHttpServer())
      .post(`/grammar/${grammarPointId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ action: 'study' })
      .expect(200);

    expect(studied.body).toHaveProperty('grammarPointId', grammarPointId);
    expect(studied.body).toHaveProperty('isStudied', true);

    const reviewed = await request(app.getHttpServer())
      .post(`/grammar/${grammarPointId}/progress`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ action: 'review', understood: true, confidenceLevel: 4 })
      .expect(200);

    expect(reviewed.body).toHaveProperty('reviewCount', 1);
    expect(reviewed.body).toHaveProperty('confidenceLevel', 4);
  });

  it('bloqueia progresso sem autenticação', async () => {
    await request(app.getHttpServer())
      .post(`/grammar/${grammarPointId}/progress`)
      .send({ action: 'study' })
      .expect(401);
  });

  it('retorna 404 para detalhe inexistente', async () => {
    await request(app.getHttpServer())
      .get('/grammar/grammar-id-inexistente')
      .expect(404);
  });

  it('retorna 404 para progresso de item inexistente', async () => {
    await request(app.getHttpServer())
      .post('/grammar/grammar-id-inexistente/progress')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ action: 'study' })
      .expect(404);
  });
});
