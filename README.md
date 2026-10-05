# Fluency OS — Backend

Backend do Fluency OS, plataforma de aprendizagem de japonês baseada em conteúdo, progresso individual, imersão e revisão espaçada.

> **Status verificado em 2026-09-11:** o backend está em desenvolvimento. Este README descreve o código atual, não a arquitetura-alvo completa.

## Estado atual

O backend é um monólito modular NestJS com Prisma, PostgreSQL e Redis. Os módulos ativos em `src/app.module.ts` são Auth, Kanji, Vocabulary, Grammar, Immersion, Planner, Analytics, Review e Common/Health.

### Implementado e funcional

- Health checks e readiness de PostgreSQL/Redis.
- Registro, login, refresh, logout e `/auth/me`.
- Listagem, busca, detalhe, progresso e CRUD administrativo de kanji.
- Listagem, detalhe, progresso e CRUD administrativo de vocabulário.
- Listagem, detalhe, progresso e CRUD administrativo de gramática.
- Registro e consulta de logs de imersão.
- Fila, sessões, respostas, histórico e estatísticas de revisão para kanji e vocabulário.
- Algoritmo SRS SM-2 adaptado e atualização transacional de revisão.
- Dashboard mínimo em `/dashboard/summary`.
- Planner semanal, metas e tarefas.
- Analytics em `/analytics/overview`.

### Parcialmente implementado

- Refresh token: usa UUID em Redis e cookie HttpOnly, mas não implementa hash em banco, rotação ou detecção de reuso.
- Streak e metas diárias: serviços e persistência participam do fluxo de revisão, sem jobs e endpoints completos de reset, freeze e timezone.
- Dashboard expandido, eventos de domínio, cache Redis e seeds de conteúdo.
- Progresso de vocabulário: a ação de revisão não usa o `SRSService` centralizado.
- Administração: CRUD individual existe; importação em lote, gestão de usuários e métricas globais não foram encontradas.

### Não implementado

- AI Tutor real.
- Notifications, Custom Lists e Sentence Mining.
- WebSocket de produto.
- Bull, workers e jobs agendados.
- Verificação de e-mail e reset de senha.
- S3/R2, Prometheus/Grafana, CI/CD, backup automatizado e Docker de produção.
- SRS para grammar e sentences.
- Rotas expandidas do dashboard (`/overview`, `/heatmap`, `/milestones` etc.).

## Arquitetura real

```text
Frontend Next.js
        │ HTTP/JSON + Bearer JWT
        ▼
API NestJS modular
        ├── Prisma ── PostgreSQL
        └── Redis ── refresh tokens, rate limit e cache da contagem da fila
```

O código usa controllers, services, repositories, DTOs, guards, middleware de observabilidade, logs estruturados e transações Prisma. O `ReviewEventsService` registra eventos em logs; não há barramento de eventos, handlers de domínio, WebSocket ou filas Bull ativos.

## Tecnologias utilizadas

| Camada | Tecnologia comprovada no projeto |
|---|---|
| Framework | NestJS 11 |
| Linguagem | TypeScript 5.9 |
| ORM | Prisma 6 |
| Banco | PostgreSQL 16 |
| Cache/sessões | Redis 7 via ioredis |
| Auth | JWT, Passport, bcryptjs, cookies HttpOnly |
| Validação | class-validator e class-transformer |
| API | REST e Swagger/OpenAPI |
| Testes | Jest, Supertest e ts-jest |
| Execução local | Docker Compose para PostgreSQL e Redis |

Não foram encontradas no código ativo dependências ou módulos de Bull, Socket.io, S3/R2, SMTP, prom-client ou Grafana.

## Estrutura atual

```text
backend/
├── src/
│   ├── common/              # Redis, rate limit e observabilidade
│   ├── config/              # validação de ambiente
│   ├── modules/             # analytics, auth, grammar, immersion,
│   │                        # kanji, planner, review e vocabulary
│   ├── app.module.ts
│   └── main.ts
├── prisma/                  # schema e migrations
├── test/                    # testes E2E
└── docs/
```

## Execução local

Pré-requisitos: Node.js, PostgreSQL, Redis e dependências já instaladas.

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
```

O `.env.example` documenta `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `JWT_SECRET`, `JWT_REFRESH_SECRET` e `APP_PORT`. A API usa, por padrão, `http://localhost:3001`, sem prefixo global `/v1`, e o Swagger fica em `/docs`.

## Documentação

- [PROJECT_STATUS.md](../PROJECT_STATUS.md): estado consolidado do projeto.
- [API](./docs/api.md): rotas ativas e rotas ausentes por área.
- [Arquitetura](./docs/architecture.md): arquitetura efetivamente implementada e diferenças para o alvo.
- [Banco de dados](./docs/database.md): schema atual, migrations e limitações verificadas.
- [Deployment](./docs/deployment.md): recursos operacionais existentes e itens apenas planejados.
- [Spec original](./fluency-os-backend-spec.md): preservado como documento histórico e de requisitos.

## Histórico

A fundação registrada em `CHANGELOG.md` inclui NestJS, Prisma, PostgreSQL, autenticação, Docker Compose e ferramentas de qualidade. As migrations posteriores adicionaram vocabulário e planner. O status detalhado e as divergências conhecidas estão em [PROJECT_STATUS.md](../PROJECT_STATUS.md).

## Licença

Uso interno — projeto proprietário.