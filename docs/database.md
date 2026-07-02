# 🗄 Database

[← Voltar ao README](../README.md) · [Architecture](./ARCHITECTURE.md) · [API](./API.md) · [Deployment](./DEPLOYMENT.md)

PostgreSQL 16, modelado e migrado via **Prisma ORM**. 20 entidades organizadas em 7 grupos.

## Mapa de Entidades

| Grupo | Tabelas |
|---|---|
| **Core** | `users`, `user_preferences`, `refresh_tokens` |
| **Kanji** | `kanjis`, `kanji_meanings`, `kanji_readings`, `kanji_examples`, `radicals`, `kanji_radicals` |
| **Progress** | `user_kanji_progress`, `user_vocabulary_progress` |
| **Review** | `review_sessions`, `review_answers` |
| **Vocabulary** | `vocabulary`, `vocabulary_meanings` |
| **Grammar** | `grammar_points`, `grammar_explanations`, `grammar_examples` |
| **Streak & Goals** | `streaks`, `streak_history`, `daily_goals` |
| **Immersion** | `immersion_logs`, `mined_sentences` |
| **Organization** | `custom_lists`, `custom_list_items` |
| **System** | `notifications` |

## Tabelas principais

### `users`
```
id (uuid PK) · email (unique) · username (unique) · password_hash
display_name · avatar_url · role (student|teacher|admin) DEFAULT student
jlpt_level (N5..N1) DEFAULT N5 · timezone DEFAULT 'America/Sao_Paulo'
is_active (bool) · email_verified_at · created_at · updated_at · last_active_at
```

### `kanjis`
```
id (uuid PK) · character (varchar(4), unique) · unicode_codepoint (unique)
jlpt_level (indexed) · grade (smallint) · stroke_count (smallint)
frequency_rank (int, indexed) · primary_radical_id (FK → radicals.id)
```
Relacionadas: `kanji_meanings` (1:N, por idioma), `kanji_readings` (onyomi/kunyomi/nanori), `kanji_examples`, `kanji_radicals` (N:N com `radicals`).

### `user_kanji_progress` — coração do sistema SRS
```
id (uuid PK) · user_id (FK) · kanji_id (FK)
srs_level (smallint DEFAULT 0, check 0–5) · is_mastered (bool)
is_favorited (bool) · is_suspended (bool)
ease_factor (decimal(4,2) DEFAULT 2.5) · interval_days (int DEFAULT 1)
next_review_at (timestamptz, indexed) · last_reviewed_at
total_reviews · correct_reviews · incorrect_reviews
first_seen_at · mastered_at
UNIQUE (user_id, kanji_id)
```
`user_vocabulary_progress` segue o mesmo padrão para vocabulário.

### `review_sessions` / `review_answers`
```
review_sessions: id · user_id · session_type (kanji|vocabulary|grammar|sentence)
  status (in_progress|completed|abandoned) · total_items · reviewed_items
  correct_items · incorrect_items · accuracy_rate · duration_seconds
  started_at · completed_at

review_answers: id · session_id (FK) · user_id · item_id · item_type
  answer_quality (0–3) · response_time_ms
  previous_srs_level · new_srs_level · previous_interval · new_interval
  answered_at
```

### `streaks` / `streak_history` / `daily_goals`
```
streaks: id · user_id (unique) · current_streak · longest_streak
  last_activity_date (indexed) · freeze_count · freeze_used_at
  total_days_studied

streak_history: id · user_id · date (indexed) · was_active (bool)
  minutes_studied · kanjis_reviewed · activity_types (text[])
  UNIQUE (user_id, date)

daily_goals: id · user_id · date · goal_minutes · goal_kanjis
  actual_minutes · actual_kanjis · is_completed · completed_at
  UNIQUE (user_id, date)
```

### `immersion_logs` / `mined_sentences`
```
immersion_logs: id · user_id (indexed) · source_type · source_name
  immersion_type (active|passive) · difficulty_level (easy|medium|hard)
  duration_minutes · comprehension_rate · notes · jlpt_target
  logged_at (indexed)

mined_sentences: id · user_id · immersion_log_id (FK)
  japanese_text · hiragana_text · translation · source_name · context
  grammar_point_ids[] · vocabulary_ids[] · kanji_ids[]
  jlpt_level · difficulty · is_favorited · is_reviewed · notes
```

### Outras tabelas
`custom_lists` / `custom_list_items` (listas do usuário), `notifications` (indexed por `user_id` + `is_read`), `refresh_tokens` (hash do token + `device_info` jsonb + `expires_at`/`revoked_at`).

## Índices críticos

```sql
-- Performance de busca
CREATE INDEX idx_kanjis_jlpt ON kanjis(jlpt_level);
CREATE INDEX idx_kanjis_frequency ON kanjis(frequency_rank);
CREATE INDEX idx_kanji_meanings_kanji ON kanji_meanings(kanji_id);
CREATE INDEX idx_kanji_readings_kanji ON kanji_readings(kanji_id);

-- Full-text search
CREATE INDEX idx_kanji_meanings_text ON kanji_meanings
  USING GIN(to_tsvector('portuguese', meaning));
CREATE INDEX idx_kanji_readings_text ON kanji_readings
  USING GIN(reading gin_trgm_ops);

-- Fila de SRS (CRÍTICO — roda constantemente)
CREATE INDEX idx_ukp_review_queue ON user_kanji_progress(user_id, next_review_at)
  WHERE NOT is_suspended AND srs_level > 0;
CREATE INDEX idx_uvp_review_queue ON user_vocabulary_progress(user_id, next_review_at)
  WHERE NOT is_suspended AND srs_level > 0;

-- Streak
CREATE INDEX idx_streaks_user ON streaks(user_id);
CREATE INDEX idx_streak_history_user_date ON streak_history(user_id, date);

-- Imersão
CREATE INDEX idx_immersion_logs_user_date ON immersion_logs(user_id, logged_at);

-- Notificações
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE NOT is_read;
```

> ⚠️ `idx_ukp_review_queue` é o índice mais sensível do sistema — a fila de revisão é consultada a cada carregamento do dashboard e a cada resposta de sessão. Monitore `EXPLAIN ANALYZE` em produção regularmente.

## Seed inicial

| Dado | Fonte |
|---|---|
| Kanjis, leituras, significados, grade, stroke count | **KANJIDIC2** (XML, Monash University) — 2.136 kanjis |
| Ordem dos traços (SVG) | **KanjiVG** |
| Vocabulário e exemplos | **JMdict** (170.000+ entradas) |
| Frequência real em mídia | **JPDB.io API**, Anime Subtitle Corpus |
| Vocabulário essencial ordenado | **Core 2000 / Core 6000** |
| Classificação por nível | **Listas oficiais JLPT** N5–N1 |
| Frequência em literatura | **Innocent Corpus** |

Rodar com `pnpm prisma db seed` após as migrations.

## Migrations

```bash
pnpm prisma migrate dev       # cria/aplica migration em desenvolvimento
pnpm prisma migrate deploy    # aplica migrations pendentes em produção
pnpm prisma studio            # inspeciona o banco visualmente
```