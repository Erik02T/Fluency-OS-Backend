# SRS Review System — Documentação Completa

## 1. Visão Geral da Arquitetura de Revisão

O sistema de revisão espaçada (SRS — Spaced Repetition System) do **Fluency OS** é baseado no algoritmo SM-2 adaptado, centralizado no `SRSService`. O objetivo é otimizar a retenção de longo prazo para **Kanji** e **Vocabulário**, calculando intervalos crescentes baseados na qualidade da resposta do usuário.

```
       +-------------------------------------------------------------+
       |                     KANJI / VOCABULÁRIO                     |
       +-------------------------------------------------------------+
                                      |
                      +---------------+---------------+
                      |                               |
              [Ação: "study"]                 [Ação: "review"]
                      |                               |
           Cria/ativa progresso            Força nextReviewAt = now
           (srsLevel 1, amanhã)            (entra na fila imediatamente)
                      |                               |
                      +---------------+---------------+
                                      |
                                      v
                        +---------------------------+
                        |   FILA DE REVISÃO (SRS)   |
                        | (GET /review/queue vencidos)|
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        |     INICIAR SESSÃO        |
                        |   (POST /review/sessions)  |
                        |  session_type: kanji/vocab|
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        |      CARD DE REVISÃO      |
                        |  Prompt -> Mostrar Resposta|
                        |   Botões BOM / RUIM       |
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        |    REGISTRAR RESPOSTA     |
                        | (POST /sessions/:id/answer)|
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        |      SRSService SM-2      |
                        |  Calcula nível, intervalo,|
                        |   ease factor e nextReview |
                        +---------------------------+
                                      |
                                      v
             +-------------------------------------------------+
             |              TRANSAÇÃO ATÔMICA                  |
             |  prisma.$transaction:                           |
             |   1. Atualiza User(Kanji|Vocab)Progress         |
             |   2. Cria ReviewAnswer                          |
             |   3. Incrementa ReviewSession counters          |
             |   4. StreakService.recordActivity               |
             |   5. DailyGoalService.recordReviewProgress      |
             |   6. Dispara ReviewEventsService (event-emitter)|
             |   7. Invalida cache de contagem no Redis        |
             +-------------------------------------------------+
                                      |
                                      v
                        +---------------------------+
                        |     AVANÇO AUTOMÁTICO     |
                        |  Frontend avança próximo  |
                        |   card sem recarregar     |
                        +---------------------------+
                                      |
                                      v
                        +---------------------------+
                        |     CONCLUIR SESSÃO       |
                        |  (POST /sessions/:id/end)  |
                        |  Métricas, acurácia, tempo |
                        +---------------------------+
```

---

## 2. Algoritmo SRS (SM-2 Adaptado)

O algoritmo SRS reside exclusivamente no backend (`SRSService`), que atua como autoridade única sobre o cálculo de repetições:

### Qualidades de Resposta

| Ação UX Frontend | Qualidade SRS (0-3) | Enum Prisma | Efeito no Algoritmo |
|---|---|---|---|
| **RUIM** (blackout / não lembrou) | `0` | `BLACKOUT` | Nível recua (`max(0, srsLevel - 1)`), intervalo resetado para **1 dia**, `easeFactor` reduzido |
| **RUIM** (errou / incorreto) | `1` | `WRONG` | Nível mantém, intervalo leve (`intervalDays * 1.2`), `easeFactor -= 0.15` |
| **BOM** (lembrou com esforço) | `2` | `CORRECT_HARD` | Nível sobe (`srsLevel + 1`), intervalo `intervalDays * easeFactor` |
| **BOM** (fácil / imediato) | `3` | `CORRECT_EASY` | Nível sobe (`srsLevel + 1`), intervalo `intervalDays * easeFactor * 1.3`, `easeFactor += 0.10` |

### Parâmetros & Fórmulas
- **Ease Factor Padrão**: `2.50` (mínimo: `1.30`)
- **Fórmula de Ease Factor**: `EF' = EF + (0.1 - (3 - Q) * (0.08 + (3 - Q) * 0.02))`
- **Crescimento de Intervalo**:
  - Repetição 1: `1 dia`
  - Repetição 2: `6 dias`
  - Repetição $n$ ($n > 2$): `Intervalo(n-1) * EF`
- **Critério de Domínio (Mastered)**: `srsLevel >= 5` (`isMastered = true`, `masteredAt = now`).

---

## 3. Endpoints da API

Todas as rotas requerem cabeçalho `Authorization: Bearer <access_token>`.

### Fila e Contagem

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/review/queue` | Retorna itens vencidos (`nextReviewAt <= now`) agrupados por tipo (`kanji`, `vocabulary`) |
| `GET` | `/review/queue/count` | Retorna contagem rápida total e discriminada por tipo (com cache Redis TTL 60s) |

### Sessões de Revisão

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/review/sessions` | Inicia sessão (`{ session_type: "kanji" \| "vocabulary" }`) |
| `GET` | `/review/sessions/:id` | Obtém o estado atual da sessão |
| `POST` | `/review/sessions/:id/answer` | Registra uma resposta SRS atômica |
| `POST` | `/review/sessions/:id/end` | Encerra a sessão e calcula precisão e duração |
| `POST` | `/review/sessions/:id/abandon` | Abandona a sessão preservando respostas processadas |
| `GET` | `/review/sessions/history` | Histórico paginado de revisões do usuário |
| `GET` | `/review/sessions/:id/stats` | Estatísticas detalhadas da sessão |

