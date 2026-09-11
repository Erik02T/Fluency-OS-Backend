# API — Estado Atual

**Última verificação:** 2026-09-11  
**Fonte operacional:** `src/app.module.ts` e controllers existentes.

## Convenções

| Item | Estado atual |
|---|---|
| Host local padrão | `http://localhost:3001` |
| Prefixo global | Nenhum |
| Swagger | `/docs` |
| Autenticação | `Authorization: Bearer <access_token>` |
| Refresh | Cookie HttpOnly `fluency-admin-refresh-token` ou body |
| Formato | `application/json` |

## Resumo por área

| Área | Status | Evidência |
|---|---|---|
| Health | IMPLEMENTADO | `AppController` |
| Auth | IMPLEMENTADO | `AuthController` |
| Kanji público/admin | IMPLEMENTADO | `KanjiController` e `AdminKanjiController` |
| Dashboard mínimo | IMPLEMENTADO | `DashboardSummaryController` |
| Review SRS | IMPLEMENTADO para kanji/vocabulário | `ReviewController` e `ReviewService` |
| Vocabulary | IMPLEMENTADO | `VocabularyController` e `AdminVocabularyController` |
| Grammar | IMPLEMENTADO | `GrammarController` e `AdminGrammarController` |
| Immersion | IMPLEMENTADO | `ImmersionController` |
| Planner | IMPLEMENTADO | `PlannerController` |
| Analytics | PARCIAL | `AnalyticsController`; sem E2E específico e sem job de agregação |
| Dashboard expandido | NÃO IMPLEMENTADO | sem controllers para overview/heatmap/milestones |
| Notifications, Lists, Sentences, AI, WebSocket | NÃO IMPLEMENTADO | sem módulos/controllers ativos |

## Rotas ativas

### Health

`GET /`, `GET /health/live`, `GET /health`, `GET /health/ready`.

### Auth

`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.

O payload JSON de registro/login contém `accessToken` e usuário público. O refresh token não é retornado no JSON. A implementação atual usa UUID armazenado no Redis por 7 dias; não há hash em banco, rotação ou detecção de reuso.

### Kanji

`GET /kanji`, `GET /kanji/search`, `GET /kanji/search/:query`, `GET /kanji/:id`, `POST /kanji/:id/progress`.

Admin: `GET /admin/kanjis`, `POST /admin/kanjis`, `PUT /admin/kanjis/:id`, `DELETE /admin/kanjis/:id`.

### Vocabulary

`GET /vocabulary`, `GET /vocabulary/:id`, `POST /vocabulary/:id/progress`.

Admin: `GET /admin/vocabularies`, `POST /admin/vocabularies`, `PUT /admin/vocabularies/:id`, `DELETE /admin/vocabularies/:id`.

### Grammar

`GET /grammar`, `GET /grammar/:id`, `POST /grammar/:id/progress`.

Admin: `GET /admin/grammar-points`, `POST /admin/grammar-points`, `PUT /admin/grammar-points/:id`, `DELETE /admin/grammar-points/:id`.

### Immersion

`POST /immersion`, `GET /immersion`.

### Planner

`GET /planner/overview`, `GET /planner/summary/today`, `GET /planner/week`, `PUT /planner/weeks/:id/goals`, `PATCH /planner/weeks/:id`, `POST /planner/tasks`, `GET /planner/tasks`, `PATCH /planner/tasks/:id`, `DELETE /planner/tasks/:id`, `PATCH /planner/tasks/:id/complete`.

### Analytics

`GET /analytics/overview`.

### Review

`GET /review/queue`, `GET /review/queue/count`, `POST /review/sessions`, `GET /review/sessions/history`, `GET /review/sessions/:id/stats`, `GET /review/sessions/:id`, `POST /review/sessions/:id/answer`, `POST /review/sessions/:id/end`, `POST /review/sessions/:id/abandon`.

O SRS completo está implementado apenas para `kanji` e `vocabulary`. `grammar`, `sentence` e `mixed` são rejeitados pelo serviço.

## Rotas ausentes

Não foram encontrados controllers ativos para:

- `/users/*`
- `/dashboard/overview`, `/dashboard/streak`, `/dashboard/daily-goal`, `/dashboard/heatmap`, `/dashboard/recent-activity`, `/dashboard/milestones`
- `/sentences/*`
- `/notifications/*`
- `/lists/*`
- `/ai/*`
- WebSocket `/realtime`
- importação administrativa em lote e `/admin/stats`

## Testes relacionados

Existem testes unitários e E2E para Auth, Kanji, Vocabulary, Grammar, Immersion e Review. Existem testes de client para Planner e alguns clients de frontend. Não foi encontrada cobertura E2E específica para Planner, Analytics, dashboard expandido ou integração browser completa.

## Referência histórica

O spec original contém contratos de produto para rotas ainda não ativas. Esses contratos devem ser lidos como requisitos/plano, não como evidência de implementação.