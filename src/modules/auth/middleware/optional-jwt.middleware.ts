import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Populates req.user when a valid Bearer token is present.
 * Invalid or missing tokens do not block the request (optional auth).
 */
@Injectable()
export class OptionalJwtMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      try {
        const payload = await this.authService.validateToken(token);
        (req as AuthenticatedRequest).user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
      } catch {
        // Optional auth: ignore invalid tokens on public routes
      }
    }

    next();
  }
}
