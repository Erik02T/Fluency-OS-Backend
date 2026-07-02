<div align="center">

# 🎌 Fluency OS — Backend

**Sistema premium de aquisição natural de japonês, construído sobre SRS, imersão e rastreamento de progresso granular.**

[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)](#-status-do-projeto)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](#)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](#)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](#)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](./docs/DEPLOYMENT.md)
[![Swagger](https://img.shields.io/badge/docs-swagger%2Fopenapi-85EA2D?logo=swagger&logoColor=black)](./docs/API.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#-contribuição)
[![License](https://img.shields.io/badge/license-Interno-lightgrey)](#-licença)

**🔗 Links rápidos:** [Arquitetura](./docs/ARCHITECTURE.md) · [API](./docs/API.md) · [Database](./docs/DATABASE.md) · [Deployment](./docs/DEPLOYMENT.md)

[Introdução](#-introdução) •
[Status](#-status-do-projeto) •
[Arquitetura](#-arquitetura) •
[Tecnologias](#-tecnologias) •
[Funcionalidades](#-funcionalidades) •
[Estrutura](#-estrutura-do-projeto) •
[Instalação](#-instalação) •
[Variáveis de Ambiente](#-variáveis-de-ambiente) •
[Scripts](#-scripts) •
[API](#-api) •
[Roadmap](#-roadmap) •
[Documentação](#-documentação) •
[Contribuição](#-contribuição)

</div>

---

## 📖 Introdução

**Fluency OS** é um ecossistema de aprendizado de japonês construído em torno de aquisição natural do idioma, combinando:

- 🈷️ **Banco de Kanji** — 2.136 kanjis com leituras, significados, radicais e exemplos, seedados a partir do KANJIDIC2.
- 🔁 **SRS Engine** (Spaced Repetition System) — algoritmo SM-2 adaptado, com fila de revisão calculada por timezone.
- 🔥 **Streaks e metas diárias** — gamificação do hábito de estudo.
- 🎧 **Imersão e Sentence Mining** — registro de imersão ativa/passiva (anime, dorama, podcast, mangá, visual novel) e mineração de frases.
- 🤖 **AI Tutor** — chat, explicações, geração de exemplos e correção de texto.
- ⚡ **Tempo real** — atualizações via WebSocket (fila de revisão, streak, metas, notificações, marcos).

Este repositório contém o **backend** da plataforma, responsável por toda a lógica de negócio, persistência de dados, autenticação, filas assíncronas e API REST consumida pelo frontend (Next.js 15).

> Documento de origem: `fluency-os-backend-spec.md` (v1.0 · Nível: Produção)

## 🚦 Status do Projeto

**Fase atual: `1 — MVP Core` (em desenvolvimento)** · Estimativa total: 60–80 dias de desenvolvimento

| Fase | Escopo | Status |
|---|---|---|
| **1 — MVP Core** | Auth, banco de kanji, progresso, SRS básico, streak, meta diária, dashboard overview | 🟡 Em andamento |
| **2 — Conteúdo Expandido** | Vocabulário e gramática completos, sentence mining, imersão, listas, notificações | ⚪ Planejado |
| **3 — Experiência Premium** | WebSocket em tempo real, gamificação, jobs agendados, AI Tutor, painel admin | ⚪ Planejado |
| **4 — Produção** | Cache Redis, rate limiting, testes, Docker + CI/CD, monitoramento, hardening | ⚪ Planejado |

> Detalhamento completo de cada fase em [Roadmap](#-roadmap). Atualize esta tabela conforme o time avança — ela reflete o estado real do repositório, não o plano original.

## 🏗 Arquitetura

O backend segue uma arquitetura modular do NestJS, organizada por domínio (feature module), com clara separação entre **controllers**, **services** e **repositories**, orientação a eventos para automações e suporte nativo a tempo real.

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
           │  Socket.io Gateway │  ──► eventos em tempo real (fila, streak, metas, notificações)
           └─────────────────┘
```

**Princípios de arquitetura:**

- **Modularização por domínio** — cada feature (`auth`, `kanji`, `review`, `streak`, `immersion`, etc.) é um módulo NestJS autocontido, com seus próprios controller/service/repository/DTOs.
- **Orientação a eventos** — ações como responder uma revisão disparam eventos internos consumidos por handlers de streak, meta diária, notificações e marcos, evitando acoplamento direto entre serviços.
- **Cache em camadas** — conteúdo global (kanjis, gramática) e progresso do usuário são cacheados no Redis com TTLs distintos.
- **Consistência transacional** — atualizações de SRS (progresso + resposta) são sempre atômicas via transação de banco.
- **Tempo real desacoplado** — o gateway WebSocket (`/realtime`) publica eventos de domínio sem que os serviços de negócio conheçam detalhes de transporte.

📄 Fluxo completo da sessão de revisão SRS, catálogo de eventos, jobs agendados e casos de uso: **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**

## 🛠 Tecnologias

### Backend

| Camada | Tecnologia |
|---|---|
| Framework | [NestJS 10](https://nestjs.com/) (Node.js) |
| Linguagem | TypeScript 5 |
| ORM | Prisma — queries type-safe |
| Validação | class-validator + class-transformer |
| Autenticação | Passport.js (estratégias JWT + Local) |
| Filas | Bull (Redis-backed) |
| Tempo real | Socket.io |
| Documentação de API | Swagger / OpenAPI |

### Persistência

| Camada | Tecnologia |
|---|---|
| Banco relacional | PostgreSQL 16 |
| Cache / sessões / filas / rate limit | Redis 7 |
| Armazenamento de mídia | S3-compatible (Cloudflare R2) — áudios, avatars |

### Infraestrutura

- Docker + Docker Compose
- GitHub Actions (CI/CD)
- Cloudflare (CDN, DNS, proteção DDoS)
- VPS de produção (Hostinger VPS 4 ou Contabo)
- Prometheus + Grafana (métricas e alertas)
- Winston + pino (logging estruturado)

### Frontend (consumidor da API)

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Framer Motion · TanStack Query · Zustand · Socket.io Client

## ✨ Funcionalidades

- **Autenticação completa** — registro, login, refresh token com rotação, verificação de e-mail, reset de senha.
- **Banco de Kanji** — CRUD global, busca full-text (caractere, significado, onyomi/kunyomi), filtros por JLPT/grade/frequência, progresso individual por usuário (favoritos, suspensão, domínio).
- **Motor de SRS (SM-2 adaptado)** — cálculo de próximo intervalo, fator de facilidade, fila de revisão por timezone, sessões de revisão com histórico e estatísticas.
- **Vocabulário e Gramática** — bancos globais com progresso individual, pontos gramaticais relacionados e exemplos.
- **Streaks e metas diárias** — incremento/quebra de streak, freeze de streak, reset por timezone à meia-noite, heatmap de atividade (365 dias).
- **Imersão e Sentence Mining** — logs de imersão ativa/passiva por fonte, frases mineradas vinculadas a kanji/vocabulário/gramática.
- **Listas personalizadas** — criação, reordenação e organização de itens (kanji, vocabulário, frases) pelo usuário.
- **Notificações** — push interno com contagem de não lidas, entregues via REST e WebSocket.
- **AI Tutor** — chat contextual, explicações, geração de exemplos, correção e tradução de texto japonês.
- **Painel administrativo** — CRUD completo do banco de kanjis, importação em lote, gestão de usuários e métricas globais.
- **Observabilidade** — health checks (`/health`, `/health/live`, `/health/ready`), métricas Prometheus (`/metrics`), alertas via Grafana.

## 📂 Estrutura do Projeto

```
fluency-os-backend/
│
├── src/
│   ├── modules/
│   │   ├── auth/              # JWT, refresh token, guards, strategies
│   │   ├── users/              # Perfil e preferências
│   │   ├── kanji/              # Banco de kanji + progresso do usuário
│   │   ├── review/              # Sessões de revisão + SRS (SM-2)
│   │   ├── vocabulary/          # Banco de vocabulário
│   │   ├── grammar/             # Pontos gramaticais
│   │   ├── immersion/           # Logs de imersão
│   │   ├── sentences/            # Sentence mining
│   │   ├── streak/              # Streaks e freeze
│   │   ├── daily-goal/           # Metas diárias
│   │   ├── notifications/        # Notificações + gateway WebSocket
│   │   ├── lists/               # Listas personalizadas
│   │   ├── dashboard/            # Agregação para o dashboard
│   │   └── ai/                  # AI Tutor
│   │
│   ├── database/               # Prisma service + módulo de banco
│   ├── shared/                 # Types, utils e interceptors compartilhados
│   ├── config/                 # Configuração (app, database, jwt, redis, cors)
│   ├── middleware/              # Logging e rate limiting
│   ├── events/                 # Event emitter + handlers de domínio
│   ├── jobs/                   # Cron jobs (daily reset, streak warning, review reminder)
│   ├── app.module.ts
│   └── main.ts
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── test/
│   ├── unit/
│   └── e2e/
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Instalação

### Pré-requisitos

- Node.js ≥ 20
- pnpm (ou npm/yarn)
- Docker + Docker Compose
- PostgreSQL 16 (ou via Docker)
- Redis 7 (ou via Docker)

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/<seu-usuario>/fluency-os-backend.git
cd fluency-os-backend

# 2. Instale as dependências
pnpm install

# 3. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 4. Suba os serviços de infraestrutura (Postgres + Redis)
docker compose -f docker/docker-compose.yml up -d

# 5. Rode as migrations e o seed inicial de kanjis
pnpm prisma migrate dev
pnpm prisma db seed

# 6. Inicie o servidor em modo desenvolvimento
pnpm start:dev
```

A API estará disponível em `http://localhost:3000/v1`, com a documentação Swagger em `http://localhost:3000/docs`.

## ⚙️ Configuração

O projeto usa o módulo de configuração do NestJS, com validação de schema em `src/config/`. Os principais domínios de configuração são:

| Arquivo | Responsabilidade |
|---|---|
| `app.config.ts` | Porta, ambiente, prefixo de rota (`/v1`) |
| `database.config.ts` | Conexão com PostgreSQL via Prisma |
| `jwt.config.ts` | Segredos e expiração de access/refresh token |
| `redis.config.ts` | Conexão de cache, filas e rate limit |
| `cors.config.ts` | Origens permitidas (frontend) |

## 🔑 Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores:

```env
# App
NODE_ENV=development
PORT=3000
API_PREFIX=v1
FRONTEND_URL=http://localhost:3001

# Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/fluency_os

# Redis
REDIS_URL=redis://localhost:6379

# Autenticação
JWT_ACCESS_SECRET=troque-por-um-segredo-forte
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Armazenamento (S3-compatible / Cloudflare R2)
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# E-mail (verificação, reset de senha)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=

# AI Tutor
AI_PROVIDER_API_KEY=
AI_RATE_LIMIT_PER_MINUTE=10

# Observabilidade
LOG_LEVEL=info
```

> ⚠️ Nunca faça commit do arquivo `.env` real. Utilize secrets do provedor de CI/CD em produção.

## 📜 Scripts

| Comando | Descrição |
|---|---|
| `pnpm start:dev` | Inicia o servidor em modo desenvolvimento com hot-reload |
| `pnpm build` | Compila o projeto para produção |
| `pnpm start:prod` | Inicia o servidor a partir do build compilado |
| `pnpm prisma migrate dev` | Executa migrations em ambiente de desenvolvimento |
| `pnpm prisma db seed` | Popula o banco com o seed inicial de kanjis (KANJIDIC2) |
| `pnpm test` | Executa os testes unitários |
| `pnpm test:e2e` | Executa os testes end-to-end |
| `pnpm test:cov` | Gera relatório de cobertura de testes |
| `pnpm lint` | Roda o ESLint |
| `pnpm format` | Formata o código com Prettier |

## 🔌 API

Base URL: `https://api.fluencyos.app/v1`
Autenticação: `Authorization: Bearer <access_token>`
Paginação: cursor-based (`next_cursor`, `limit`)
Formato de erro: [RFC 7807 — Problem Details](https://www.rfc-editor.org/rfc/rfc7807)

Documentação interativa completa (Swagger/OpenAPI) disponível em `/docs` após subir o servidor. Principais grupos de rotas:

| Grupo | Exemplos de rotas |
|---|---|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| **Users** | `GET /users/me`, `PATCH /users/me/preferences`, `GET /users/me/stats` |
| **Kanji** | `GET /kanji`, `GET /kanji/:id`, `GET /kanji/me/due`, `POST /kanji/:id/favorite` |
| **Review** | `GET /review/queue`, `POST /review/sessions`, `POST /review/sessions/:id/answer` |
| **Dashboard** | `GET /dashboard/overview`, `GET /dashboard/heatmap`, `GET /dashboard/milestones` |
| **Vocabulary** | `GET /vocabulary`, `GET /vocabulary/me/due`, `POST /vocabulary/import` |
| **Grammar** | `GET /grammar`, `GET /grammar/:id/related` |
| **Immersion** | `GET /immersion/logs`, `POST /immersion/logs`, `GET /immersion/stats` |
| **Sentences** | `GET /sentences`, `POST /sentences`, `POST /sentences/:id/review` |
| **Notifications** | `GET /notifications`, `PATCH /notifications/read-all` |
| **Lists** | `GET /lists`, `POST /lists/:id/items`, `PATCH /lists/:id/items/reorder` |
| **AI Tutor** | `POST /ai/chat`, `POST /ai/explain`, `POST /ai/correct`, `POST /ai/translate` |
| **Admin** | `GET /admin/kanjis`, `POST /admin/kanjis/import`, `GET /admin/stats` |

📄 Referência completa (todas as rotas, payloads de exemplo, eventos WebSocket, rate limits e formato de erros RFC 7807): **[docs/API.md](./docs/API.md)**

## 🗺 Roadmap

| Fase | Escopo | Duração estimada |
|---|---|---|
| **1 — MVP Core** | Auth, banco de kanji, progresso, SRS básico, streak, meta diária, dashboard overview | Semanas 1–4 |
| **2 — Conteúdo Expandido** | Vocabulário e gramática completos, sentence mining, imersão, listas personalizadas, notificações | Semanas 5–8 |
| **3 — Experiência Premium** | WebSocket em tempo real, gamificação/marcos, jobs agendados, AI Tutor, painel admin, analytics | Semanas 9–12 |
| **4 — Produção** | Camada de cache Redis, rate limiting, testes unitários/e2e, Docker + CI/CD, monitoramento, hardening de segurança | Semanas 13–16 |

**Pontos de atenção para as próximas fases:**

- ⏰ **Timezone** — todos os resets de meia-noite (streak, meta diária) devem ser calculados pelo timezone do usuário, nunca em UTC.
- 🚦 **Performance da fila de SRS** — o índice `idx_ukp_review_queue` é crítico; monitorar `EXPLAIN ANALYZE` em produção.
- 🔐 **Rotação de refresh token** — detectar reuso de token (indício de roubo) e revogar todos os tokens do usuário nesse caso.
- 🧮 **Consistência de dados** — atualizações de progresso + resposta de SRS devem ser sempre transacionais.
- 🤖 **Custo do AI Tutor** — limitar chamadas (10 msg/min por usuário) e cachear respostas para perguntas comuns.
- 🌱 **Seed de dados** — importar os 2.136 kanjis (KANJIDIC2), stroke order (KanjiVG) e vocabulário (JMdict) antes do lançamento.

## 📚 Documentação

Documentação detalhada vive em [`/docs`](./docs), separada por tema para facilitar navegação e manutenção:

| Documento | Conteúdo |
|---|---|
| [**ARCHITECTURE.md**](./docs/ARCHITECTURE.md) | Diagrama de arquitetura, fluxo de revisão SRS, algoritmo SM-2, eventos, jobs agendados, WebSocket, casos de uso |
| [**API.md**](./docs/API.md) | Referência completa de todas as rotas REST, payloads, rate limiting, erros RFC 7807 |
| [**DATABASE.md**](./docs/DATABASE.md) | Modelagem completa das 20 entidades, índices críticos, estratégia de seed |
| [**DEPLOYMENT.md**](./docs/DEPLOYMENT.md) | Docker, CI/CD, cache Redis, filas Bull, observabilidade, backup, checklist de produção |

Documentação interativa da API (Swagger/OpenAPI) fica disponível em `/docs` com o servidor rodando localmente.

## 🤝 Contribuição

1. Crie uma branch a partir de `main`: `git checkout -b feat/nome-da-feature`
2. Siga os padrões de commit (Conventional Commits recomendado: `feat:`, `fix:`, `chore:`, `docs:`...)
3. Garanta que `pnpm lint` e `pnpm test` passam antes de abrir o PR
4. Descreva claramente o que foi alterado e por quê
5. Abra o Pull Request para revisão

> Módulos novos devem seguir o padrão de pastas descrito em [Estrutura do Projeto](#-estrutura-do-projeto): `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts` e `dto/`.

## 📄 Licença

Uso interno — projeto proprietário. Não distribuir sem autorização.

---

<div align="center">
Feito com 頑張って (ganbatte) para quem está aprendendo japonês de verdade.
</div>