### Progresso Individual de Itens

| Método | Rota | Payload | Descrição |
|---|---|---|---|
| `POST` | `/kanji/:id/progress` | `{ "action": "study" \| "review" }` | Cria progresso de kanji ou o envia imediatamente à fila |
| `POST` | `/vocabulary/:id/progress` | `{ "action": "study" \| "review" }` | Cria progresso de vocabulário ou o envia imediatamente à fila |

---

## 4. Integrações Atômicas e Gamificação

Ao responder cada item (`POST /review/sessions/:id/answer`), as seguintes operações ocorrem dentro de uma mesma transação Prisma:

1. **`UserKanjiProgress` / `UserVocabularyProgress`**:
   - `srsLevel`, `easeFactor`, `intervalDays`, `nextReviewAt`, `lastReviewAt` atualizados conforme SM-2.
   - Incremento de `totalReviews` e `correctReviews`.
   - Marcação automática de `isMastered = true` quando `srsLevel >= 5`.
2. **`ReviewAnswer`**:
   - Registro de histórico da resposta com tempo de resposta (`responseTimeMs`), qualidade (`0..3`), e tipo do item.
3. **`ReviewSession`**:
   - Incremento de `completedItems`, `correctCount`, `wrongCount` e cálculo dinâmico da precisão.
4. **`StreakService.recordActivity`**:
   - Atualiza `currentStreak`, `longestStreak`, `totalActiveDays` e salva registro diário em `StreakHistory`.
5. **`DailyGoalService.recordReviewProgress`**:
   - Incrementa contadores de metas diárias (`completedKanji`, `completedVocab`, `completedReviews`).
6. **`ReviewEventsService`**:
   - Emite eventos desacoplados para analytics e notificações (`KANJI_REVIEWED`, `KANJI_MASTERED`, `SESSION_COMPLETED`).
7. **Cache Redis**:
   - Invalidação automática das chaves de cache `review:queue:count:<userId>`.

---

## 5. Implementação no Frontend

### Fluxo de Usuário
1. **TopBar & Sidebar**:
   - Badge na barra superior busca `GET /review/queue/count` e exibe contador real de cards pendentes.
   - Acesso rápido à revisão e ao assistente via Sidebar e Command Palette (`Cmd+K` / `Ctrl+K`).
2. **Página de Revisão (`/dashboard/review`)**:
   - **Visualização Inicial da Fila**: exibe cards estatísticos divididos por tipo (Kanji / Vocabulário) com botões para iniciar a sessão específica.
   - **Sessão Ativa**: renderiza flashcard interativo com pergunta (Kanji ou Vocabulário com leituras/significados ocultos).
   - **Avanço Automático**: após o usuário classificar o card (BOM / RUIM), o frontend envia a resposta, atualiza a barra de progresso local e avança suavemente para o próximo card.
   - **Tela de Resultados**: ao finalizar todos os cards, finaliza a sessão via `POST /review/sessions/:id/end` e renderiza estatísticas completas (taxa de acerto, tempo decorrido, itens dominados).
3. **Hub de Estudo (`/dashboard/study`)**:
   - Lista todos os kanjis e vocabulários marcados para estudo pelo usuário, exibindo barras de progresso SRS individuais e status de maestria.
4. **Páginas de Exploração (Kanji e Vocabulário)**:
   - Botões "Estudar" e "Revisar" integrados que acionam `POST /:id/progress` e redirecionam intuitivamente para os módulos de estudo e revisão.

---

## 6. Cobertura de Testes

- **Backend**:
  - `src/modules/review/services/srs.service.spec.ts` — cálculos matemáticos de intervalos, fatores de facilidade e limites.
  - `src/modules/review/services/review.service.spec.ts` — criação de sessões, transações atômicas de resposta, encerramento e histórico.
  - `src/modules/review/review.controller.spec.ts` — validação de rotas, guards de autenticação e formato de payload.
  - `src/modules/kanji/kanji.service.spec.ts` & `kanji.controller.spec.ts` — persistência de progresso e resumos.
  - `src/modules/vocabulary/vocabulary.service.spec.ts` — fluxo de progresso e agendamento de vocabulário.
  - `test/review.e2e-spec.ts` — testes ponta a ponta do ciclo completo de revisão.
- **Frontend**:
  - `tests/review-api.test.ts` — chamadas HTTP, fallback de renovação de token, recuperação de contagem e envio de respostas.
  - `tests/kanji-api.test.ts` & `tests/vocabulary-api.test.ts` — integração das ações de estudo e progresso.