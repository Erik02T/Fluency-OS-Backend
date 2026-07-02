# 🚢 Deployment

[← Voltar ao README](../README.md) · [Architecture](./ARCHITECTURE.md) · [API](./API.md) · [Database](./DATABASE.md)

## Stack de Infraestrutura

```
├── Docker + Docker Compose
├── GitHub Actions — CI/CD
├── Cloudflare — CDN, DNS, proteção DDoS
└── VPS (Hostinger VPS 4 ou Contabo) — servidor principal
```

Banco de dados: **PostgreSQL 16** · Cache/filas: **Redis 7** · Mídia: **S3-compatible (Cloudflare R2)**.

## Build & Run com Docker

```bash
# Build da imagem de produção
docker build -f docker/Dockerfile -t fluency-os-backend .

# Sobe a stack completa (API + Postgres + Redis)
docker compose -f docker/docker-compose.prod.yml up -d

# Logs
docker compose -f docker/docker-compose.prod.yml logs -f api
```

## CI/CD (GitHub Actions)

Pipeline recomendado por push/PR em `main`:

1. **Lint** — `pnpm lint`
2. **Testes** — `pnpm test` (unit) + `pnpm test:e2e`
3. **Build** — `pnpm build`
4. **Migrations** — `pnpm prisma migrate deploy` (apenas em `main`)
5. **Deploy** — build da imagem Docker → push para o registry → deploy na VPS

## Estratégia de Cache (Redis)

| Camada | Key | TTL | Invalidação |
|---|---|---|---|
| Conteúdo global | `kanji:{id}` | 24h | Ao admin editar o kanji |
| Lista por JLPT | `kanji:list:jlpt:{N5}` | 1h | — |
| Gramática | `grammar:{id}` | 24h | — |
| Stats do usuário | `user:{userId}:stats` | 5min | Após revisão, imersão ou adição de kanji |
| Contagem da fila | `user:{userId}:review_queue_count` | 1min | — |
| Meta diária | `user:{userId}:daily_goal:{date}` | até meia-noite | Ao atualizar progresso |
| Rate limit | `rate_limit:{ip}:{endpoint}` | janela configurada | Contador Redis (`INCR` + `EXPIRE`) |
| Sessão de revisão | `review_session:{sessionId}:queue` | 4h | Sessão expira se abandonada |
| Blacklist de token | `token_blacklist:{jti}` | até expirar o token | No logout |

## Filas (Bull + Redis)

| Fila | Prioridade | Concorrência | Jobs |
|---|---|---|---|
| `review-processing` | Alta | 10 workers | Processa resposta SRS, atualiza progresso |
| `notifications` | Média | 5 workers | Cria e envia notificações |
| `email` | Baixa | 2 workers | Boas-vindas, reset de senha, relatório semanal |
| `scheduled-jobs` | — (cron) | — | Daily reset, streak warning, review reminder |
| `analytics` | Baixa | 1 worker | Agregação diária de métricas |

## Observabilidade

**Logs** — Winston + pino, JSON estruturado, níveis `error/warn/info/debug`, destino `stdout` + arquivo rotativo.

**Métricas** — `prom-client` (Prometheus), expostas em `GET /metrics`:
- `http_requests_total` (por rota e status)
- `http_request_duration_seconds`
- `review_sessions_total`
- `active_users_gauge`
- `srs_queue_size_gauge`

**Health checks**
```
GET /health        → { status: "ok", database: "ok", redis: "ok" }
GET /health/live    → liveness probe (Kubernetes)
GET /health/ready   → readiness probe
```

**Alertas (Grafana)**
- Error rate > 1% por 5 minutos
- P95 latency > 500ms
- Pool de conexões do banco > 80%
- Memória do Redis > 80%

## Backup

| Serviço | Frequência | Retenção | Destino |
|---|---|---|---|
| PostgreSQL | Diário completo + WAL contínuo | 30 dias | Cloudflare R2 (bucket separado) |
| Redis | Snapshot RDB a cada hora | 7 dias | — (apenas cache, reconstruível) |

Teste de restore recomendado: **semanal**.

## Checklist de Produção

- [ ] Variáveis de ambiente de produção configuradas (segredos via CI/CD, nunca em `.env` commitado)
- [ ] `pnpm prisma migrate deploy` executado antes do deploy da API
- [ ] Rate limiting habilitado em todas as rotas sensíveis
- [ ] Cache Redis ativo e TTLs revisados
- [ ] Health checks respondendo (`/health/live`, `/health/ready`)
- [ ] Métricas expostas e dashboards no Grafana configurados
- [ ] Backup diário do PostgreSQL validado
- [ ] Alertas configurados (error rate, latência, pool de conexões, memória Redis)
- [ ] Detecção de reuso de refresh token ativa