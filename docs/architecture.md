# 🏗 Arquitetura

[← Voltar ao README](../README.md) · [API](./API.md) · [Database](./DATABASE.md) · [Deployment](./DEPLOYMENT.md)

## Visão Geral

O backend do Fluency OS é um monólito modular construído em **NestJS**, organizado por domínio (feature module). Cada módulo é autocontido — controller, service, repository e DTOs próprios — e se comunica com os demais preferencialmente **por eventos**, não por chamadas diretas entre services de domínios distintos.

```
┌──────────────────────┐        ┌──────────────────────┐
│   Next.js 15 (Web)    │◄──────►│   API REST (NestJS)   │
└──────────────────────┘  HTTP  └──────────┬───────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    ▼                       ▼                       ▼
           ┌─────────────────┐    ┌─────────────────┐     ┌─────────────────┐
           │   PostgreSQL 16   │    │      Redis 7      │     │   Bull Queues    │
           │  (dados principais)│    │ (cache/sessões/  │     │ (jobs async e    │
           │                   │    │  rate limit)      │     │  agendados)       │
           └─────────────────┘    └─────────────────┘     └─────────────────┘
                    ▲
                    │
           ┌─────────────────┐
           │  Socket.io Gateway │  ──► eventos em tempo real
           └─────────────────┘
```

## Princípios

- **Modularização por domínio** — `auth`, `kanji`, `review`, `streak`, `immersion`, `dashboard`, `ai`, etc., cada um um módulo NestJS independente.
- **Orientação a eventos** — ações de negócio emitem eventos internos consumidos por handlers, evitando acoplamento direto entre serviços (ex: responder uma revisão nunca chama `StreakService` diretamente — emite `KANJI_REVIEWED` e o handler de streak reage).
- **Cache em camadas** — conteúdo global (kanjis, gramática) e progresso do usuário são cacheados no Redis com TTLs distintos.
- **Consistência transacional** — toda atualização de SRS (progresso + resposta) roda em uma única transação de banco.
- **Tempo real desacoplado** — o gateway WebSocket publica eventos de domínio sem que os serviços conheçam detalhes de transporte.

## Observabilidade Operacional

- **Request ID por requisição**: cada request recebe/propaga `x-request-id`; esse id é reutilizado nos logs de controller e service para correlação.
- **Logs estruturados JSON**: eventos HTTP e de domínio (`auth.*`, `kanji.*`) são emitidos em JSON com `timestamp`, `level`, `context`, `event` e `requestId`.
- **Health checks**: `GET /health/live` (liveness) e `GET /health`/`GET /health/ready` (readiness com verificação de DB + Redis).

## Fluxo Principal: Sessão de Revisão SRS

```
Usuário clica em "Revisar (42)"
        │
        ▼
GET /review/queue
        │  busca user_kanji_progress WHERE next_review_at <= NOW()
        │  ordena: vencidos primeiro, depois por srs_level
        │  limita a user_preferences.srs_daily_limit
        ▼
POST /review/sessions { session_type }
        │  cria review_sessions { status: "in_progress" }
        ▼
Para cada item:
  Usuário responde (0=falhou · 1=difícil · 2=ok · 3=fácil)
        │
        ▼
POST /review/sessions/:id/answer
        │  SRSService.calculateNextReview() → algoritmo SM-2 adaptado
        │  UPDATE user_kanji_progress (transação)
        │  INSERT review_answers (histórico)
        │  emite KANJI_REVIEWED → StreakService, DailyGoalService
        │  [se srs_level >= 5] emite KANJI_MASTERED → NotificationService
        ▼
POST /review/sessions/:id/end
        │  UPDATE review_sessions { status: "completed" }
        │  calcula accuracy_rate
        │  emite SESSION_COMPLETED
```

### Algoritmo SM-2 adaptado

| Resposta | Novo `srs_level` | Novo `interval` | `ease_factor` |
|---|---|---|---|
| `0` — Falhou | `MAX(1, atual - 1)` | 1 dia | não muda |
| `1` — Difícil | mantém | `interval × 1.2` | `-0.15` (mín. 1.3) |
| `2` — OK | `MIN(5, atual + 1)` | `interval × ease_factor` | não muda |
| `3` — Fácil | `MIN(5, atual + 1)` | `interval × ease_factor × 1.3` | `+0.1` |

Um kanji é considerado **dominado** quando `srs_level >= 5`.

## Autenticação (resumo)

- **Access token**: JWT, 15 min, mantido em memória no frontend (nunca em `localStorage`).
- **Refresh token**: UUID v4 opaco, 30 dias, cookie HTTP-only + hash no banco, com **rotação a cada uso**.
- **Detecção de reuso** — se o mesmo refresh token for usado duas vezes, todos os tokens do usuário são revogados (indício de roubo de token).
- **Roles**: `student` (padrão) → `teacher` → `admin`, cada um estendendo as permissões do anterior. Guards: `JwtAuthGuard`, `RolesGuard`, `OwnerGuard`.

