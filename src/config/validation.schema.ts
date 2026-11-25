import { isIP } from 'node:net';

type EnvShape = {
  DATABASE_URL?: string;
  DB_SSL_ENABLED?: string;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  JWT_SECRET?: string;
  JWT_EXPIRATION?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_REFRESH_EXPIRATION?: string;
  AUTH_ROLE_COOKIE_SECRET?: string;
  APP_PORT?: string;
  PORT?: string;
  NODE_ENV?: string;
  FRONTEND_URL?: string;
  TRUST_PROXY?: string;
  SWAGGER_ENABLED?: string;
};

function requireEnv(value: string | undefined, key: string): string {
  if (!value?.trim()) {
    throw new Error('Missing required environment variable: ' + key);
  }
  return value;
}

function validateOptionalInt(
  value: string | undefined,
  key: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): void {
  if (value === undefined || value === '') return;
  const parsed = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw new Error(key + ' must be an integer between ' + min + ' and ' + max);
  }
}

function validateOptionalBoolean(value: string | undefined, key: string): void {
  if (value && value !== 'true' && value !== 'false') {
    throw new Error(key + ' must be "true" or "false"');
  }
}

function requireUrl(value: string, key: string, protocols: string[]): URL {
  const url = URL.canParse(value) ? new URL(value) : null;
  if (!url?.hostname || !protocols.includes(url.protocol)) {
    throw new Error(
      key + ' must be a valid ' + protocols.join(' or ') + ' URL',
    );
  }
  return url;
}

export function parseFrontendOrigins(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function parseTrustedProxies(value?: string): string[] {
  const proxies = (value ?? '')
    .split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);

  for (const proxy of proxies) {
    const [address, prefix, ...extra] = proxy.split('/');
    const family = isIP(address);
    if (
      !family ||
      extra.length ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (family === 4 ? 32 : 128)))
    ) {
      throw new Error('TRUST_PROXY must contain trusted IP addresses or CIDRs');
    }
  }

  return proxies;
}

export function validateEnv(config: Record<string, unknown>): EnvShape {
  const env = config as EnvShape;
  const production = env.NODE_ENV === 'production';
  const database = requireUrl(
    requireEnv(env.DATABASE_URL, 'DATABASE_URL'),
    'DATABASE_URL',
    ['postgresql:', 'postgres:'],
  );
  const accessSecret = requireEnv(env.JWT_SECRET, 'JWT_SECRET');
  const refreshSecret = requireEnv(
    env.JWT_REFRESH_SECRET,
    'JWT_REFRESH_SECRET',
  );

  validateOptionalBoolean(env.DB_SSL_ENABLED, 'DB_SSL_ENABLED');
  validateOptionalBoolean(env.SWAGGER_ENABLED, 'SWAGGER_ENABLED');
  validateOptionalInt(env.REDIS_PORT, 'REDIS_PORT', 1, 65535);
  validateOptionalInt(env.APP_PORT, 'APP_PORT', 1, 65535);
  validateOptionalInt(env.PORT, 'PORT', 1, 65535);
  validateOptionalInt(
    env.RATE_LIMIT_MAX_REQUESTS,
    'RATE_LIMIT_MAX_REQUESTS',
    1,
  );

  const redisUrl = production
    ? requireEnv(env.REDIS_URL, 'REDIS_URL')
    : env.REDIS_URL;
  if (redisUrl) {
    const redis = requireUrl(
      redisUrl,
      'REDIS_URL',
      production ? ['rediss:'] : ['redis:', 'rediss:'],
    );
    if (production && !redis.password) {
      throw new Error('REDIS_URL must include a password in production');
    }
  }

  const origins = parseFrontendOrigins(env.FRONTEND_URL);
  if (production && !origins.length) {
    throw new Error('FRONTEND_URL must contain an HTTPS origin in production');
  }
  for (const origin of origins) {
    const url = requireUrl(
      origin,
      'FRONTEND_URL',
      production ? ['https:'] : ['http:', 'https:'],
    );
    if (url.origin !== origin) {
      throw new Error(
        'FRONTEND_URL entries must be origins without paths, credentials or query strings',
      );
    }
  }
  parseTrustedProxies(env.TRUST_PROXY);

  if (production || env.DB_SSL_ENABLED === 'true') {
    if (
      database.searchParams.getAll('sslmode').join(',') !== 'require' ||
      database.searchParams.getAll('sslaccept').join(',') !== 'strict'
    ) {
      throw new Error(
        'DATABASE_URL must specify sslmode=require and sslaccept=strict when database TLS is required',
      );
    }
  }

  if (production) {
    const roleSecret = requireEnv(
      env.AUTH_ROLE_COOKIE_SECRET,
      'AUTH_ROLE_COOKIE_SECRET',
    );
    if (
      Buffer.byteLength(roleSecret.trim(), 'utf8') < 32 ||
      roleSecret === accessSecret ||
      roleSecret === refreshSecret
    ) {
      throw new Error(
        'AUTH_ROLE_COOKIE_SECRET must have at least 32 bytes and be distinct from JWT secrets',
      );
    }
  }

  return env;
}
