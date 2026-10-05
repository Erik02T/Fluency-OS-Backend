import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/auth/repositories/prisma.service';
import { Role, ReviewStatus, JLPTLevel } from '@prisma/client';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: Role;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
}

interface GrammarDetailResponse {
  id: string;
  pattern: string;
  jlpt: JLPTLevel;
  title: string;
  difficulty: number;
  position: number;
  formalityLevel: string;
  tags: string[];
  shortExplanation: string;
  detailedExplanation: string | null;
  source: string | null;
  sourceId: string | null;
  contentVersion: number;
  reviewedAt: string | null;
  updatedAt: string;
  reviewStatus: ReviewStatus;
  examples: Array<{
    japanese: string;
    reading: string | null;
    translation: string;
    notes: string | null;
    isNatural: boolean;
  }>;
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
    !Array.isArray((body as { data?: unknown }).data) ||
    !('pagination' in body)
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
    !('pattern' in body) ||
    !('difficulty' in body) ||
    typeof body.difficulty !== 'number' ||
    !('tags' in body) ||
    !Array.isArray(body.tags) ||
    !('source' in body) ||
    !(body.source === null || typeof body.source === 'string') ||
    !('contentVersion' in body) ||
    typeof body.contentVersion !== 'number' ||
    !('examples' in body) ||
    !Array.isArray((body as { examples?: unknown }).examples)
  ) {
    throw new Error('Invalid grammar detail response body');
  }
}

