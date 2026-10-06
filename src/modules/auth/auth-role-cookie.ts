import { createHmac, timingSafeEqual } from 'crypto';
import { Role } from '@prisma/client';

const ROLE_VALUES = new Set<string>(Object.values(Role));

function resolveRoleCookieSecret(): string {
  return process.env.AUTH_ROLE_COOKIE_SECRET || process.env.JWT_SECRET || '';
}

export function createSignedRoleCookieValue(role: Role): string {
  const secret = resolveRoleCookieSecret();
  if (!secret) {
    throw new Error('Missing AUTH_ROLE_COOKIE_SECRET or JWT_SECRET');
  }

  const signature = createHmac('sha256', secret)
    .update(`role:${role}`)
    .digest('base64url');

  return `${role}.${signature}`;
}

export function parseSignedRoleCookieValue(
  value: string | undefined | null,
): Role | null {
  if (!value) {
    return null;
  }

  const secret = resolveRoleCookieSecret();
  if (!secret) {
    return null;
  }

  const [role, signature] = value.split('.');
  if (!role || !signature || !ROLE_VALUES.has(role)) {
    return null;
  }

  const expected = createHmac('sha256', secret)
    .update(`role:${role}`)
    .digest('base64url');

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  return role as Role;
}
