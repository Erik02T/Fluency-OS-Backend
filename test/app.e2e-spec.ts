import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface AuthUserBody {
  email: string;
}

interface AuthTokensBody {
  accessToken: string;
  user: AuthUserBody;
}

interface RefreshTokenBody {
  accessToken: string;
}

interface ValidationErrorBody {
  message: string | string[];
}

interface KanjiListBody {
  data: unknown[];
  pagination: Record<string, unknown>;
}

function parseAuthTokensBody(body: unknown): AuthTokensBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    !('user' in body)
  ) {
    throw new Error('Invalid auth tokens response body');
  }

  return body as AuthTokensBody;
}

function parseRefreshTokenBody(body: unknown): RefreshTokenBody {
  if (typeof body !== 'object' || body === null || !('accessToken' in body)) {
    throw new Error('Invalid refresh token response body');
  }

  return body as RefreshTokenBody;
}

function parseValidationErrorBody(body: unknown): ValidationErrorBody {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    throw new Error('Invalid validation error response body');
  }

  return body as ValidationErrorBody;
}

function parseKanjiListBody(body: unknown): KanjiListBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    !('pagination' in body)
  ) {
    throw new Error('Invalid kanji list response body');
  }

  return body as KanjiListBody;
}

describe('Auth E2E Tests', () => {
  let app: INestApplication<App>;
  let authAgent: ReturnType<typeof request.agent>;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'SecurePass123';

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
    authAgent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await authAgent
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Test User',
        })
        .expect(201);

      const body = parseAuthTokensBody(response.body);

      expect(body.accessToken).toBeDefined();
      expect(body).not.toHaveProperty('refreshToken');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(body.user.email).toBe(testEmail);
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          name: 'Another User',
        })
        .expect(409);
    });

    it('should reject weak password', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `weak-${Date.now()}@example.com`,
          password: 'weak',
          name: 'Test User',
        })
        .expect(400);

      const body = parseValidationErrorBody(response.body);
      expect(body.message).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await authAgent
        .post('/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const body = parseAuthTokensBody(response.body);

      expect(body.accessToken).toBeDefined();
      expect(body).not.toHaveProperty('refreshToken');
      expect(response.headers['set-cookie']).toBeDefined();
      expect(body.user.email).toBe(testEmail);
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should reject nonexistent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token', async () => {
      const response = await authAgent.post('/auth/refresh').expect(200);

      const body = parseRefreshTokenBody(response.body);
      expect(body.accessToken).toBeTruthy();
    });

    it('should reject invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: 'invalid-token-id',
        })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout user', async () => {
      await authAgent.post('/auth/logout').expect(200);
    });
  });
});

describe('Kanji E2E Tests', () => {
  let app: INestApplication<App>;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /kanji', () => {
    it('should return list of kanjis', async () => {
      const response = await request(app.getHttpServer())
        .get('/kanji')
        .query({ page: 1, perPage: 20 })
        .expect(200);

      const body = parseKanjiListBody(response.body);

      expect(body.data).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should filter kanjis by JLPT level', async () => {
      const response = await request(app.getHttpServer())
        .get('/kanji')
        .query({ jlpt: 'N5', page: 1, perPage: 20 })
        .expect(200);

      const body = parseKanjiListBody(response.body);
      expect(body.data).toBeDefined();
    });
  });

  describe('GET /kanji/search/:query', () => {
    it('should search kanjis', async () => {
      const response = await request(app.getHttpServer())
        .get('/kanji/search/日')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
