import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ImmersionType } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/modules/auth/repositories/prisma.service';

interface LoginResponseBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

interface ImmersionLogResponse {
  id: string;
  userId: string;
  type: ImmersionType;
  title: string;
  durationMinutes: number;
  episode: string | null;
  comprehension: number | null;
  isActive: boolean;
  notes: string | null;
  loggedAt: string;
  createdAt: string;
}

interface PaginatedImmersionResponse {
  data: ImmersionLogResponse[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
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

function assertImmersionLogResponse(
  body: unknown,
): asserts body is ImmersionLogResponse {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('id' in body) ||
    !('type' in body) ||
    !('title' in body) ||
    !('durationMinutes' in body)
  ) {
    throw new Error('Invalid immersion log response body');
  }
}

function assertPaginatedImmersionBody(
  body: unknown,
): asserts body is PaginatedImmersionResponse {
  const isObject = typeof body === 'object' && body !== null;
  const hasData =
    isObject &&
    'data' in body &&
    Array.isArray((body as { data?: unknown }).data);
  const hasPagination = isObject && 'pagination' in body;

  if (!isObject || !hasData || !hasPagination) {
    const detail = JSON.stringify(body, null, 2);
    throw new Error(
      `Invalid paginated immersion response body. Body recebido: ${detail}`,
    );
  }
}

describe('Immersion E2E', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken = '';
  let userId = '';
  let otherAccessToken = '';
  let otherUserId = '';
  const createdLogIds: string[] = [];

  const email = `immersion-student-${Date.now()}@example.com`;
  const otherEmail = `immersion-other-${Date.now()}@example.com`;
  const password = 'SecurePass123';

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
      name: 'Immersion Student',
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
      name: 'Other Student',
    });

    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(200);

    assertLoginResponse(otherLogin.body);
    otherAccessToken = otherLogin.body.accessToken;
    otherUserId = otherLogin.body.user.id;
  });

  afterAll(async () => {
    if (createdLogIds.length > 0) {
      await prisma.immersionLog.deleteMany({
        where: { id: { in: createdLogIds } },
      });
    }

    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.deleteMany({ where: { id: otherUserId } });
    await app.close();
  });

  describe('Criação de log de imersão', () => {
    it('cria log com dados válidos e todos os campos opcionais', async () => {
      const response = await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.ANIME,
          title: 'Jujutsu Kaisen S2 EP 12',
          durationMinutes: 24,
          episode: 'EP 12',
          comprehension: 80,
          notes: 'Episódio intenso, muita gíria e expressões novas',
          isActive: 1,
        })
        .expect(201);

      assertImmersionLogResponse(response.body);
      expect(response.body.userId).toBe(userId);
      expect(response.body.type).toBe(ImmersionType.ANIME);
      expect(response.body.title).toBe('Jujutsu Kaisen S2 EP 12');
      expect(response.body.durationMinutes).toBe(24);
      expect(response.body.episode).toBe('EP 12');
      expect(response.body.comprehension).toBe(80);
      expect(response.body.isActive).toBe(true);
      expect(response.body.notes).toBe(
        'Episódio intenso, muita gíria e expressões novas',
      );
      expect(response.body.loggedAt).toBeDefined();

      createdLogIds.push(response.body.id);
    });

    it('cria log com dados mínimos (apenas campos obrigatórios)', async () => {
      const response = await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.PODCAST,
          title: 'Nihongo Con Teppei para iniciantes #200',
          durationMinutes: 15,
        })
        .expect(201);

      assertImmersionLogResponse(response.body);
      expect(response.body.userId).toBe(userId);
      expect(response.body.type).toBe(ImmersionType.PODCAST);
      expect(response.body.title).toBe(
        'Nihongo Con Teppei para iniciantes #200',
      );
      expect(response.body.durationMinutes).toBe(15);
      expect(response.body.episode).toBeNull();
      expect(response.body.comprehension).toBeNull();
      expect(response.body.notes).toBeNull();
      expect(response.body.isActive).toBe(true);

      createdLogIds.push(response.body.id);
    });

    it('cria log com data de realização customizada', async () => {
      const customDate = '2024-06-15T19:30:00.000Z';

      const response = await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.MANGA,
          title: 'One Piece Capítulo 1100',
          durationMinutes: 45,
          episode: 'Cap 1100',
          loggedAt: customDate,
        })
        .expect(201);

      assertImmersionLogResponse(response.body);
      expect(response.body.loggedAt).toContain('2024-06-15');
      expect(response.body.userId).toBe(userId);

      createdLogIds.push(response.body.id);
    });

    it('retorna 400 ao tentar criar com tipo inválido', async () => {
      await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: 'INVALID_TYPE',
          title: 'Teste tipo inválido',
          durationMinutes: 10,
        })
        .expect(400);
    });

    it('retorna 400 ao tentar criar sem campo obrigatório title', async () => {
      await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.GAME,
          durationMinutes: 60,
        })
        .expect(400);
    });

    it('retorna 400 ao tentar criar com durationMinutes zero ou negativo', async () => {
      await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.NEWS,
          title: 'Notícia de hoje',
          durationMinutes: 0,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.NEWS,
          title: 'Notícia de ontem',
          durationMinutes: -5,
        })
        .expect(400);
    });

    it('retorna 400 ao tentar criar com comprehension fora do range 0-100', async () => {
      await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.MUSIC,
          title: 'Playlist de J-Pop',
          durationMinutes: 30,
          comprehension: 150,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          type: ImmersionType.MUSIC,
          title: 'Playlist de J-Rock',
          durationMinutes: 25,
          comprehension: -10,
        })
        .expect(400);
    });

    it('retorna 401 ao tentar criar sem token de autenticação', async () => {
      await request(app.getHttpServer())
        .post('/immersion')
        .send({
          type: ImmersionType.MOVIE,
          title: 'Spirited Away',
          durationMinutes: 125,
        })
        .expect(401);
    });

    it('retorna 401 ao tentar criar com token inválido', async () => {
      await request(app.getHttpServer())
        .post('/immersion')
        .set('Authorization', 'Bearer token-invalido-xyz')
        .send({
          type: ImmersionType.MOVIE,
          title: 'Your Name',
          durationMinutes: 106,
        })
        .expect(401);
    });
  });

  describe('Listagem de logs de imersão', () => {
    beforeAll(async () => {
      const logs = await Promise.all([
        prisma.immersionLog.create({
          data: {
            userId: otherUserId,
            type: ImmersionType.DRAMA,
            title: 'Log de outro usuário - não deve aparecer',
            durationMinutes: 50,
          },
        }),
        prisma.immersionLog.create({
          data: {
            userId,
            type: ImmersionType.YOUTUBE,
            title: 'Vídeo de estudo gramatical',
            durationMinutes: 18,
            loggedAt: new Date('2024-01-10T10:00:00Z'),
          },
        }),
        prisma.immersionLog.create({
          data: {
            userId,
            type: ImmersionType.ANIME,
            title: 'Anime de teste para paginação 1',
            durationMinutes: 24,
            loggedAt: new Date('2024-01-09T20:00:00Z'),
          },
        }),
        prisma.immersionLog.create({
          data: {
            userId,
            type: ImmersionType.ANIME,
            title: 'Anime de teste para paginação 2',
            durationMinutes: 24,
            loggedAt: new Date('2024-01-08T20:00:00Z'),
          },
        }),
        prisma.immersionLog.create({
          data: {
            userId: otherUserId,
            type: ImmersionType.VISUAL_NOVEL,
            title: 'Steins;Gate Rota Okabe',
            durationMinutes: 180,
          },
        }),
      ]);

      createdLogIds.push(...logs.map((l) => l.id));
    });

    it('lista apenas os logs do usuário autenticado', async () => {
      const response = await request(app.getHttpServer())
        .get('/immersion?page=1&perPage=50')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      assertPaginatedImmersionBody(response.body);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);

      const hasOtherUserLogs = response.body.data.some(
        (log) => log.userId !== userId,
      );
      expect(hasOtherUserLogs).toBe(false);
    });

    it('aplica filtro por tipo de atividade', async () => {
      const response = await request(app.getHttpServer())
        .get('/immersion?type=ANIME&page=1&perPage=20')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      assertPaginatedImmersionBody(response.body);
      const allAnime = response.body.data.every(
        (log) => log.type === ImmersionType.ANIME,
      );
      expect(allAnime).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('retorna listagem paginada corretamente', async () => {
      const response = await request(app.getHttpServer())
        .get('/immersion?page=1&perPage=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      assertPaginatedImmersionBody(response.body);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.perPage).toBe(2);
      expect(response.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(response.body.pagination.pages).toBeGreaterThanOrEqual(2);
    });

    it('retorna 401 ao tentar listar sem token de autenticação', async () => {
      await request(app.getHttpServer()).get('/immersion').expect(401);
    });

    it('logs criados por outro usuário não são visíveis na listagem', async () => {
      const userResponse = await request(app.getHttpServer())
        .get('/immersion?type=DRAMA&page=1&perPage=20')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      assertPaginatedImmersionBody(userResponse.body);
      const dramaTitles = userResponse.body.data.map((log) => log.title);
      expect(dramaTitles).not.toContain(
        'Log de outro usuário - não deve aparecer',
      );

      const otherResponse = await request(app.getHttpServer())
        .get('/immersion?type=DRAMA&page=1&perPage=20')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(200);

      assertPaginatedImmersionBody(otherResponse.body);
      const otherDramaTitles = otherResponse.body.data.map((log) => log.title);
      expect(otherDramaTitles).toContain(
        'Log de outro usuário - não deve aparecer',
      );
    });

    it('segundo usuário visualiza apenas seus próprios logs', async () => {
      const otherResponse = await request(app.getHttpServer())
        .get('/immersion?type=VISUAL_NOVEL&page=1&perPage=20')
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .expect(200);

      assertPaginatedImmersionBody(otherResponse.body);
      const hasVn = otherResponse.body.data.some(
        (log) => log.title === 'Steins;Gate Rota Okabe',
      );
      expect(hasVn).toBe(true);

      const userResponse = await request(app.getHttpServer())
        .get('/immersion?type=VISUAL_NOVEL&page=1&perPage=20')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      assertPaginatedImmersionBody(userResponse.body);
      expect(userResponse.body.data.length).toBe(0);
    });
  });
});
