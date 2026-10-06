import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService
 * Gerencia todas as operações com Redis:
 * - Refresh token storage (TTL 7 dias)
 * - Rate limiting counters
 * - Session caching
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private logger = new Logger('RedisService');
  private isTestEnv: boolean;
  private testStorage: Map<string, string>; // In-memory storage for tests

  constructor(private configService: ConfigService) {
    this.isTestEnv = this.configService.get('NODE_ENV') === 'test';
    this.testStorage = new Map();
  }

  /**
   * Conectar ao Redis ao inicializar módulo
   */
  async onModuleInit() {
    const isTestEnv = this.configService.get('NODE_ENV') === 'test';

    try {
      this.client = new Redis({
        host: this.configService.get('REDIS_HOST') || 'localhost',
        port: this.configService.get('REDIS_PORT') || 6379,
        db: 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        lazyConnect: isTestEnv, // Don't connect immediately in test environment
      });

      // Em ambiente de teste, não tentar conectar ao Redis
      if (isTestEnv) {
        this.logger.log(
          'Running in test environment - Redis connection skipped',
        );
        return;
      }

      // Aguardar conexão
      await this.client.ping();
      this.logger.log('Redis connected successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Não interrompe o bootstrap da API: readiness reportará degradação (503).
    }
  }

  /**
   * Desconectar ao destruir módulo
   */
  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.log('Redis disconnected');
      } catch (error) {
        this.logger.error(
          `Failed to disconnect Redis: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Armazenar refresh token em Redis com TTL
   * Chave: `refresh_token:{userId}:{tokenId}`
   * TTL: 7 dias (604800 segundos)
   * @param userId ID do usuário
   * @param tokenId ID único do refresh token (UUID)
   */
  async storeRefreshToken(userId: string, tokenId: string): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;

    // Em ambiente de teste, usa armazenamento em memória
    if (this.isTestEnv) {
      this.testStorage.set(key, userId);
      return;
    }

    const ttl = 7 * 24 * 60 * 60; // 7 dias em segundos

    try {
      await this.client.setex(key, ttl, userId);
    } catch (error) {
      this.logger.error(
        `Failed to store refresh token: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Validar refresh token em Redis
   * @param userId ID do usuário
   * @param tokenId ID do refresh token
   * @returns true se válido, false se expirado/não existe
   */
  async validateRefreshToken(
    userId: string,
    tokenId: string,
  ): Promise<boolean> {
    const key = `refresh_token:${userId}:${tokenId}`;

    // Em ambiente de teste, usa armazenamento em memória
    if (this.isTestEnv) {
      return this.testStorage.has(key);
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to validate refresh token: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Invalidar refresh token (logout)
   * @param userId ID do usuário
   * @param tokenId ID do refresh token
   */
  async invalidateRefreshToken(userId: string, tokenId: string): Promise<void> {
    const key = `refresh_token:${userId}:${tokenId}`;

    // Em ambiente de teste, usa armazenamento em memória
    if (this.isTestEnv) {
      this.testStorage.delete(key);
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate refresh token: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Encontrar o userId associado a um refresh token
   * @param tokenId ID do refresh token
   * @returns userId ou null se o token não existir
   */
  async findUserIdByRefreshToken(tokenId: string): Promise<string | null> {
    const pattern = `refresh_token:*:${tokenId}`;

    // Em ambiente de teste, usa armazenamento em memória
    if (this.isTestEnv) {
      for (const [key, value] of this.testStorage.entries()) {
        if (key.endsWith(`:${tokenId}`)) {
          return value;
        }
      }
      return null;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return null;
      }

      return await this.client.get(keys[0]);
    } catch (error) {
      this.logger.error(
        `Failed to find user by refresh token: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Invalidar todos os refresh tokens do usuário (logout em todos os dispositivos)
   * @param userId ID do usuário
   */
  async invalidateAllUserTokens(userId: string): Promise<void> {
    const pattern = `refresh_token:${userId}:*`;

    // Em ambiente de teste, usa armazenamento em memória
    if (this.isTestEnv) {
      for (const key of this.testStorage.keys()) {
        if (key.startsWith(`refresh_token:${userId}:`)) {
          this.testStorage.delete(key);
        }
      }
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete tokens: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Incrementar rate limit counter
   * Chave: `rate_limit:{endpoint}:{userId|ip}`
   * TTL: 60 segundos (janela de 1 minuto)
   * @param key Identificador único (endpoint + userId ou IP)
   * @returns Contagem atual
   */
  async incrementRateLimit(
    key: string,
    windowSeconds: number = 60,
  ): Promise<number> {
    // Em ambiente de teste, retorna 0 (sem rate limiting)
    if (this.isTestEnv) {
      return 0;
    }

    const fullKey = `rate_limit:${key}`;

    try {
      const count = await this.client.incr(fullKey);

      // Se é a primeira vez, definir TTL
      if (count === 1) {
        await this.client.expire(fullKey, windowSeconds);
      }

      return count;
    } catch (error) {
      this.logger.error(
        `Failed to increment rate limit: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Obter value de uma chave
   * @param key Chave Redis
   * @returns Value ou null
   */
  async get(key: string): Promise<string | null> {
    // Em ambiente de teste, usa armazenamento em memória
    if (this.isTestEnv) {
      return this.testStorage.get(key) || null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(
        `Failed to get key: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Definir value com TTL
   * @param key Chave Redis
   * @param value Valor
   * @param ttl TTL em segundos (optional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    // Em ambiente de teste, usa armazenamento em memória (ignora TTL)
    if (this.isTestEnv) {
      this.testStorage.set(key, value);
      return;
    }

    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error(
        `Failed to set key: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Deletar chave
   * @param key Chave Redis
   */
  async del(key: string): Promise<void> {
    // Em ambiente de teste, usa armazenamento em memória
    if (this.isTestEnv) {
      this.testStorage.delete(key);
      return;
    }

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(
        `Failed to delete key: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Health check
   * @returns true se Redis está conectado
   */
  async isHealthy(): Promise<boolean> {
    const isTestEnv = this.configService.get('NODE_ENV') === 'test';

    // Em ambiente de teste, retorna true mesmo sem Redis
    if (isTestEnv) {
      return true;
    }

    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
