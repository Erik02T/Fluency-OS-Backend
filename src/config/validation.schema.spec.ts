import { validateEnv } from './validation.schema';

describe('production environment', () => {
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL:
      'postgresql://qa@database/qa?sslmode=require&sslaccept=strict',
    JWT_SECRET: 'synthetic-access',
    JWT_REFRESH_SECRET: 'synthetic-refresh',
    AUTH_ROLE_COOKIE_SECRET: 'synthetic-dedicated-role-secret-for-qa',
    REDIS_URL: 'rediss://qa:synthetic@cache:6379/1',
    FRONTEND_URL: 'https://web.example.test',
    PORT: '3001',
  };

  it('accepts authenticated Redis, strict PostgreSQL TLS and explicit proxy CIDRs', () => {
    const config = { ...env, TRUST_PROXY: '192.0.2.1, 2001:db8::/32' };
    expect(validateEnv(config)).toEqual(config);
  });

  it.each([
    [
      { DATABASE_URL: 'postgresql://qa@database/qa?sslmode=require' },
      'sslaccept=strict',
    ],
    [{ AUTH_ROLE_COOKIE_SECRET: '' }, 'AUTH_ROLE_COOKIE_SECRET'],
    [{ JWT_REFRESH_SECRET: '' }, 'JWT_REFRESH_SECRET'],
    [{ REDIS_URL: '' }, 'REDIS_URL'],
    [{ REDIS_URL: 'redis://qa:synthetic@cache' }, 'REDIS_URL'],
    [{ REDIS_URL: 'rediss://cache' }, 'REDIS_URL'],
    [{ REDIS_URL: 'https://cache' }, 'REDIS_URL'],
    [{ FRONTEND_URL: '' }, 'FRONTEND_URL'],
    [{ FRONTEND_URL: 'http://web.example.test' }, 'FRONTEND_URL'],
    [{ FRONTEND_URL: 'https://example.test/admin' }, 'FRONTEND_URL'],
    [{ TRUST_PROXY: 'true' }, 'TRUST_PROXY'],
    [{ TRUST_PROXY: '0.0.0.0/0' }, 'TRUST_PROXY'],
    [{ PORT: '65536' }, 'PORT'],
  ])('rejects invalid production configuration %#', (overrides, expected) => {
    expect(() => validateEnv({ ...env, ...overrides })).toThrow(expected);
  });

  it('requires strict TLS even when the development flag is false', () => {
    expect(() =>
      validateEnv({
        ...env,
        DB_SSL_ENABLED: 'false',
        DATABASE_URL: 'postgresql://qa@database/qa?sslmode=disable',
      }),
    ).toThrow('sslaccept=strict');
  });
});
