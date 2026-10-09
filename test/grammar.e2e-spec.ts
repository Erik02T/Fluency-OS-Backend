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

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
  };
}

interface GrammarDetailResponse {
  id: string;
  pattern: string;
  examples: Array<{ id: string; japanese: string; translation: string }>;
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

function assertPaginatedBody<T>(
  body: unknown,
): asserts body is PaginatedResponse<T> {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    !Array.isArray((body as { data?: unknown }).data)
  ) {
    throw new Error('Invalid paginated response body');
  }
}

function assertGrammarDetail(
  body: unknown,
): asserts body is GrammarDetailResponse {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('examples' in body) ||
    !Array.isArray((body as { examples?: unknown }).examples)
  ) {
    throw new Error('Invalid grammar detail response body');
  }
}

interface AdminGrammarDetailResponse {
  id: string;
  pattern: string;
  title: string;
  difficulty: number;
  examples: Array<{ id: string; japanese: string; translation: string }>;
}

function assertAdminGrammarDetail(
  body: unknown,
): asserts body is AdminGrammarDetailResponse {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('pattern' in body) ||
    !('title' in body) ||
    !('examples' in body) ||
    !Array.isArray((body as { examples?: unknown }).examples)
  ) {
    throw new Error('Invalid admin grammar detail response body');
  }
}

describe('Grammar E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let adminAccessToken = '';
  let userId = '';
  let adminUserId = '';
  let grammarPointId = '';

  const email = `grammar-student-${Date.now()}@example.com`;
  const adminEmail = `grammar-admin-${Date.now()}@example.com`;
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

    // Cria usuário admin e promove role para ADMIN (mesmo padrão do kanji-core e2e)
    await request(app.getHttpServer()).post('/auth/register').send({
      email: adminEmail,
      password,
      name: 'Grammar Admin',
    });

    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: 'ADMIN', isActive: true },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    assertLoginResponse(adminLogin.body);
    adminAccessToken = adminLogin.body.accessToken;
    adminUserId = adminLogin.body.user.id;

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

    // Remove pontos gramaticais criados pelos testes admin
    await prisma.grammarPoint.deleteMany({
      where: { pattern: { contains: uniqueSuffix } },
    });

    await prisma.user.deleteMany({
      where: { id: { in: [userId, adminUserId] } },
    });
    await app.close();
  });

  it('lista gramática com filtros reais', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/grammar?search=${encodeURIComponent(uniqueSuffix)}&jlpt=N5&page=1&perPage=20`,
      )
      .expect(200);

    assertPaginatedBody<{ id: string }>(response.body);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.some((item) => item.id === grammarPointId)).toBe(
      true,
    );
  });

  it('retorna detalhe real por id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/grammar/${grammarPointId}`)
      .expect(200);

    assertGrammarDetail(response.body);
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

  describe('admin CRUD E2E', () => {
    const adminPattern = `〜admin-${uniqueSuffix}`;
    let adminCreatedId = '';

    it('cria ponto gramatical via rota admin (ADMIN)', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          pattern: adminPattern,
          jlptLevel: 'N4',
          title: `Ponto admin ${uniqueSuffix}`,
          shortExplanation: 'Ponto criado pelo teste E2E admin.',
          detailedExplanation: 'Explicação detalhada do ponto admin.',
          formalityLevel: 'neutral',
          difficulty: 2,
          position: 10,
          tags: ['admin', 'e2e'],
          examples: [
            {
              japanese: `例文です-${uniqueSuffix}`,
              translation: 'Exemplo de frase.',
            },
          ],
        })
        .expect(201);

      assertAdminGrammarDetail(response.body);
      expect(response.body).toHaveProperty('id');
      expect(response.body.pattern).toBe(adminPattern);
      expect(response.body.title).toBe(`Ponto admin ${uniqueSuffix}`);
      expect(Array.isArray(response.body.examples)).toBe(true);
      expect(response.body.examples).toHaveLength(1);

      adminCreatedId = response.body.id;

      // Valida persistência real no banco
      const persisted = await prisma.grammarPoint.findUnique({
        where: { id: adminCreatedId },
        include: { examples: true },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.pattern).toBe(adminPattern);
      expect(persisted?.examples).toHaveLength(1);
    });

    it('retorna 409 para ponto gramatical duplicado', async () => {
      await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          pattern: adminPattern,
          jlptLevel: 'N4',
          title: `Ponto admin duplicado ${uniqueSuffix}`,
          shortExplanation: 'Tentativa de duplicar o ponto admin.',
        })
        .expect(409);
    });

    it('retorna 400 para payload admin inválido', async () => {
      await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ pattern: '〜apenas-pattern' })
        .expect(400);
    });

    it('edita ponto gramatical via rota admin (ADMIN)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/admin/grammar-points/${adminCreatedId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          title: `Ponto admin editado ${uniqueSuffix}`,
          difficulty: 3,
          examples: [
            {
              japanese: `編集後の例文-${uniqueSuffix}`,
              translation: 'Exemplo editado.',
            },
            {
              japanese: `第二个例文-${uniqueSuffix}`,
              translation: 'Segundo exemplo.',
            },
          ],
        })
        .expect(200);

      assertAdminGrammarDetail(response.body);
      expect(response.body.title).toBe(`Ponto admin editado ${uniqueSuffix}`);
      expect(response.body.difficulty).toBe(3);
      expect(response.body.examples).toHaveLength(2);

      // Valida persistência real no banco
      const persisted = await prisma.grammarPoint.findUnique({
        where: { id: adminCreatedId },
        include: { examples: true },
      });
      expect(persisted?.title).toBe(`Ponto admin editado ${uniqueSuffix}`);
      expect(persisted?.examples).toHaveLength(2);
    });

    it('reflete ponto admin criado na listagem pública', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/grammar?search=${encodeURIComponent(`admin-${uniqueSuffix}`)}&page=1&perPage=20`,
        )
        .expect(200);

      assertPaginatedBody<{ id: string }>(response.body);
      expect(
        response.body.data.some((item) => item.id === adminCreatedId),
      ).toBe(true);
    });

    it('nega acesso admin sem autenticação', async () => {
      await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .send({
          pattern: `〜sem-auth-${uniqueSuffix}`,
          jlptLevel: 'N5',
          title: 'Sem autenticação',
          shortExplanation: 'Não deveria ser criado.',
        })
        .expect(401);
    });

    it('nega acesso admin para usuário comum', async () => {
      await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          pattern: `〜user-comum-${uniqueSuffix}`,
          jlptLevel: 'N5',
          title: 'Usuário comum',
          shortExplanation: 'Não deveria ser criado.',
        })
        .expect(403);
    });

    it('retorna 404 ao editar ponto inexistente', async () => {
      await request(app.getHttpServer())
        .put('/admin/grammar-points/grammar-id-inexistente')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({ title: 'Inexistente' })
        .expect(404);
    });

    it('exclui ponto gramatical via rota admin e confirma 404 após exclusão', async () => {
      await request(app.getHttpServer())
        .delete(`/admin/grammar-points/${adminCreatedId}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(204);

      // Valida persistência real no banco
      const persisted = await prisma.grammarPoint.findUnique({
        where: { id: adminCreatedId },
      });
      expect(persisted).toBeNull();

      await request(app.getHttpServer())
        .get(`/grammar/${adminCreatedId}`)
        .expect(404);
    });

    it('retorna 404 ao excluir ponto inexistente', async () => {
      await request(app.getHttpServer())
        .delete('/admin/grammar-points/grammar-id-inexistente')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .expect(404);
    });
  });
});
