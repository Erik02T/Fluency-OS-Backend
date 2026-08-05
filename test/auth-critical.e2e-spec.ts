import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

interface AuthBody {
  accessToken: string;
  user: {
    id: string;
    email: string;
  };
}

function assertAuthBody(body: unknown): asserts body is AuthBody {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('accessToken' in body) ||
    !('user' in body)
  ) {
    throw new Error(
      'Invalid auth response body: expected accessToken and user',
    );
  }
}

describe('Auth Critical E2E', () => {
  let app: INestApplication<App>;
  let agent: ReturnType<typeof request.agent>;
  let accessToken: string;

  const email = `critical-auth-${Date.now()}@example.com`;
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
    agent = request.agent(app.getHttpServer());

    await agent.post('/auth/register').send({
      email,
      password,
      name: 'Critical Auth User',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('login com sucesso', async () => {
    const response = await agent
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    assertAuthBody(response.body);
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user.email).toBe(email);
    expect(response.headers['set-cookie']).toBeDefined();

    accessToken = response.body.accessToken;
  });

  it('nega login com credenciais inválidas', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'WrongPassword' })
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('refresh de sessão com cookie válido', async () => {
    const response = await agent.post('/auth/refresh').send({}).expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.accessToken).toBeTruthy();

    accessToken = response.body.accessToken as string;
  });

  it('acessa rota protegida com sessão válida', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('email', email);
  });

  it('faz logout com sucesso', async () => {
    const response = await agent.post('/auth/logout').send({}).expect(200);

    expect(response.body).toHaveProperty('message');
  });

  it('nega refresh com sessão expirada (cookie inválido após logout)', async () => {
    const response = await agent.post('/auth/refresh').send({}).expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('nega acesso à rota protegida sem sessão/token', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });

  it('nega acesso à rota protegida com token inválido/expirado', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer invalid-or-expired-token')
      .expect(401);

    expect(response.body).toHaveProperty('message');
  });
});
