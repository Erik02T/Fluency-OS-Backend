import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RedisService } from '../services/redis.service';

const WINDOW_SECONDS = 60;
const DEFAULT_LIMIT = 600;
const AUTH_LIMIT = 100;
const API_AREAS = new Set([
  'admin',
  'analytics',
  'dashboard',
  'grammar',
  'immersion',
  'kanji',
  'planner',
  'review',
  'vocabulary',
]);

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly maxRequests = Number(
    process.env.RATE_LIMIT_MAX_REQUESTS ?? DEFAULT_LIMIT,
  );

  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Nest mounts this middleware on a wildcard, so req.path may be just '/'.
    const area = req.originalUrl.split('?')[0].split('/')[1]?.toLowerCase();
    if (req.method === 'OPTIONS' || area === 'health') return next();

    if (
      process.env.NODE_ENV === 'test' ||
      (process.env.NODE_ENV !== 'production' && process.env.CI === 'true')
    ) {
      res.setHeader('X-RateLimit-Limit', 'unlimited');
      res.setHeader('X-RateLimit-Remaining', 'unlimited');
      res.setHeader('X-RateLimit-Reset', '0');
      return next();
    }

    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const scope = area === 'auth' || API_AREAS.has(area) ? area : 'other';
    const limit = scope === 'auth' ? AUTH_LIMIT : this.maxRequests;

    let window: { count: number; ttlSeconds: number };
    try {
      window = await this.redisService.incrementRateLimit(
        `${scope}:${clientIp}`,
        WINDOW_SECONDS,
      );
    } catch (error) {
      this.logger.error(
        `Rate limit check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      // A temporary Redis failure should not take the API offline.
      return next();
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - window.count));
    res.setHeader(
      'X-RateLimit-Reset',
      Math.floor(Date.now() / 1000) + window.ttlSeconds,
    );

    if (window.count > limit) {
      res.setHeader('Retry-After', window.ttlSeconds);
      this.logger.warn(`Rate limit exceeded for IP ${clientIp} in ${scope}`);
      throw new HttpException(
        `Too many requests. Maximum ${limit} requests per minute.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
