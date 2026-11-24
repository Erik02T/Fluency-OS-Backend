import { HttpStatus } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RedisService } from '../services/redis.service';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  const incrementRateLimit = jest.fn();
  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      CI: 'false',
      NODE_ENV: 'production',
      RATE_LIMIT_MAX_REQUESTS: '600',
    });
    incrementRateLimit
      .mockReset()
      .mockResolvedValue({ count: 5, ttlSeconds: 18 });
    middleware = new RateLimitMiddleware({
      incrementRateLimit,
    } as unknown as RedisService);
  });

  afterEach(() => jest.restoreAllMocks());

  function request(originalUrl: string, method = 'GET') {
    const req = {
      originalUrl,
      method,
      path: '/',
      ip: '127.0.0.1',
      header: jest.fn(),
    } as unknown as Request;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    const next: NextFunction = jest.fn();
    return { setHeader, next, run: () => middleware.use(req, res, next) };
  }

  it('uses the API area even when Nest sets req.path to the wildcard mount', async () => {
    const history = request('/review/sessions/history?status=in_progress');
    await history.run();
    await request('/review/sessions/example').run();
    await request('/vocabulary?search=teste').run();
    expect(incrementRateLimit.mock.calls).toEqual([
      ['review:127.0.0.1', 60],
      ['review:127.0.0.1', 60],
      ['vocabulary:127.0.0.1', 60],
    ]);
    expect(history.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 600);
    expect(history.next).toHaveBeenCalledTimes(1);
  });

  it('keeps the separate auth limit and sends the actual time until retry', async () => {
    incrementRateLimit.mockResolvedValueOnce({ count: 101, ttlSeconds: 18 });
    const auth = request('/auth/login', 'POST');
    await expect(auth.run()).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(auth.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    expect(auth.setHeader).toHaveBeenCalledWith('Retry-After', 18);
    expect(auth.next).not.toHaveBeenCalled();
  });

  it('exempts readiness and CORS preflight', async () => {
    await request('/health/ready').run();
    await request('/review/queue', 'OPTIONS').run();
    expect(incrementRateLimit).not.toHaveBeenCalled();
  });
});
