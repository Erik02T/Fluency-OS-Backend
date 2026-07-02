# 🔌 API Reference

[← Voltar ao README](../README.md) · [Architecture](./ARCHITECTURE.md) · [Database](./DATABASE.md) · [Deployment](./DEPLOYMENT.md)

## Convenções

| Convenção | Valor |
|---|---|
| Base URL | `https://api.fluencyos.app/v1` |
| Auth header | `Authorization: Bearer <access_token>` |
| Content-Type | `application/json` |
| Versionamento | Path da URL (`/v1`, `/v2`) |
| Paginação | Cursor-based (`next_cursor`, `prev_cursor`, `limit`) |
| Timestamps | ISO 8601 UTC (`2024-01-15T10:30:00Z`) |
| Erros | [RFC 7807 — Problem Details](https://www.rfc-editor.org/rfc/rfc7807) |

Documentação interativa (Swagger/OpenAPI) disponível em `/docs` com o servidor rodando.

## Auth

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cadastro de novo usuário |
| `POST` | `/auth/login` | Login com e-mail/senha |
| `POST` | `/auth/logout` | Revoga refresh token |
| `POST` | `/auth/refresh` | Renova access token (com rotação) |
| `POST` | `/auth/forgot-password` | Solicita reset de senha |
| `POST` | `/auth/reset-password` | Confirma reset com token |
| `POST` | `/auth/verify-email` | Verifica e-mail com código |
| `GET` | `/auth/me` | Dados do usuário autenticado |

<details>
<summary><strong>POST /auth/register</strong></summary>

```jsonc
// Request
{
  "email": "user@example.com",
  "username": "estudante_jp",
  "password": "minimo8chars",
  "display_name": "Tanaka Studies",
  "jlpt_level": "N5",
  "timezone": "America/Sao_Paulo"
}

// Response 201
{
  "user": { /* ...UserPublic */ },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900
}
```

Erros: `409` e-mail já cadastrado · `409` username já em uso · `422` validação falhou
</details>

<details>
<summary><strong>POST /auth/login</strong></summary>

```jsonc
// Request
{ "email": "user@example.com", "password": "senha123" }

// Response 200
{
  "user": { /* ...UserPublic */ },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900
}
```

Erros: `401` credenciais inválidas · `403` e-mail não verificado · `429` rate limit (5 tentativas/min)
</details>

## Users

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/users/me` | Perfil completo |
| `PATCH` | `/users/me` | Atualiza perfil |
| `GET` | `/users/me/preferences` | Preferências |
| `PATCH` | `/users/me/preferences` | Atualiza preferências |
| `GET` | `/users/me/stats` | Estatísticas gerais |
| `GET` | `/users/me/activity` | Histórico de atividade (heatmap) |
| `POST` | `/users/me/avatar` | Upload de avatar |

## Kanji

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/kanji` | Lista com filtros e paginação |
| `GET` | `/kanji/:id` | Detalhe completo |
| `GET` | `/kanji/:id/examples` | Exemplos de palavras |
| `GET` | `/kanji/:id/radicals` | Radicais do kanji |
| `GET` | `/kanji/search` | Busca full-text |
| `GET` | `/kanji/by-character/:char` | Busca por caractere exato |
| `GET` | `/kanji/me` | Kanjis do usuário (com progresso) |
| `GET` | `/kanji/me/stats` | Estatísticas do usuário |
| `GET` | `/kanji/me/due` | Fila de revisão |
| `GET` | `/kanji/me/mastered` | Kanjis dominados |
| `GET` | `/kanji/me/favorites` | Kanjis favoritos |
| `POST` | `/kanji/:id/add` | Adiciona ao progresso |
| `POST` | `/kanji/:id/favorite` | Favorita/desfavorita |
| `POST` | `/kanji/:id/suspend` | Suspende/retoma revisão |
| `DELETE` | `/kanji/:id/remove` | Remove do progresso |

**Query params de `GET /kanji`**: `jlpt`, `mastered`, `favorited`, `search`, `grade`, `frequency_max`, `page_size` (máx. 200), `cursor`, `sort` (`frequency|jlpt|srs_level|mastered`), `order`.

## Review

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/review/queue` | Fila de revisão do dia |
| `GET` | `/review/queue/count` | Contagem da fila |
| `POST` | `/review/sessions` | Inicia nova sessão |
| `GET` | `/review/sessions/:id` | Dados da sessão |
| `POST` | `/review/sessions/:id/answer` | Registra resposta de um item |
| `POST` | `/review/sessions/:id/end` | Encerra a sessão |
| `GET` | `/review/sessions/history` | Histórico de sessões |
| `GET` | `/review/sessions/:id/stats` | Estatísticas da sessão |

<details>
<summary><strong>POST /review/sessions/:id/answer</strong></summary>

```jsonc
// Request
{
  "item_id": "kanji-uuid",
  "item_type": "kanji",
  "answer_quality": 2, // 0=falhou 1=difícil 2=ok 3=fácil
  "response_time_ms": 3200
}

// Response 200
{
  "previous_srs_level": 3,
  "new_srs_level": 4,
  "previous_interval": 8,
  "new_interval": 21,
  "next_review_at": "2024-02-05T00:00:00Z",
  "is_mastered": false,
  "session_progress": { "reviewed": 15, "total": 42, "correct": 12, "incorrect": 3 }
}
```
</details>

## Dashboard

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/dashboard/overview` | Todos os dados do home dashboard |
| `GET` | `/dashboard/streak` | Streak atual e histórico |
| `GET` | `/dashboard/daily-goal` | Meta diária do dia |
| `GET` | `/dashboard/heatmap` | Heatmap de atividade (365 dias) |
| `GET` | `/dashboard/recent-activity` | Atividades recentes |
| `GET` | `/dashboard/milestones` | Marcos atingidos e próximos |

## Vocabulary

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/vocabulary` | Lista com filtros |
| `GET` | `/vocabulary/:id` | Detalhe |
| `GET` | `/vocabulary/me` | Vocabulário do usuário |
| `GET` | `/vocabulary/me/due` | Fila de revisão |
| `POST` | `/vocabulary/:id/add` | Adiciona ao progresso |
| `POST` | `/vocabulary/:id/favorite` | Favorita |
| `POST` | `/vocabulary/import` | Importa lista de palavras |

## Grammar

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/grammar` | Lista pontos gramaticais |
| `GET` | `/grammar/:id` | Detalhe completo |
| `GET` | `/grammar/me` | Gramática com progresso |
| `GET` | `/grammar/:id/examples` | Exemplos de uso |
| `GET` | `/grammar/:id/related` | Gramáticas relacionadas |

## Immersion

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/immersion/logs` | Logs de imersão |
| `POST` | `/immersion/logs` | Registra nova sessão |
| `GET` | `/immersion/logs/:id` | Detalhe de um log |
| `PATCH` | `/immersion/logs/:id` | Atualiza um log |
| `DELETE` | `/immersion/logs/:id` | Remove um log |
| `GET` | `/immersion/stats` | Estatísticas de imersão |

## Sentence Mining

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/sentences` | Frases do usuário |
| `POST` | `/sentences` | Cria nova frase minada |
| `GET` | `/sentences/:id` | Detalhe |
| `PATCH` | `/sentences/:id` | Atualiza |
| `DELETE` | `/sentences/:id` | Remove |
| `POST` | `/sentences/:id/favorite` | Favorita |
| `POST` | `/sentences/:id/review` | Marca como revisada |

## Notifications

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/notifications` | Lista notificações |
| `PATCH` | `/notifications/:id/read` | Marca como lida |
| `PATCH` | `/notifications/read-all` | Marca todas como lidas |
| `DELETE` | `/notifications/:id` | Remove |
| `GET` | `/notifications/unread-count` | Contagem de não lidas |

## Custom Lists

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/lists` | Listas do usuário |
| `POST` | `/lists` | Cria nova lista |
| `GET` | `/lists/:id` | Detalhe |
| `PATCH` | `/lists/:id` | Atualiza |
| `DELETE` | `/lists/:id` | Remove |
| `GET` | `/lists/:id/items` | Itens da lista |
| `POST` | `/lists/:id/items` | Adiciona item |
| `DELETE` | `/lists/:id/items/:itemId` | Remove item |
| `PATCH` | `/lists/:id/items/reorder` | Reordena itens |

## AI Tutor

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/ai/chat` | Mensagem para o AI Tutor |
| `GET` | `/ai/chat/:sessionId` | Histórico de uma conversa |
| `POST` | `/ai/explain` | Explica kanji/palavra/gramática |
| `POST` | `/ai/generate-examples` | Gera exemplos para um item |
| `POST` | `/ai/correct` | Corrige texto em japonês |
| `POST` | `/ai/translate` | Traduz japonês → português |

> Rate limit: **10 mensagens/minuto** por usuário. Respostas de perguntas comuns são cacheadas.

## Admin (`role: admin`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/kanjis` | Gerenciar banco de kanjis |
| `POST` | `/admin/kanjis` | Criar kanji |
| `PUT` | `/admin/kanjis/:id` | Atualizar kanji completo |
| `DELETE` | `/admin/kanjis/:id` | Remover kanji |
| `POST` | `/admin/kanjis/import` | Importar em lote (JSON/CSV) |
| `GET` | `/admin/users` | Listar usuários |
| `GET` | `/admin/users/:id` | Detalhe de um usuário |
| `PATCH` | `/admin/users/:id` | Editar papel/status |
| `GET` | `/admin/stats` | Estatísticas globais |

## Rate Limiting

| Rota | Limite |
|---|---|
| `POST /auth/login` | 5 req/min por IP |
| `POST /auth/register` | 3 req/min por IP |
| `POST /auth/forgot-password` | 3 req/10min por e-mail |
| `GET /kanji` | 100 req/min por usuário |
| `POST /review/*` | 200 req/min por usuário |
| `POST /ai/chat` | 10 req/min por usuário |
| Default | 60 req/min por usuário |

## Formato de Erros (RFC 7807)

```jsonc
// 400 Bad Request
{
  "type": "https://api.fluencyos.app/errors/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "O campo 'jlpt_level' deve ser N5, N4, N3, N2 ou N1",
  "instance": "/v1/kanji",
  "errors": [{ "field": "jlpt_level", "message": "Valor inválido" }]
}

// 401 Unauthorized
{
  "type": "https://api.fluencyos.app/errors/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Token de acesso expirado ou inválido"
}

// 404 Not Found
{
  "type": "https://api.fluencyos.app/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Kanji com ID 'abc123' não encontrado"
}

// 429 Too Many Requests
{
  "type": "https://api.fluencyos.app/errors/rate-limit",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Limite de 100 requisições por minuto atingido",
  "retry_after": 30
}
```

## WebSocket — `/realtime`

| Evento (servidor → cliente) | Payload | Quando |
|---|---|---|
| `review_queue_updated` | `{ new_count }` | Novo item na fila |
| `notification_received` | `{ id, type, title, message }` | Nova notificação |
| `streak_updated` | `{ current, longest, wasNewRecord }` | Streak muda |
| `daily_goal_progress` | `{ actual_minutes, goal_minutes, percentage }` | Progresso da meta muda |
| `milestone_achieved` | `{ type, value, title, description }` | Marco atingido |
| `session_sync` | `{ reviewed_count, accuracy, remaining }` | Resposta salva |

## Health & Métricas

| Rota | Descrição |
|---|---|
| `GET /health` | `{ status, database, redis }` |
| `GET /health/live` | Liveness probe (Kubernetes) |
| `GET /health/ready` | Readiness probe |
| `GET /metrics` | Métricas Prometheus |