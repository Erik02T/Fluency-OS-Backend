import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role, JLPTLevel } from '@prisma/client';
import { Server } from 'http';
import request from 'supertest';
import { AdminGrammarController } from './admin-grammar.controller';
import { GrammarService } from './grammar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AdminGrammarController', () => {
  let app: INestApplication;
  const grammarService = {
    createAdminGrammarPoint: jest.fn(),
    updateAdminGrammarPoint: jest.fn(),
    deleteAdminGrammarPoint: jest.fn(),
  };

  let jwtGuardError: Error | null = null;
  let rolesGuardAllowed = true;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminGrammarController],
      providers: [
        {
          provide: GrammarService,
          useValue: grammarService,
        },
        JwtAuthGuard,
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(() => [Role.ADMIN]),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: jest.fn(() => {
          if (jwtGuardError) {
            throw jwtGuardError;
          }

          return true;
        }),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn(() => rolesGuardAllowed),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtGuardError = null;
    rolesGuardAllowed = true;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  const httpServer = (): Server => app.getHttpServer() as Server;

  const validCreatePayload = {
    pattern: '〜たい',
    jlptLevel: 'N5',
    title: 'Expressar desejo',
    shortExplanation: 'Indica vontade de realizar uma ação.',
    examples: [
      {
        japanese: '食べたい。',
        translation: 'Quero comer.',
      },
    ],
  };

  const detailResponseBody = {
    id: 'grammar-123',
    pattern: '〜たい',
    title: 'Expressar desejo',
    jlpt: JLPTLevel.N5,
    difficulty: 1,
    position: 1,
    formalityLevel: 'neutral',
    tags: [],
    shortExplanation: 'Indica vontade de realizar uma ação.',
    detailedExplanation: null,
    examples: [],
  };

  it('should create a grammar point for admin', async () => {
    grammarService.createAdminGrammarPoint.mockResolvedValue(
      detailResponseBody,
    );

    await request(httpServer())
      .post('/admin/grammar-points')
      .send(validCreatePayload)
      .expect(201)
      .expect((response: { body: { id: string; pattern: string } }) => {
        expect(response.body.id).toBe('grammar-123');
        expect(response.body.pattern).toBe('〜たい');
      });

    expect(grammarService.createAdminGrammarPoint).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: '〜たい', jlptLevel: 'N5' }),
    );
  });

  it('should reject invalid create payload with validation error', async () => {
    await request(httpServer())
      .post('/admin/grammar-points')
      .send({ pattern: '〜たい' })
      .expect(400);

    expect(grammarService.createAdminGrammarPoint).not.toHaveBeenCalled();
  });

  it('should return 409 when creating a duplicate grammar point', async () => {
    grammarService.createAdminGrammarPoint.mockRejectedValue(
      new ConflictException("Grammar point '〜たい' (N5) already exists"),
    );

    await request(httpServer())
      .post('/admin/grammar-points')
      .send(validCreatePayload)
      .expect(409);
  });

  it('should update a grammar point for admin', async () => {
    grammarService.updateAdminGrammarPoint.mockResolvedValue({
      ...detailResponseBody,
      title: 'Título atualizado',
    });

    await request(httpServer())
      .put('/admin/grammar-points/grammar-123')
      .send({ title: 'Título atualizado' })
      .expect(200)
      .expect((response: { body: { title: string } }) => {
        expect(response.body.title).toBe('Título atualizado');
      });

    expect(grammarService.updateAdminGrammarPoint).toHaveBeenCalledWith(
      'grammar-123',
      { title: 'Título atualizado' },
    );
  });

  it('should return 404 when updating a missing grammar point', async () => {
    grammarService.updateAdminGrammarPoint.mockRejectedValue(
      new NotFoundException('Grammar point with id missing-id not found'),
    );

    await request(httpServer())
      .put('/admin/grammar-points/missing-id')
      .send({ title: 'Novo título' })
      .expect(404);
  });

  it('should delete a grammar point for admin', async () => {
    grammarService.deleteAdminGrammarPoint.mockResolvedValue(undefined);

    await request(httpServer())
      .delete('/admin/grammar-points/grammar-123')
      .expect(204);

    expect(grammarService.deleteAdminGrammarPoint).toHaveBeenCalledWith(
      'grammar-123',
    );
  });

  it('should return 404 when deleting a missing grammar point', async () => {
    grammarService.deleteAdminGrammarPoint.mockRejectedValue(
      new NotFoundException('Grammar point with id missing-id not found'),
    );

    await request(httpServer())
      .delete('/admin/grammar-points/missing-id')
      .expect(404);
  });

  it('should return 401 without jwt access', async () => {
    jwtGuardError = new UnauthorizedException();

    await request(httpServer()).post('/admin/grammar-points').expect(401);
  });

  it('should return 403 for non-admin role', async () => {
    rolesGuardAllowed = false;

    await request(httpServer()).post('/admin/grammar-points').expect(403);
  });
});