Detalhes completos de rotas de auth em [API.md](./API.md#auth).

## Eventos e Automações

O sistema é fortemente orientado a eventos. Alguns dos principais:

| Evento | Disparado por | Consumido por |
|---|---|---|
| `REVIEW_ANSWER_SUBMITTED` | `ReviewService` | `StreakService`, `DailyGoalService`, `MilestoneService` |
| `KANJI_MASTERED` | `SRSService` (srs_level ≥ 5) | `NotificationService`, `MilestoneService` |
| `STREAK_UPDATED` / `STREAK_BROKEN` | `StreakService` | `NotificationService`, `MilestoneService` |
| `DAILY_GOAL_COMPLETED` | `DailyGoalService` | `NotificationService`, `StreakService` |
| `IMMERSION_LOGGED` | `ImmersionService` | `DailyGoalService`, `StreakService` |
| `MILESTONE_ACHIEVED` | `MilestoneService` | `NotificationService`, `WebSocketGateway` |

### Jobs agendados (Bull + Redis, com suporte a timezone)

| Job | Horário | Ação |
|---|---|---|
| `DAILY_RESET_JOB` | 00:00 no timezone do usuário | Cria novo `daily_goal`, reseta contadores diários |
| `STREAK_WARNING_JOB` | 20:00 no timezone do usuário | Avisa se o streak (≥ 3 dias) está em risco |
| `REVIEW_REMINDER_JOB` | 09:00 no timezone do usuário | Notifica se a fila de revisão tem > 10 itens |
| `STREAK_FREEZE_REMINDER_JOB` | 22:00 | Último aviso antes de perder o streak congelado |
| `ANALYTICS_AGGREGATION_JOB` | 03:00 UTC | Agrega métricas do dia anterior |

> ⚠️ **Timezone é crítico**: todos os resets de meia-noite (streak, meta diária) são calculados pelo timezone salvo em `users.timezone`, nunca em UTC.

## WebSocket — namespace `/realtime`

Cliente se autentica no evento `auth` e entra em uma room privada (`user:{id}`). Eventos emitidos do servidor para o cliente:

| Evento | Quando | Uso no frontend |
|---|---|---|
| `review_queue_updated` | Novo item entra na fila | Atualiza badge "Revisar X" |
| `notification_received` | Nova notificação criada | Toast + sino de notificações |
| `streak_updated` | Streak incrementa ou quebra | Animação de streak no sidebar |
| `daily_goal_progress` | Progresso da meta muda | Barra de progresso em tempo real |
| `milestone_achieved` | Marco atingido | Modal de celebração 🎉 |
| `session_sync` | Resposta de revisão salva | Atualiza UI da sessão ativa |

## Estrutura de Pastas

```
fluency-os-backend/
│
├── src/
│   ├── modules/
│   │   ├── auth/            # JWT, refresh, guards, strategies
│   │   ├── users/            # Perfil e preferências
│   │   ├── kanji/            # Banco de kanji + progresso do usuário
│   │   ├── review/            # Sessões de revisão + SRS (SM-2)
│   │   ├── vocabulary/        # Banco de vocabulário
│   │   ├── grammar/           # Pontos gramaticais
│   │   ├── immersion/         # Logs de imersão
│   │   ├── sentences/          # Sentence mining
│   │   ├── streak/            # Streaks e freeze
│   │   ├── daily-goal/         # Metas diárias
│   │   ├── notifications/      # Notificações + gateway WebSocket
│   │   ├── lists/             # Listas personalizadas
│   │   ├── dashboard/          # Agregação para o dashboard
│   │   └── ai/                # AI Tutor
│   │
│   ├── database/             # Prisma service + módulo de banco
│   ├── shared/               # Types, utils e interceptors compartilhados
│   ├── config/               # app / database / jwt / redis / cors
│   ├── middleware/            # Logging e rate limiting
│   ├── events/               # Event emitter + handlers de domínio
│   ├── jobs/                 # Cron jobs
│   ├── app.module.ts
│   └── main.ts
│
├── prisma/                   # schema, seed, migrations
├── test/                     # unit + e2e
├── docker/                   # Dockerfile, compose
└── docs/                     # esta pasta
```

## Casos de Uso — destaques

| ID | Caso de uso | Resultado |
|---|---|---|
| UC-K003 | Adicionar kanji ao progresso | Cria `user_kanji_progress` com `srs_level = 1`; kanji entra na fila futura |
| UC-K005 | Dominar kanji via revisão | `srs_level` atinge 5 → `is_mastered = true` → notificação |
| UC-R002 | Responder item da revisão | SRS recalculado conforme tabela SM-2 acima |
| UC-I002 | Minar frase durante imersão | `mined_sentence` criada e vinculada ao `immersion_log` |
| UC-D002 | Ver streak e heatmap | `GET /dashboard/heatmap` → 365 dias de atividade |

Casos de uso completos por módulo estão documentados no spec original (`fluency-os-backend-spec.md`).