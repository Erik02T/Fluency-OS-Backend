import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis.service';

/**
 * RateLimitMiddleware
 * Implementa rate limiting usando Redis
 * Limite: 100 requisições por minuto por IP
 */

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly maxRequests = 100;
  private readonly windowSeconds = 60;

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // Obter IP do cliente
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        'unknown';

      // Construir chave de rate limit
      const key = `${req.path}:${clientIp}`;

      // Incrementar contador no Redis
      const count = await this.redisService.incrementRateLimit(
        key,
        this.windowSeconds,
      );

      // Headers informativos
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, this.maxRequests - count),
      );
      res.setHeader(
        'X-RateLimit-Reset',
        Math.floor(Date.now() / 1000) + this.windowSeconds,
      );

      // Verificar limite
      if (count > this.maxRequests) {
        this.logger.warn(
          `Rate limit exceeded for IP ${clientIp} on ${req.path}`,
        );

        throw new HttpException(
          `Too many requests. Maximum ${this.maxRequests} requests per minute.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Rate limit check failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Fail-open: se Redis falhar, permite a requisição
      next();
    }
  }
}
