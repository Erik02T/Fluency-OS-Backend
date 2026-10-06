# PROJECT STATUS

**Última atualização:** 2026-09-11

## Estado atual

O Fluency OS é um sistema de aprendizagem de japonês com frontend Next.js e backend NestJS/Prisma. O estado atual está além da fundação inicial registrada no changelog: autenticação básica, conteúdo de kanji/vocabulário/gramática, imersão, revisão SRS, planner, analytics e dashboard mínimo possuem implementação no código ativo. Recursos premium e operacionais previstos na especificação original continuam ausentes ou parciais.

A classificação abaixo é baseada nos módulos importados em `backend/src/app.module.ts`, controllers, services, schema, migrations, frontend clients e testes existentes. Não foi encontrada evidência suficiente de uma execução recente completa do sistema em ambiente real.

## Resumo do progresso

| Área | Status | Evidência resumida |
|---|---|---|
| Arquitetura | PARCIAL | Monólito modular NestJS ativo; arquitetura orientada a eventos e WebSocket descrita, mas não implementada integralmente |
| Backend | PARCIAL | Auth, Kanji, Vocabulary, Grammar, Immersion, Planner, Analytics e Review ativos |
| Frontend | PARCIAL | Páginas e clients para os módulos ativos; AI Tutor é placeholder e existem telas sem backend correspondente |
| Banco de dados | IMPLEMENTADO | Prisma, PostgreSQL, 31 models no schema e 7 migrations |
| Autenticação | PARCIAL | JWT, cookies HttpOnly e Redis funcionam no fluxo testado; refresh não tem hash, rotação ou detecção de reuso conforme especificação |
| APIs | PARCIAL | Rotas dos módulos ativos existem; rotas de Users, Notifications, Lists, Sentences e AI não existem |
| Integrações | PARCIAL | PostgreSQL, Redis, frontend HTTP e Swagger; sem Bull, WebSocket, S3/R2, SMTP ou provedor de IA |
| Testes | PARCIAL | Unitários e E2E relevantes; ausência de E2E para Planner/Analytics e validação operacional completa |
| Documentação | IMPLEMENTADO | Documentos revisados nesta atualização; spec original preservado como histórico com status corrigido |

## Funcionalidades implementadas

- Health checks: `/`, `/health/live`, `/health` e `/health/ready`.
- Registro, login, refresh, logout e `/auth/me`.
- CRUD público/admin de kanji e progresso individual.
- Listagem, detalhe, progresso e administração de vocabulário.
- Listagem, detalhe, progresso e administração de gramática.
- Registro e consulta paginada de imersão.
- Fila e sessões SRS para kanji e vocabulário.
- Algoritmo SM-2 adaptado com atualização transacional de progresso e resposta.
- Dashboard mínimo em `/dashboard/summary`.
- Planner de planos semanais, metas e tarefas.
- Analytics em `/analytics/overview`.
- Frontend das áreas principais e proteção de rotas administrativas.

## Funcionalidades parcialmente implementadas

- Refresh token seguro: UUID em Redis por 7 dias, sem hash no modelo `RefreshToken`, rotação ou detecção de reuso.
- Streak e metas diárias: serviços e persistência são usados no fluxo de revisão, mas não existem jobs, endpoints completos, freeze ou reset por timezone.
- Dashboard expandido: frontend e analytics existem, mas as rotas documentadas de overview/heatmap/milestones não existem.
- Analytics: endpoint e agregações existem, sem job de agregação e sem E2E específico.
- Progresso de vocabulário: ação de revisão não utiliza o `SRSService` centralizado.
- Eventos: `ReviewEventsService` registra logs; não existem barramento e handlers de domínio.
- Redis/cache: tokens, rate limit e contagem da fila existem; as camadas de cache documentadas não estão completas.
- Seeds: KANJIDIC2 e JMdict existem; não foram encontradas as demais fontes documentadas.
- Administração: CRUD individual existe; importação em lote, usuários e métricas globais não.

## Funcionalidades pendentes

- AI Tutor real e endpoints `/ai/*`.
- Notifications e Custom Lists.
- Sentence Mining.
- WebSocket de produto.
- Bull, workers e jobs agendados.
- Verificação de e-mail e reset de senha.
- S3/R2 para mídia.
- Prometheus, Grafana e endpoint `/metrics`.
- CI/CD e deploy Docker de produção.
- Backup automatizado e restore testado.
- Módulo de usuários e preferências exposto por API.
- SRS para grammar e sentences.
- Rotas expandidas do dashboard.

## Inconsistências conhecidas

- A especificação original ainda contém status de release anterior, enquanto o `AppModule` atual já inclui Review, Vocabulary, Grammar, Immersion, Planner e Analytics.
- README histórico, API e código divergem quanto a porta, prefixo `/v1` e versões do framework.
- A documentação de auth descreve refresh hash/30 dias/rotação; o código usa Redis/7 dias/sem rotação.
- `docs/database.md` declara 20 entidades; o schema atual contém 31 models.
- Deployment documenta Dockerfile de produção, Bull, métricas, backups e Grafana que não foram encontrados.
- O frontend possui página de AI Tutor, mas responde com texto fixo local.

## Situação das fases

| Fase | Status | Observações |
|---|---|---|
| Fase 1 — MVP Core | PARCIAL | Auth, kanji, progresso, SRS, dashboard mínimo e parte de streak/metas existem; dashboard expandido e operação por timezone não estão completos |
| Fase 2 — Conteúdo Expandido | PARCIAL | Vocabulary, Grammar e Immersion existem; Sentence Mining, Lists e Notifications não existem |
| Fase 3 — Experiência Premium | PARCIAL | Planner e Analytics existem; AI, WebSocket, milestones, jobs e notificações não existem |
| Fase 4 — Produção | PARCIAL | PostgreSQL, Redis, health checks, logs estruturados e rate limit existem; CI/CD, métricas, cache completo, Docker de produção e hardening documentado não existem |

## Histórico resumido

- **2026-07-01:** changelog registra a fundação NestJS, Prisma, PostgreSQL, autenticação, Docker Compose e ferramentas de qualidade.
- **2026-06 a 2026-08:** migrations registram evolução do schema, adição de vocabulário e planner.
- **Estado atual:** os módulos ativos excedem o status descrito na especificação inicial, mas os recursos premium e operacionais permanecem incompletos.
