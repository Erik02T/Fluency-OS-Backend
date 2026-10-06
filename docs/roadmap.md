# Roadmap — Estado das Fases

**Última atualização:** 2026-09-11

Este documento registra o estado das fases originalmente previstas. Não é um cronograma nem uma confirmação de que os itens planejados existam.

## Fase 1 — MVP Core

**Status:** PARCIAL

### Implementado

- Auth básica e health checks.
- Banco, busca, detalhe e progresso de kanji.
- SRS para kanji e vocabulário.
- Dashboard mínimo.

### Parcialmente implementado

- Streak e metas diárias.
- Dashboard expandido e operação por timezone.

### Pendente

- Rotas expandidas de dashboard, freeze, reset agendado e funcionalidades completas de usuário.

## Fase 2 — Conteúdo Expandido

**Status:** PARCIAL

### Implementado

- Vocabulário e gramática com progresso.
- Registro e consulta de imersão.

### Pendente

- Sentence Mining.
- Custom Lists.
- Notifications.
- SRS para grammar e sentences.

## Fase 3 — Experiência Premium

**Status:** PARCIAL

### Implementado

- Planner semanal, metas e tarefas.
- Analytics básico.
- CRUD administrativo de kanji, vocabulário e gramática.

### Pendente

- AI Tutor real.
- WebSocket de produto.
- Milestones e notificações.
- Jobs e filas assíncronas.
- Gestão avançada de usuários.

## Fase 4 — Produção

**Status:** PARCIAL

### Implementado

- PostgreSQL e Redis via Docker Compose de desenvolvimento.
- Rate limit Redis.
- Logs estruturados, request id e health checks.
- Testes unitários e E2E para áreas específicas.

### Pendente

- Dockerfile/compose de produção.
- CI/CD.
- Cache completo.
- Prometheus/Grafana.
- Backup e restore.
- S3/R2, SMTP e hardening operacional documentado.