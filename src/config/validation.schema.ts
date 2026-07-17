type EnvShape = {
  DATABASE_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  JWT_SECRET?: string;
  JWT_EXPIRATION?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_REFRESH_EXPIRATION?: string;
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

export function validateEnv(config: Record<string, unknown>): EnvShape {
  const env = config as EnvShape;

  requireEnv(env.DATABASE_URL, 'DATABASE_URL');
  requireEnv(env.JWT_SECRET, 'JWT_SECRET');
  requireEnv(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');

  if (env.REDIS_PORT && Number.isNaN(Number(env.REDIS_PORT))) {
    throw new Error('REDIS_PORT must be a number');
  }

  if (env.APP_PORT && Number.isNaN(Number(env.APP_PORT))) {
    throw new Error('APP_PORT must be a number');
  }

  return env;
}