describe('Admin Grammar E2E (FASE 16)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let adminToken = '';
  let studentToken = '';
  let adminUserId = '';
  let studentUserId = '';

  let createdGrammarId = '';
  const uniqueSuffix = Date.now().toString(36);

  const adminEmail = `admin-grammar-${uniqueSuffix}@example.com`;
  const adminPassword = 'SecureAdminPass123!';
  const studentEmail = `student-grammar-${uniqueSuffix}@example.com`;
  const studentPassword = 'SecureStudentPass123!';

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
      .send({
        email: studentEmail,
        password: studentPassword,
        name: 'Student Grammar Admin',
      })
      .expect(HttpStatus.CREATED);

    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: studentEmail, password: studentPassword })
      .expect(HttpStatus.OK);

    assertLoginResponse(studentLogin.body);
    studentToken = studentLogin.body.accessToken;
    studentUserId = studentLogin.body.user.id;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: adminEmail,
        password: adminPassword,
        name: 'Admin Grammar Admin',
      })
      .expect(HttpStatus.CREATED);

    await prisma.user.update({
      where: { email: adminEmail },
      data: { role: Role.ADMIN },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(HttpStatus.OK);

    assertLoginResponse(adminLogin.body);
    adminToken = adminLogin.body.accessToken;
    adminUserId = adminLogin.body.user.id;

    expect(adminLogin.body.user.role).toBe(Role.ADMIN);
  });

  afterAll(async () => {
    const idsToCleanup = [adminUserId, studentUserId];
    const grammars = await prisma.grammarPoint.findMany({
      where: { pattern: { contains: uniqueSuffix } },
      select: { id: true },
    });

    if (grammars.length > 0) {
      await prisma.userGrammarProgress.deleteMany({
        where: { grammarPointId: { in: grammars.map((g) => g.id) } },
      });
      await prisma.grammarExample.deleteMany({
        where: { grammarPointId: { in: grammars.map((g) => g.id) } },
      });
      await prisma.grammarPoint.deleteMany({
        where: { id: { in: grammars.map((g) => g.id) } },
      });
    }

    await prisma.user.deleteMany({
      where: { id: { in: idsToCleanup } },
    });

    await app.close();
  });

  describe('Controle de permissão', () => {
    it('Bloqueia acesso de estudante ao list admin (403)', async () => {
      await request(app.getHttpServer())
        .get('/admin/grammar-points')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('Bloqueia acesso de estudante ao create admin (403)', async () => {
      await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          pattern: `〜すみません-${uniqueSuffix}`,
          jlptLevel: 'N5',
          title: 'Desculpa',
          shortExplanation: 'Usado para pedir desculpas ou chamar atenção',
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('Bloqueia acesso sem autenticação (401)', async () => {
      await request(app.getHttpServer())
        .get('/admin/grammar-points')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('Admin consegue acessar list (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/grammar-points?page=1&perPage=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertPaginatedBody<GrammarDetailResponse>(res.body);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.perPage).toBe(5);
    });
  });

  describe('CRUD via admin endpoints', () => {
    it('POST /admin/grammar-points — cria com exemplos (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pattern: `〜ている-${uniqueSuffix}`,
          jlptLevel: 'N5',
          title: `Ação contínua ${uniqueSuffix}`,
          shortExplanation:
            'Indica que uma ação está em andamento ou é um estado/hábito contínuo.',
          detailedExplanation:
            'Formação: Verbo no TE-form + いる / います. Usado com verbos de ação.',
          formalityLevel: 'neutral',
          difficulty: 2,
          position: 9999,
          tags: ['verb', 'te-form', 'tense', `tag-${uniqueSuffix}`],
          examples: [
            {
              japanese: '毎日日本語を勉強しています。',
              reading: 'まいにちにほんごをべんきょうしています。',
              translation: 'Eu estudo japonês todos os dias.',
              notes: 'Exemplo de hábito contínuo',
              isNatural: true,
            },
            {
              japanese: '今本を読んでいる。',
              reading: 'いまほんをよんでいる。',
              translation: 'Estou lendo um livro agora.',
              notes: 'Exemplo de ação em progresso',
              isNatural: true,
            },
          ],
        })
        .expect(HttpStatus.CREATED);

      assertGrammarDetail(res.body);
      createdGrammarId = res.body.id;
      expect(res.body.pattern).toBe(`〜ている-${uniqueSuffix}`);
      expect(res.body.tags).toContain(`tag-${uniqueSuffix}`);
      expect(res.body.examples).toHaveLength(2);
      expect(res.body.reviewStatus).toBe(ReviewStatus.PENDING);
      expect(res.body.difficulty).toBe(2);
    });

    it('POST /admin/grammar-points — rejeita pattern duplicado no mesmo nível (409)', async () => {
      await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pattern: `〜ている-${uniqueSuffix}`,
          jlptLevel: 'N5',
          title: 'Duplicado',
          shortExplanation: 'deve falhar',
        })
        .expect(HttpStatus.CONFLICT);
    });

    it('POST /admin/grammar-points — rejeita DTO inválido (400)', async () => {
      await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pattern: '',
          jlptLevel: 'INVALID',
          difficulty: 99,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('GET /admin/grammar-points/:id — retorna detalhe criado (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/admin/grammar-points/${createdGrammarId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertGrammarDetail(res.body);
      expect(res.body.id).toBe(createdGrammarId);
      expect(res.body.examples).toHaveLength(2);
    });

    it('GET /admin/grammar-points/:id — 404 para inexistente', async () => {
      await request(app.getHttpServer())
        .get('/admin/grammar-points/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('PUT /admin/grammar-points/:id — atualiza campos e exemplos (200)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/admin/grammar-points/${createdGrammarId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: `Atualizado ${uniqueSuffix}`,
          difficulty: 3,
          tags: ['verb', 'te-form', 'atualizado'],
          examples: [
            {
              japanese: '雨が降っています。',
              reading: 'あめがふっています。',
              translation: 'Está chovendo.',
              notes: 'Estado atual',
              isNatural: true,
            },
          ],
        })
        .expect(HttpStatus.OK);

      assertGrammarDetail(res.body);
      expect(res.body.title).toBe(`Atualizado ${uniqueSuffix}`);
      expect(res.body.difficulty).toBe(3);
      expect(res.body.examples).toHaveLength(1);
      expect(res.body.examples[0].japanese).toBe('雨が降っています。');
    });

    it('PATCH /admin/grammar-points/:id/status — atualiza reviewStatus (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/grammar-points/${createdGrammarId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reviewStatus: ReviewStatus.REVIEWED,
          source: `e2e-${uniqueSuffix}`,
          sourceId: `TEST-${uniqueSuffix}-001`,
        })
        .expect(HttpStatus.OK);

      assertGrammarDetail(res.body);
      expect(res.body.reviewStatus).toBe(ReviewStatus.REVIEWED);
      expect(res.body.source).toBe(`e2e-${uniqueSuffix}`);
      expect(res.body.contentVersion).toBeGreaterThanOrEqual(2);
    });

    it('PATCH /admin/grammar-points/:id/status — 404 para inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/admin/grammar-points/non-existent-id/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewStatus: ReviewStatus.PUBLISHED })
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('Filtros, paginação e ordenação', () => {
    const patternsSeed = [
      {
        pattern: `〜ない-${uniqueSuffix}`,
        jlptLevel: 'N5' as JLPTLevel,
        status: ReviewStatus.PUBLISHED,
        tags: ['verb', 'negation'],
        difficulty: 1,
        position: 10,
        title: 'Negação',
      },
      {
        pattern: `〜ます-${uniqueSuffix}`,
        jlptLevel: 'N5' as JLPTLevel,
        status: ReviewStatus.REVIEWED,
        tags: ['verb', 'formal'],
        difficulty: 2,
        position: 5,
        title: 'Formal presente',
      },
      {
        pattern: `〜でした-${uniqueSuffix}`,
        jlptLevel: 'N4' as JLPTLevel,
        status: ReviewStatus.GENERATED,
        tags: ['copula', 'past'],
        difficulty: 3,
        position: 3,
        title: 'Passado educado',
      },
    ];

    beforeAll(async () => {
      await prisma.grammarPoint.createMany({
        data: patternsSeed.map((s, idx) => ({
          pattern: s.pattern,
          jlptLevel: s.jlptLevel,
          title: `${s.title} ${uniqueSuffix}`,
          shortExplanation: `Seed para filtros #${idx}`,
          reviewStatus: s.status,
          tags: s.tags,
          difficulty: s.difficulty,
          position: s.position,
          formalityLevel: 'neutral',
        })),
      });
    });

    it('GET /admin/grammar-points — filtro jlpt=N4 retorna apenas N4', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/admin/grammar-points?page=1&perPage=20&jlpt=N4&search=${encodeURIComponent(uniqueSuffix)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertPaginatedBody(res.body);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
      for (const item of res.body.data) {
        expect((item as { jlpt: JLPTLevel }).jlpt).toBe('N4');
      }
    });

    it('GET /admin/grammar-points — filtro status=PUBLISHED', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/admin/grammar-points?page=1&perPage=20&status=PUBLISHED&search=${encodeURIComponent(uniqueSuffix)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertPaginatedBody(res.body);
      for (const item of res.body.data) {
        expect((item as { reviewStatus: ReviewStatus }).reviewStatus).toBe(
          ReviewStatus.PUBLISHED,
        );
      }
    });

    it('GET /admin/grammar-points — filtro tag=negation', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/admin/grammar-points?page=1&perPage=20&tag=negation&search=${encodeURIComponent(uniqueSuffix)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertPaginatedBody(res.body);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /admin/grammar-points — filtro difficulty=3', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/admin/grammar-points?page=1&perPage=20&difficulty=3&search=${encodeURIComponent(uniqueSuffix)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertPaginatedBody(res.body);
      for (const item of res.body.data) {
        expect((item as { difficulty: number }).difficulty).toBe(3);
      }
    });

    it('GET /admin/grammar-points — ordenação por position ASC', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/admin/grammar-points?page=1&perPage=20&sort=position&order=asc&search=${encodeURIComponent(uniqueSuffix)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertPaginatedBody<{ position: number }>(res.body);
      const positions = res.body.data.map((d) => d.position);
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it('GET /admin/grammar-points — paginação com perPage=1 devolve 1 item', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/admin/grammar-points?page=1&perPage=1&search=${encodeURIComponent(uniqueSuffix)}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.OK);

      assertPaginatedBody(res.body);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.perPage).toBe(1);
      expect(res.body.pagination.pages).toBeGreaterThanOrEqual(2);
    });

    it('DELETE /admin/grammar-points/:id — remove registro (204)', async () => {
      const create = await request(app.getHttpServer())
        .post('/admin/grammar-points')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          pattern: `〜deletar-${uniqueSuffix}`,
          jlptLevel: 'N5',
          title: 'Para deletar',
          shortExplanation: 'Registro criado apenas para ser deletado',
        })
        .expect(HttpStatus.CREATED);

      assertGrammarDetail(create.body);
      const deletableId = create.body.id;

      await request(app.getHttpServer())
        .delete(`/admin/grammar-points/${deletableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NO_CONTENT);

      await request(app.getHttpServer())
        .get(`/admin/grammar-points/${deletableId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('DELETE /admin/grammar-points/:id — 404 para inexistente', async () => {
      await request(app.getHttpServer())
        .delete('/admin/grammar-points/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });
  });
});
