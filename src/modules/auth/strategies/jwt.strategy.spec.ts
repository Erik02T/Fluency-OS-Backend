import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('should map jwt payload to authenticated user with role', () => {
    const strategy = new JwtStrategy({
      getOrThrow: jest.fn(() => 'test-secret'),
    } as unknown as ConfigService);

    const result = strategy.validate({
      sub: 'user-123',
      email: 'admin@example.com',
      role: Role.ADMIN,
    });

    expect(result).toEqual({
      id: 'user-123',
      email: 'admin@example.com',
      role: Role.ADMIN,
    });
  });
});
