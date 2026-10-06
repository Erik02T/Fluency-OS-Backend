import { registerAs } from '@nestjs/config';

/**
 * Configuração centralizada de banco de dados.
 *
 * - Credenciais são exclusivamente via variáveis de ambiente (nunca hardcoded).
 * - Suporte a SSL para deploy (produção requer conexões externas / serviços gerenciados
 *   (ex: Supabase, Neon, AWS RDS, Heroku Postgres, etc).
 * - Timeouts de conexão para evitar pool exhaustion sob carga.
 *
 * Variáveis de ambiente esperadas:
 *   DATABASE_URL           - string completa (inclui SSL params para produção)
 *   DB_SSL_ENABLED      - "true" habilita SSL na conexão Prisma (opcional)
 *   DB_CONNECTION_TIMEOUT - ms antes de falhar
 *   DB_POOL_TIMEOUT   - ms máximo esperando conexão livre do pool
 *   DB_IDLE_TIMEOUT - ms para conexão livre ser descartada
 */
export default registerAs('database', () => {
  const rawUrl = process.env.DATABASE_URL ?? '';
  const sslEnabled = process.env.DB_SSL_ENABLED === 'true';

  let connectionUrl = rawUrl;

  if (sslEnabled && rawUrl.length > 0) {
    const separator = rawUrl.includes('?') ? '&' : '?';
    if (!rawUrl.includes('sslmode')) {
      connectionUrl = `${rawUrl}${separator}sslmode=require`;
    }
    if (!rawUrl.includes('pgbouncer')) {
      connectionUrl = `${connectionUrl}&pgbouncer=true`;
    }
  }

  return {
    url: connectionUrl,
    sslEnabled,
    connectionTimeoutMs: parseInt(
      process.env.DB_CONNECTION_TIMEOUT ?? '10000',
      10,
    ),
    poolTimeoutMs: parseInt(process.env.DB_POOL_TIMEOUT ?? '5000', 10),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT ?? '600000', 10),
    credentialsViaEnv: process.env.DATABASE_URL !== undefined,
  };
});
