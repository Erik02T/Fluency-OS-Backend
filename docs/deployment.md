# Deployment — Estado Atual

**Última verificação:** 2026-09-11

## Infraestrutura comprovada

- `backend/docker-compose.yml` define PostgreSQL 16 e Redis 7 para desenvolvimento.
- O backend valida `DATABASE_URL`, `JWT_SECRET` e `JWT_REFRESH_SECRET` no bootstrap.
- O readiness verifica PostgreSQL e Redis.
- O middleware de rate limit usa Redis.
- Logs estruturados e request id estão implementados no código.

## Execução local

O compose existente sobe apenas as dependências PostgreSQL e Redis. A API é iniciada separadamente pelos scripts do `backend/package.json`.

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
```

O `.env.example` usa `APP_PORT=3001`, `REDIS_HOST`, `REDIS_PORT`, `DATABASE_URL`, `JWT_SECRET` e `JWT_REFRESH_SECRET`.

## Recursos não encontrados

Não foram encontrados no workspace:

- `docker/Dockerfile` ou compose de produção;
- workflow GitHub Actions;
- filas Bull, workers ou jobs agendados;
- Prometheus, `prom-client`, Grafana ou endpoint `/metrics`;
- configuração de backup PostgreSQL/WAL ou restore;
- integração S3/R2;
- SMTP, envio de e-mail ou recuperação de senha;
- configuração Cloudflare/VPS;
- observabilidade de produção além de logs estruturados e health checks.

As referências a esses recursos no spec original e em versões anteriores deste documento são arquitetura planejada, não estado operacional confirmado.

## Estado de cache e sessões

O Redis é usado para:

- armazenar refresh tokens por 7 dias;
- contar requisições do rate limit;
- armazenar a contagem da fila de revisão por 60 segundos;
- responder ao readiness check.

Não foi encontrada implementação das demais camadas de cache documentadas para conteúdo, estatísticas, metas e sessões.

## Checklist factual

| Item | Status |
|---|---|
| PostgreSQL local via Compose | IMPLEMENTADO |
| Redis local via Compose | IMPLEMENTADO |
| Build do backend | Script existente; execução recente não confirmada |
| Testes unitários | IMPLEMENTADO no código |
| Testes E2E | IMPLEMENTADO para áreas específicas |
| Health/readiness | IMPLEMENTADO |
| Rate limit Redis | IMPLEMENTADO |
| Docker de produção | NÃO IMPLEMENTADO |
| CI/CD | NÃO IMPLEMENTADO |
| Métricas Prometheus/Grafana | NÃO IMPLEMENTADO |
| Backup automatizado | NÃO IMPLEMENTADO |