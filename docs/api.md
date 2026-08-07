# API Reference

[<- Voltar ao README](../README.md) · [Architecture](./architecture.md) · [Database](./database.md) · [Deployment](./deployment.md)

## Objetivo deste documento

Este arquivo descreve o estado da API por release, separando com clareza o que ja esta ativo no codigo e o que ainda esta em evolucao.

Fonte de verdade para status Implementado:

- modulos importados em src/app.module.ts
- controllers e rotas existentes em src/

## Legenda de status

| Status | Significado |
| --- | --- |
| Implementado | Existe no codigo ativo da release atual |
| Em desenvolvimento | Parte do escopo atual, mas com cobertura parcial no codigo |
| Planejado/Futuro | Especificacao de produto/arquitetura, ainda sem rota ativa |

## Estado atual da release

| Area | Status | Evidencia no codigo |
| --- | --- | --- |
| Auth | Implementado | modulo ativo em app.module.ts + AuthController |
| Kanji (publico) | Implementado | modulo ativo em app.module.ts + KanjiController |
| Kanji (admin) | Implementado | modulo ativo em app.module.ts + AdminKanjiController |
| Dashboard (resumo minimo) | Implementado | DashboardSummaryController |
| Health/Liveness/Readiness | Implementado | AppController + AppService |
| Dashboard expandido (overview/heatmap/milestones) | Em desenvolvimento | apenas /dashboard/summary ativo |
| Users, Review, Vocabulary, Grammar, Immersion, Lists, Notifications, AI Tutor, WebSocket publico de produto | Planejado/Futuro | sem modulos ativos no AppModule atual |

## Implementado

### Convencoes operacionais

| Convencao | Valor atual |
| --- | --- |
| Host local padrao | http://localhost:3001 |
| Prefixo global de rota | nenhum |
| Swagger | /docs |
| Auth header | Authorization: Bearer <access_token> |
| Sessao de refresh | Cookie HttpOnly fluency-admin-refresh-token |
| Content-Type | application/json |

### Health

| Metodo | Rota | Observacao |
| --- | --- | --- |
| GET | / | endpoint basico da aplicacao |
| GET | /health/live | liveness |
| GET | /health | readiness (DB + Redis) |
| GET | /health/ready | readiness (DB + Redis) |

### Auth

| Metodo | Rota | Observacao |
| --- | --- | --- |
| POST | /auth/register | cria usuario e retorna accessToken + user |
| POST | /auth/login | autentica e retorna accessToken + user |
| POST | /auth/refresh | renova accessToken por body token ou cookie |
| POST | /auth/logout | invalida refresh token |
| GET | /auth/me | requer JWT Bearer |

#### Exemplo de contrato ativo: POST /auth/login

```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "role": "ADMIN"
  }
}
```

Observacoes:

- refresh token nao e retornado no payload JSON
- refresh token e mantido em cookie HttpOnly

### Kanji (publico)

| Metodo | Rota | Observacao |
| --- | --- | --- |
| GET | /kanji | lista paginada com filtros |
| GET | /kanji/search | busca por query string (q, limit) |
| GET | /kanji/search/:query | rota legada mantida por compatibilidade |
| GET | /kanji/:id | detalhe completo |

### Kanji (admin)

Todas as rotas abaixo exigem JWT + role ADMIN.

| Metodo | Rota | Observacao |
| --- | --- | --- |
| GET | /admin/kanjis | lista administrativa |
| POST | /admin/kanjis | cria kanji |
| PUT | /admin/kanjis/:id | atualiza kanji |
| DELETE | /admin/kanjis/:id | remove kanji |

### Dashboard minimo

| Metodo | Rota | Observacao |
| --- | --- | --- |
| GET | /dashboard/summary | resumo real do usuario autenticado |

Campos atualmente retornados:

- kanjiStudied
- kanjiMastered
- dueReviews
- favoriteKanjis
- totalReviews
- accuracyRate
- currentStreak
- longestStreak
- lastReviewAt

## Em desenvolvimento

As rotas abaixo fazem parte do escopo funcional ja mapeado, mas nao estao ativas nesta release.

### Dashboard expandido

| Metodo | Rota | Status |
| --- | --- | --- |
| GET | /dashboard/overview | nao implementado nesta release |
| GET | /dashboard/streak | nao implementado nesta release |
| GET | /dashboard/daily-goal | nao implementado nesta release |
| GET | /dashboard/heatmap | nao implementado nesta release |
| GET | /dashboard/recent-activity | nao implementado nesta release |
| GET | /dashboard/milestones | nao implementado nesta release |

## Planejado/Futuro

As secoes abaixo permanecem como alvo de produto e arquitetura, sem rotas ativas no AppModule atual:

- Users
- Review (SRS sessions)
- Vocabulary
- Grammar
- Immersion
- Sentence Mining
- Notifications
- Custom Lists
- AI Tutor
- WebSocket de eventos de produto

## Regra de governanca da documentacao

Ao final de cada release:

1. confirmar modulos ativos em src/app.module.ts
2. confirmar rotas ativas em controllers dos modulos ativos
3. atualizar este arquivo movendo itens entre Implementado, Em desenvolvimento e Planejado/Futuro
4. evitar marcar como Implementado qualquer rota sem controller ativo
