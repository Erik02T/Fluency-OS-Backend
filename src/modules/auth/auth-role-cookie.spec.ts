import { Role } from '@prisma/client';
import {
  createSignedRoleCookieValue,
  parseSignedRoleCookieValue,
} from './auth-role-cookie';

describe('auth-role-cookie', () => {
  const previousJwt = process.env.JWT_SECRET;
  const previousRoleSecret = process.env.AUTH_ROLE_COOKIE_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    delete process.env.AUTH_ROLE_COOKIE_SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = previousJwt;
    process.env.AUTH_ROLE_COOKIE_SECRET = previousRoleSecret;
  });

  it('signs and verifies role cookie values', () => {
    const value = createSignedRoleCookieValue(Role.ADMIN);
    expect(parseSignedRoleCookieValue(value)).toBe(Role.ADMIN);
  });

  it('rejects tampered role cookie values', () => {
    const value = createSignedRoleCookieValue(Role.STUDENT);
    const tampered = value.replace(/^STUDENT/, 'ADMIN');
    expect(parseSignedRoleCookieValue(tampered)).toBeNull();
    expect(parseSignedRoleCookieValue('ADMIN.not-a-signature')).toBeNull();
  });
});
