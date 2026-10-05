import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const createContext = (role?: Role) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({ user: role ? { role } : undefined })),
      })),
    }) as unknown as ExecutionContext;

  it('should allow access when no roles are required', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn(() => undefined),
    } as unknown as Reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('should allow access for matching role', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn(() => [Role.ADMIN]),
    } as unknown as Reflector);

    expect(guard.canActivate(createContext(Role.ADMIN))).toBe(true);
  });

  it('should deny access for missing or mismatched role', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn(() => [Role.ADMIN]),
    } as unknown as Reflector);

    expect(() => guard.canActivate(createContext(Role.STUDENT))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(createContext())).toThrow(
      ForbiddenException,
    );
  });
});
