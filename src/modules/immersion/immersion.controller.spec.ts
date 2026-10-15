import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { ImmersionController } from './immersion.controller';
import { ImmersionService } from './immersion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('ImmersionController', () => {
  let app: INestApplication;
  const immersionService = {
    createLog: jest.fn(),
    getLogs: jest.fn(),
    getLog: jest.fn(),
    updateLog: jest.fn(),
    deleteLog: jest.fn(),
  };

  let jwtGuardError: Error | null = null;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ImmersionController],
      providers: [
        { provide: ImmersionService, useValue: immersionService },
        JwtAuthGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn((context: ExecutionContext) => {
          if (jwtGuardError) {
            throw jwtGuardError;
          }
          const req = context
            .switchToHttp()
            .getRequest<{ user?: { id: string } }>();
          req.user = { id: 'user-123' };
          return true;
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    jwtGuardError = null;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  const httpServer = (): Server => app.getHttpServer() as Server;

  const logResponse = {
    id: 'log-1',
    userId: 'user-123',
    type: 'ANIME',
    title: 'Shingeki no Kyojin',
    episode: 'EP 01',
    durationMinutes: 25,
    comprehension: 65,
    isActive: true,
    notes: null,
    loggedAt: '2026-10-10T12:00:00.000Z',
    createdAt: '2026-10-10T12:00:00.000Z',
  };

  it('POST /immersion cria log com 201', async () => {
    immersionService.createLog.mockResolvedValue(logResponse);

    await request(httpServer())
      .post('/immersion')
      .send({ type: 'ANIME', title: 'Shingeki no Kyojin', durationMinutes: 25 })
      .expect(201)
      .expect((res: { body: { id: string } }) => {
        expect(res.body.id).toBe('log-1');
      });

    expect(immersionService.createLog).toHaveBeenCalledWith('user-123', {
      type: 'ANIME',
      title: 'Shingeki no Kyojin',
      durationMinutes: 25,
    });
  });

  it('POST /immersion rejeita payload inválido com 400', async () => {
    await request(httpServer())
      .post('/immersion')
      .send({ type: 'ANIME', title: '', durationMinutes: 0 })
      .expect(400);

    expect(immersionService.createLog).not.toHaveBeenCalled();
  });

  it('GET /immersion retorna lista paginada e repassa os filtros', async () => {
    immersionService.getLogs.mockResolvedValue({
      data: [logResponse],
      pagination: { page: 1, perPage: 50, total: 1, pages: 1 },
    });

    await request(httpServer())
      .get('/immersion')
      .query({ page: 1, perPage: 50, sort: 'loggedAt', order: 'desc' })
      .expect(200)
      .expect(
        (res: { body: { data: unknown[]; pagination: { total: number } } }) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.pagination.total).toBe(1);
        },
      );

    expect(immersionService.getLogs).toHaveBeenCalledWith('user-123', {
      page: 1,
      perPage: 50,
      sort: 'loggedAt',
      order: 'desc',
    });
  });

  it('GET /immersion/:id retorna o log', async () => {
    immersionService.getLog.mockResolvedValue(logResponse);

    await request(httpServer())
      .get('/immersion/log-1')
      .expect(200)
      .expect((res: { body: { id: string } }) => {
        expect(res.body.id).toBe('log-1');
      });

    expect(immersionService.getLog).toHaveBeenCalledWith('user-123', 'log-1');
  });

  it('PATCH /immersion/:id atualiza o log', async () => {
    immersionService.updateLog.mockResolvedValue({
      ...logResponse,
      durationMinutes: 30,
    });

    await request(httpServer())
      .patch('/immersion/log-1')
      .send({ durationMinutes: 30 })
      .expect(200)
      .expect((res: { body: { durationMinutes: number } }) => {
        expect(res.body.durationMinutes).toBe(30);
      });
  });

  it('DELETE /immersion/:id remove o log', async () => {
    immersionService.deleteLog.mockResolvedValue({
      success: true,
      id: 'log-1',
    });

    await request(httpServer())
      .delete('/immersion/log-1')
      .expect(200)
      .expect((res: { body: { success: boolean } }) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('retorna 404 quando o service lança NotFound', async () => {
    immersionService.getLog.mockRejectedValue(
      new NotFoundException('Immersion log with id missing not found'),
    );

    await request(httpServer()).get('/immersion/missing').expect(404);
  });

  it('retorna 401 sem token JWT', async () => {
    jwtGuardError = new UnauthorizedException();
    await request(httpServer()).get('/immersion').expect(401);
  });
});
