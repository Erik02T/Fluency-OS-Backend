# Arquitetura — Estado Atual

**Última verificação:** 2026-09-11

## Visão geral

O backend é um monólito modular NestJS. O `AppModule` importa Auth, Kanji, Vocabulary, Grammar, Immersion, Planner, Analytics, Review e Common. Cada domínio ativo possui controllers, services, DTOs e, quando aplicável, repositories.

```text
Next.js frontend
       │ HTTP/JSON + Bearer JWT
       ▼
NestJS API
       ├── Prisma ── PostgreSQL
       ├── Redis ── tokens, rate limit e contagem da fila
       └── Swagger ── /docs
```

## Componentes comprovados

- **NestJS:** bootstrap em `src/main.ts` e composição em `src/app.module.ts`.
- **Prisma/PostgreSQL:** persistência de usuários, conteúdo, progresso, revisão, imersão, analytics e planner.
- **Redis/ioredis:** refresh tokens, contador de rate limit, cache da contagem da fila e readiness.
- **Autenticação:** JWT Bearer, `JwtAuthGuard`, `RolesGuard` e cookies HttpOnly.
- **Validação:** `ValidationPipe` global com whitelist, transformação e rejeição de propriedades desconhecidas.
- **Observabilidade:** request id, middleware de observabilidade, logs estruturados e health checks.
- **Transação:** respostas SRS atualizam progresso, histórico, sessão, streak e meta dentro de `prisma.$transaction`.

## Fluxo SRS implementado

1. `GET /review/queue` consulta progresso vencido de kanji e vocabulário.
2. `POST /review/sessions` cria sessão para um dos dois tipos suportados.
3. `POST /review/sessions/:id/answer` valida a sessão e o item.
4. `SRSService.calculateNextReview()` calcula nível, intervalo, fator e próxima data.
5. A transação atualiza progresso, cria `ReviewAnswer`, atualiza a sessão e registra atividade.
6. A contagem da fila é invalidada no Redis.

`grammar`, `sentence` e `mixed` são rejeitados porque não existe infraestrutura SRS correspondente.

## Integração entre domínios

O serviço de revisão chama diretamente `StreakService` e `DailyGoalService` dentro da transação. `ReviewEventsService` registra eventos em logs estruturados, mas não existe barramento de eventos ou conjunto de handlers para notificações, milestones ou WebSocket.

## Autenticação real

- Access token JWT é emitido e consumido pelo frontend em memória.
- Refresh token é UUID v4 armazenado no Redis com TTL de 7 dias.
- Cookies de refresh e de role são HttpOnly.
- O fluxo testado cobre registro, login, refresh, logout e acesso protegido.
- O modelo Prisma `RefreshToken` existe, mas não é usado pelo `AuthService`.
- Não há rotação por uso nem detecção de reuso.

## Recursos previstos, mas ausentes

Não foram encontrados módulos ativos para Users, Notifications, Lists, Sentences, AI, WebSocket, jobs ou filas Bull. Também não foram encontrados adapters S3/R2, SMTP, Prometheus, Grafana ou workers de analytics.

## Estrutura atual

```text
src/
├── common/       # Redis, rate limit e logging
├── config/       # validação de ambiente
├── modules/
│   ├── analytics/
│   ├── auth/
│   ├── grammar/
│   ├── immersion/
│   ├── kanji/
│   ├── planner/
│   ├── review/
│   └── vocabulary/
├── app.controller.ts
├── app.module.ts
└── main.ts
```

## Diferenças em relação à arquitetura original

O documento original descreve um sistema com eventos internos, Bull, WebSocket, cache em camadas, jobs por timezone, notifications, AI Tutor e observabilidade Prometheus/Grafana. Esses elementos permanecem requisitos ou arquitetura planejada; não são componentes comprovados do estado atual.