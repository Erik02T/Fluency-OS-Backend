type EnvShape = {
  DATABASE_URL?: string;
  DB_SSL_ENABLED?: string;
  DB_CONNECTION_TIMEOUT?: string;
  DB_POOL_TIMEOUT?: string;
  DB_IDLE_TIMEOUT?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  JWT_SECRET?: string;
  JWT_EXPIRATION?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_REFRESH_EXPIRATION?: string;
  AUTH_ROLE_COOKIE_SECRET?: string;
  APP_PORT?: string;
  NODE_ENV?: string;
  FRONTEND_URL?: string;
};

function requireEnv(value: string | undefined, key: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function validateOptionalInt(value: string | undefined, key: string): void {
  if (value !== undefined && value !== '' && Number.isNaN(Number(value))) {
    throw new Error(`${key} must be an integer`);
  }
}

function validateOptionalBoolean(value: string | undefined, key: string): void {
  if (
    value !== undefined &&
    value !== '' &&
    value !== 'true' &&
    value !== 'false'
  ) {
    throw new Error(`${key} must be "true" or "false"`);
  }
}

export function validateEnv(config: Record<string, unknown>): EnvShape {
  const env = config as EnvShape;

  requireEnv(env.DATABASE_URL, 'DATABASE_URL');
  requireEnv(env.JWT_SECRET, 'JWT_SECRET');
  requireEnv(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');

  validateOptionalBoolean(env.DB_SSL_ENABLED, 'DB_SSL_ENABLED');
  validateOptionalInt(env.DB_CONNECTION_TIMEOUT, 'DB_CONNECTION_TIMEOUT');
  validateOptionalInt(env.DB_POOL_TIMEOUT, 'DB_POOL_TIMEOUT');
  validateOptionalInt(env.DB_IDLE_TIMEOUT, 'DB_IDLE_TIMEOUT');

  if (env.REDIS_PORT && Number.isNaN(Number(env.REDIS_PORT))) {
    throw new Error('REDIS_PORT must be a number');
  }

  if (env.APP_PORT && Number.isNaN(Number(env.APP_PORT))) {
    throw new Error('APP_PORT must be a number');
  }

  if (!env.DATABASE_URL?.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must start with postgresql://');
  }

  return env;
}
