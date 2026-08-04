import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { runWithRequestContext } from '../logging/request-context';
import { logStructured } from '../logging/structured-log';

@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incomingRequestId = req.header('x-request-id');
    const requestId =
      typeof incomingRequestId === 'string' && incomingRequestId.trim().length > 0
        ? incomingRequestId.trim()
        : randomUUID();

    const startedAt = Date.now();
    res.setHeader('x-request-id', requestId);

    runWithRequestContext(requestId, () => {
      res.on('finish', () => {
        const durationMs = Date.now() - startedAt;

        logStructured('info', 'HttpRequest', 'request.completed', {
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs,
        });
      });

      next();
    });
  }
}
