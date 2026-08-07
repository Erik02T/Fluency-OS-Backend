import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './modules/auth/repositories/prisma.service';
import { RedisService } from './common/services';
import { logStructured } from './common/logging/structured-log';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'ok' | 'down';
  redis: 'ok' | 'down';
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<HealthResponse> {
    const [databaseHealthy, redisHealthy] = await Promise.all([
      this.checkDatabaseHealth(),
      this.redisService.isHealthy(),
    ]);

    const response: HealthResponse = {
      status: databaseHealthy && redisHealthy ? 'ok' : 'degraded',
      database: databaseHealthy ? 'ok' : 'down',
      redis: redisHealthy ? 'ok' : 'down',
      timestamp: new Date().toISOString(),
    };

    if (response.status !== 'ok') {
      logStructured(
        'error',
        'HealthCheck',
        'health.readiness.failed',
        response,
      );
      throw new ServiceUnavailableException(response);
    }

    logStructured('info', 'HealthCheck', 'health.readiness.ok', response);
    return response;
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.prismaService.$queryRawUnsafe('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
