import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { PrismaService } from './modules/auth/repositories/prisma.service';
import { RedisService } from './common/services';

describe('AppService (Health)', () => {
  let service: AppService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AppService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
  });

  it('retorna readiness ok quando DB e Redis estão saudáveis', async () => {
    prismaService.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }] as never);
    redisService.isHealthy.mockResolvedValue(true);

    const result = await service.getReadiness();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('ok');
    expect(result.redis).toBe('ok');
  });

  it('retorna 503 quando Redis está indisponível', async () => {
    prismaService.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }] as never);
    redisService.isHealthy.mockResolvedValue(false);

    await expect(service.getReadiness()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('retorna 503 quando banco está indisponível', async () => {
    prismaService.$queryRawUnsafe.mockRejectedValue(new Error('db down'));
    redisService.isHealthy.mockResolvedValue(true);

    await expect(service.getReadiness()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
