import {
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role, JLPTLevel } from '@prisma/client';
import { Server } from 'http';
import request from 'supertest';
import { AdminKanjiController } from './admin-kanji.controller';
import { KanjiService } from './kanji.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AdminKanjiController', () => {
  let app: INestApplication;
  const kanjiService = {
    findAll: jest.fn(),
    createAdminKanji: jest.fn(),
    updateAdminKanji: jest.fn(),
    deleteAdminKanji: jest.fn(),
  };

  let jwtGuardError: Error | null = null;
  let rolesGuardAllowed = true;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminKanjiController],
      providers: [
        {
          provide: KanjiService,
          useValue: kanjiService,
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

  it('should list kanjis for admin', async () => {
    kanjiService.findAll.mockResolvedValue({
      data: [],
      pagination: { page: 1, perPage: 20, total: 0, pages: 0 },
    });

    await request(httpServer())
      .get('/admin/kanjis?page=1&perPage=20')
      .expect(200)
      .expect({
        data: [],
        pagination: { page: 1, perPage: 20, total: 0, pages: 0 },
      });
  });

  it('should create a kanji for admin', async () => {
    kanjiService.createAdminKanji.mockResolvedValue({
      id: 'kanji-123',
      character: '火',
      unicodeCodepoint: 'U+706B',
      jlpt: JLPTLevel.N5,
      strokes: 4,
      frequency: 10,
      grade: 1,
      meanings: [],
      readings: { onyomi: [], kunyomi: [] },
      examples: [],
      radicals: [],
    });

    await request(httpServer())
      .post('/admin/kanjis')
      .send({
        character: '火',
        jlptLevel: 'N5',
        meanings: [{ meaning: 'fogo' }],
        readings: [{ reading: 'カ', type: 'ONYOMI' }],
      })
      .expect(201)
      .expect((response: { body: { character: string } }) => {
        expect(response.body.character).toBe('火');
      });
  });

  it('should reject invalid create payload with validation error', async () => {
    await request(httpServer())
      .post('/admin/kanjis')
      .send({ character: '火' })
      .expect(400);
  });

  it('should update a kanji for admin', async () => {
    kanjiService.updateAdminKanji.mockResolvedValue({
      id: 'kanji-123',
      character: '火',
      unicodeCodepoint: 'U+706B',
      jlpt: JLPTLevel.N5,
      strokes: 4,
      frequency: 10,
      grade: 1,
      meanings: [],
      readings: { onyomi: [], kunyomi: [] },
      examples: [],
      radicals: [],
    });

    await request(httpServer())
      .put('/admin/kanjis/kanji-123')
      .send({ grade: 2 })
      .expect(200)
      .expect((response: { body: { character: string } }) => {
        expect(response.body.character).toBe('火');
      });
  });

  it('should return 404 when updating a missing kanji', async () => {
    kanjiService.updateAdminKanji.mockRejectedValue(
      new NotFoundException('Kanji with id missing-id not found'),
    );

    await request(httpServer())
      .put('/admin/kanjis/missing-id')
      .send({ grade: 2 })
      .expect(404);
  });

  it('should delete a kanji for admin', async () => {
    kanjiService.deleteAdminKanji.mockResolvedValue(undefined);

    await request(httpServer()).delete('/admin/kanjis/kanji-123').expect(204);
  });

  it('should return 401 without jwt access', async () => {
    jwtGuardError = new UnauthorizedException();

    await request(httpServer()).get('/admin/kanjis').expect(401);
  });

  it('should return 403 for non-admin role', async () => {
    rolesGuardAllowed = false;

    await request(httpServer()).get('/admin/kanjis').expect(403);
  });
});
