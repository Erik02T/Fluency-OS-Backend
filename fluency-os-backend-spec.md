# FLUENCY OS — ESPECIFICAÇÃO COMPLETA DE BACKEND
### Sistema Premium de Aquisição Natural de Japonês
> Documento de Arquitetura e Engenharia · Versão 1.0 · Nível: Produção

## STATUS REAL DE IMPLEMENTAÇÃO (RELEASE ATUAL)

Este documento combina especificação alvo e estado real de código. Para evitar ambiguidade, a classificação oficial por release segue abaixo.

Fonte de verdade para status Implementado:

- src/app.module.ts (módulos ativos)
- controllers existentes em src/

### Implementado

- Auth: registro, login, refresh, logout, me
- Kanji público: listagem, busca, detalhe
- Kanji admin: listagem, criação, edição, remoção
- Dashboard mínimo: GET /dashboard/summary
- Health: GET /, GET /health/live, GET /health, GET /health/ready

### Em desenvolvimento

- Dashboard expandido (overview, streak detalhado, daily-goal, heatmap, milestones)

### Planejado/Futuro

- Users
- Review (sessões SRS completas)
- Vocabulary
- Grammar
- Immersion
- Sentence Mining
- Notifications
- Custom Lists
- AI Tutor
- WebSocket de eventos de produto

---

## ÍNDICE

```
01. ANÁLISE VISUAL DO FRONTEND
02. REGRAS DE NEGÓCIO
03. ENTIDADES DO SISTEMA
04. MODELAGEM DO BANCO DE DADOS
05. API REST COMPLETA
06. FLUXOS DE DADOS
07. CASOS DE USO
08. SERVIÇOS BACKEND
09. AUTENTICAÇÃO E AUTORIZAÇÃO
10. ESTRUTURA DE PASTAS
11. EVENTOS E AUTOMAÇÕES
12. WEBSOCKETS E TEMPO REAL
13. ESCALABILIDADE E INFRAESTRUTURA
14. DOCUMENTAÇÃO EXECUTIVA FINAL
```

---

# MÓDULO 01 — ANÁLISE VISUAL DO FRONTEND

## 1.1 · Visão Geral da Interface

A tela analisada é o módulo **Banco de Kanji** do sistema **Fluency OS** (日本語), um ecossistema premium de aprendizado de japonês. A interface é construída com Next.js 15, TypeScript, Tailwind CSS, shadcn/ui e Framer Motion.

---

## 1.2 · Componentes Identificados

### BARRA LATERAL (Sidebar)

| Componente | Função | Dados Exibidos |
|---|---|---|
| Logo "Fluency OS / 日本語" | Branding + navegação raiz | Nome da app |
| Botão "Review" (復) | Inicia sessão de revisão SRS | — |
| Botão "AI Tutor" (智) | Acesso ao tutor inteligente | — |
| Nav: Dashboard (家) | Navega ao home | — |
| Nav: Kanji (字) — ativo | Página atual | — |
| Nav: Vocabulário (語) | Banco de vocabulário | — |
| Nav: Gramática (文) | Sistema de gramática | — |
| Nav: Imersão | Central de imersão | — |
| Streak (fogo) "7 dias" | Exibe dias consecutivos de estudo | `streak.days_count` |
| Meta diária "45/60 min" | Progresso do dia em minutos | `daily_goal.current / daily_goal.target` |
| Avatar "N" + Configurações | Menu do usuário | `user.avatar, user.settings` |

---

### BARRA SUPERIOR (Header)

| Componente | Função | Dados Exibidos |
|---|---|---|
| Título "Banco de Kanji" | Cabeçalho do módulo | Título da página |
| Subtítulo | Descrição do módulo | — |
| Ícone do módulo (字) | Identidade visual | — |
| Campo de Busca | Busca global | Query text |
| Botão "Revisar" com badge `42` | Inicia revisão pendente | `review_queue.count` |
| Sino (notificações) | Notificações do sistema | `notifications.unread_count` |
| Toggle dark/light mode | Preferência de tema | `user.preferences.theme` |
| Badge "Estudante / JLPT N4" | Perfil e nível do usuário | `user.role, user.jlpt_level` |

---

### BARRA DE ESTATÍSTICAS (Stats Bar)

| Stat Card | Kanji | Cor | Dado |
|---|---|---|---|
| Total | 全 | foreground | Total de kanjis no sistema |
| Dominados | 済 | emerald | Kanjis com `mastered = true` |
| Aprendendo | 習 | gold | Kanjis com `mastered = false` |
| N5 | 五 | teal | Kanjis com `jlpt = "N5"` |
| N4 | 四 | neon-blue | Kanjis com `jlpt = "N4"` |

---

### BARRA DE FILTROS (Filter Bar)

| Componente | Tipo | Valores | Campo Filtrado |
|---|---|---|---|
| Search Input | text | kanji, significado, leitura | `kanji`, `meanings[]`, `onyomi[]`, `kunyomi[]` |
| Select JLPT | dropdown | Todos, N5, N4, N3, N2, N1 | `kanji.jlpt` |
| Toggle Dominados | button | on/off | `user_progress.mastered` |
| Toggle Grid/List | button group | grid \| list | UI preference |

---

### GRID DE KANJIS (Kanji Grid)

**Modo Grid — Cada card exibe:**
- Caractere kanji principal (ex: 日)
- Primeira leitura onyomi ou kunyomi (ex: ニチ)
- Badge JLPT (ex: N5)
- Ícone de estrela se `mastered = true`
- Borda verde se dominado / vermelha no hover

**Modo Lista — Cada item exibe:**
- Ícone kanji (64px)
- Significados (ex: "sol, dia")
- Badge JLPT
- Ícone estrela se dominado
- Leituras onyomi e kunyomi
- Quantidade de traços
- Progress bar de nível SRS

---

### DIALOG DE DETALHE DO KANJI

| Seção | Dados |
|---|---|
| Header | Caractere grande + significados + JLPT + traços + grade + badge "Dominado" |
| Onyomi | Array de leituras on |
| Kunyomi | Array de leituras kun |
| Tab: Exemplos | Lista de `{ word, reading, meaning }` + botão de áudio |
| Tab: Radicais | Lista visual de radicais do kanji |
| Tab: Progresso | Nível SRS 1-5 + barra de progresso |
| CTA: Revisar Agora | Inicia sessão de revisão imediata |
| CTA: Adicionar à Lista | Adiciona a uma lista personalizada |

---

## 1.3 · Estrutura de Dados Inferida do Frontend

```typescript
interface Kanji {
  id: string
  kanji: string                          // Caractere: "日"
  onyomi: string[]                       // ["ニチ", "ジツ"]
  kunyomi: string[]                      // ["ひ", "か"]
  meanings: string[]                     // ["sol", "dia"]
  jlpt: "N5" | "N4" | "N3" | "N2" | "N1"
  strokes: number                        // 4
  frequency: number                      // ranking de frequência
  grade: number                          // grau escolar japonês
  examples: KanjiExample[]
  radicals: string[]                     // ["日"]
  srsLevel: number                       // 1–5
  mastered: boolean
}

interface KanjiExample {
  word: string      // "日本"
  reading: string   // "にほん"
  meaning: string   // "Japão"
}
```

---

# MÓDULO 02 — REGRAS DE NEGÓCIO

## 2.1 · Regras de Kanji

```
RN-K001  Um kanji é marcado como "dominado" quando srsLevel >= 5
RN-K002  srsLevel varia entre 1 e 5 — nunca abaixo de 1 nem acima de 5
RN-K003  Um kanji só pode ser revisado se estiver na fila de revisão do usuário
RN-K004  Busca suporta: caractere exato, significado (partial), onyomi, kunyomi
RN-K005  Kanjis possuem nível JLPT obrigatório: N5, N4, N3, N2 ou N1
RN-K006  Frequência é global e imutável — reflete frequência real no japonês
RN-K007  Exemplos de palavras são globais e vinculados ao kanji, não ao usuário
RN-K008  Radicais são atributos globais do kanji
```

## 2.2 · Regras de SRS (Spaced Repetition System)

```
RN-SRS001  O algoritmo SRS calcula o próximo intervalo com base na qualidade da resposta
RN-SRS002  Respostas possíveis: 0 (falhou), 1 (difícil), 2 (ok), 3 (fácil)
RN-SRS003  Resposta 0 reseta o item para o início do ciclo
RN-SRS004  Intervalo mínimo: 1 dia. Máximo configurável.
RN-SRS005  Fórmula base (SM-2 adaptada):
             interval(n) = interval(n-1) × easiness_factor
             easiness_factor mínimo: 1.3
RN-SRS006  A fila de revisão do dia é calculada às 00:00 no timezone do usuário
RN-SRS007  Um item só aparece na fila após sua data de revisão chegar
RN-SRS008  Máximo de 50 revisões por sessão (configurável)
```

## 2.3 · Regras de Streak

```
RN-STR001  Streak incrementa quando o usuário realiza qualquer atividade no dia
RN-STR002  Atividade mínima para manter streak: completar ao menos 1 revisão OU 10 min de estudo
RN-STR003  Streak é zerado se o usuário não atingir a atividade mínima em um dia
RN-STR004  Timezone do streak é baseado no perfil do usuário
RN-STR005  Streak freeze pode ser comprado/ganho — mantém o streak por 1 dia sem atividade
```

## 2.4 · Regras de Meta Diária

```
RN-META001  Meta padrão: 30 minutos de estudo ativo por dia
RN-META002  Usuário pode configurar meta entre 5 e 240 minutos
RN-META003  Tempo de imersão passiva não conta para a meta de estudo ativo
RN-META004  Meta de kanjis revisados é independente da meta de tempo
RN-META005  Progresso da meta reseta à meia-noite no timezone do usuário
```

## 2.5 · Regras de Usuário e Perfil

```
RN-USR001  Nível JLPT do usuário é definido manualmente ou via teste diagnóstico
RN-USR002  Usuário pode ter múltiplas listas personalizadas de kanjis
RN-USR003  Favoritar um kanji não afeta o SRS — é apenas organização
RN-USR004  Um usuário pode pausar o progresso de um kanji (freeze)
RN-USR005  Roles disponíveis: student, teacher, admin
```

## 2.6 · Regras de Imersão

```
RN-IMR001  Log de imersão registra: tipo (ativo/passivo), duração, fonte, nível
RN-IMR002  Fontes de imersão: anime, podcast, dorama, mangá, YouTube, livro, visual novel
RN-IMR003  Imersão ativa exige foco consciente — conta para a meta principal
RN-IMR004  Imersão passiva é contabilizada separadamente para estatísticas
RN-IMR005  Sentence mining vincula frases extraídas ao log de imersão
```

---

# MÓDULO 03 — ENTIDADES DO SISTEMA

## 3.1 · Entidade: User

```typescript
interface User {
  id: string            // uuid
  email: string         // unique
  username: string      // unique, @handle
  display_name: string
  avatar_url?: string
  role: "student" | "teacher" | "admin"
  jlpt_level: "N5" | "N4" | "N3" | "N2" | "N1"
  timezone: string      // "America/Sao_Paulo"
  preferences: UserPreferences
  created_at: Date
  updated_at: Date
  last_active_at: Date
}

interface UserPreferences {
  theme: "dark" | "light" | "system"
  daily_goal_minutes: number   // default: 30
  daily_goal_kanjis: number    // default: 10
  notifications_enabled: boolean
  srs_daily_limit: number      // default: 50
  immersion_sources: string[]  // preferred sources
  language: "pt-BR" | "en"
}
```

## 3.2 · Entidade: Kanji

```typescript
interface Kanji {
  id: string
  character: string         // "日" — unique
  unicode_codepoint: string // "U+65E5"
  jlpt_level: JLPTLevel
  grade: number             // 1–9 (grau escolar japonês)
  stroke_count: number
  frequency_rank: number    // 1 = mais frequente
  radical_id: string        // radical principal
  created_at: Date
  updated_at: Date
}

interface KanjiMeaning {
  id: string
  kanji_id: string
  meaning: string           // "sol"
  language: "pt-BR" | "en"
  is_primary: boolean
  position: number          // ordenação
}

interface KanjiReading {
  id: string
  kanji_id: string
  reading: string           // "ニチ"
  reading_type: "onyomi" | "kunyomi" | "nanori"
  romanization: string      // "nichi"
  is_common: boolean
  position: number
}

interface KanjiExample {
  id: string
  kanji_id: string
  word: string              // "日本"
  reading: string           // "にほん"
  meaning: string           // "Japão"
  jlpt_level: JLPTLevel
  frequency_rank: number
  audio_url?: string
}

interface Radical {
  id: string
  character: string         // "日"
  name: string              // "sun"
  stroke_count: number
  meaning: string
}

interface KanjiRadical {
  kanji_id: string
  radical_id: string
  is_primary: boolean
}
```

## 3.3 · Entidade: UserKanjiProgress

```typescript
interface UserKanjiProgress {
  id: string
  user_id: string
  kanji_id: string
  srs_level: number           // 0–5 (0 = não iniciado)
  is_mastered: boolean        // srs_level >= 5
  is_favorited: boolean
  is_suspended: boolean       // freeze
  ease_factor: number         // SM-2, default: 2.5
  interval_days: number       // dias até próxima revisão
  next_review_at: Date
  last_reviewed_at?: Date
  total_reviews: number
  correct_reviews: number
  incorrect_reviews: number
  streak_days: number         // dias seguidos de acerto
  first_seen_at: Date
  mastered_at?: Date
  updated_at: Date
}
```

## 3.4 · Entidade: ReviewSession

```typescript
interface ReviewSession {
  id: string
  user_id: string
  session_type: "kanji" | "vocabulary" | "grammar" | "sentence"
  status: "in_progress" | "completed" | "abandoned"
  total_items: number
  reviewed_items: number
  correct_items: number
  incorrect_items: number
  accuracy_rate: number         // percentage
  duration_seconds: number
  started_at: Date
  completed_at?: Date
}

interface ReviewAnswer {
  id: string
  session_id: string
  user_id: string
  item_id: string               // kanji_id, vocabulary_id, etc.
  item_type: "kanji" | "vocabulary" | "grammar"
  answer_quality: 0 | 1 | 2 | 3 // 0=fail, 1=hard, 2=ok, 3=easy
  response_time_ms: number
  previous_srs_level: number
  new_srs_level: number
  previous_interval: number
  new_interval: number
  answered_at: Date
}
```

## 3.5 · Entidade: Streak

```typescript
interface Streak {
  id: string
  user_id: string             // unique
  current_streak: number
  longest_streak: number
  last_activity_date: Date    // YYYY-MM-DD
  freeze_count: number        // streak freezes disponíveis
  freeze_used_at?: Date
  total_days_studied: number
  updated_at: Date
}

interface StreakHistory {
  id: string
  user_id: string
  date: Date                  // YYYY-MM-DD
  was_active: boolean
  minutes_studied: number
  kanjis_reviewed: number
  activity_types: string[]    // ["review", "immersion", "grammar"]
}
```

## 3.6 · Entidade: DailyGoal

```typescript
interface DailyGoal {
  id: string
  user_id: string
  date: Date                   // YYYY-MM-DD
  goal_minutes: number
  goal_kanjis: number
  actual_minutes: number
  actual_kanjis: number
  is_completed: boolean
  completed_at?: Date
  created_at: Date
}
```

## 3.7 · Entidade: ImmersionLog

```typescript
interface ImmersionLog {
  id: string
  user_id: string
  source_type: "anime" | "podcast" | "dorama" | "manga" | "youtube" | "book" | "visual_novel" | "nhk_easy" | "other"
  source_name: string           // "Jujutsu Kaisen S02E01"
  immersion_type: "active" | "passive"
  difficulty_level: "easy" | "medium" | "hard"
  duration_minutes: number
  comprehension_rate?: number   // 0–100
  notes?: string
  jlpt_target: JLPTLevel
  logged_at: Date
  created_at: Date
}
```

## 3.8 · Entidade: SentenceMining

```typescript
interface MinedSentence {
  id: string
  user_id: string
  immersion_log_id?: string
  japanese_text: string         // "今日は天気がいいですね"
  hiragana_text?: string
  translation: string
  source_name?: string
  context?: string
  grammar_points: string[]      // ["〜は", "〜が", "〜ね"]
  vocabulary_ids: string[]
  kanji_ids: string[]
  jlpt_level: JLPTLevel
  difficulty: "easy" | "medium" | "hard"
  is_favorited: boolean
  is_reviewed: boolean
  notes?: string
  audio_url?: string
  created_at: Date
  reviewed_at?: Date
}
```

## 3.9 · Entidade: Vocabulary

```typescript
interface Vocabulary {
  id: string
  word: string                  // "食べる"
  hiragana: string              // "たべる"
  romaji: string                // "taberu"
  jlpt_level: JLPTLevel
  part_of_speech: "verb" | "noun" | "adjective" | "adverb" | "particle" | "expression" | "counter" | "conjunction"
  formality: "casual" | "polite" | "formal" | "keigo"
  frequency_rank: number
  category: "daily" | "anime" | "dorama" | "seiyuu" | "slang" | "business" | "academic"
  audio_url?: string
  created_at: Date
}

interface VocabularyMeaning {
  id: string
  vocabulary_id: string
  meaning: string
  language: "pt-BR" | "en"
  is_primary: boolean
  example_sentence: string
  example_translation: string
  position: number
}

interface UserVocabularyProgress {
  id: string
  user_id: string
  vocabulary_id: string
  srs_level: number
  is_mastered: boolean
  is_favorited: boolean
  ease_factor: number
  interval_days: number
  next_review_at: Date
  last_reviewed_at?: Date
  total_reviews: number
  correct_reviews: number
  created_at: Date
}
```

## 3.10 · Entidade: GrammarPoint

```typescript
interface GrammarPoint {
  id: string
  pattern: string               // "〜てから"
  title: string                 // "Depois de fazer X"
  jlpt_level: JLPTLevel
  category: "particle" | "verb_form" | "conjunction" | "expression" | "sentence_pattern"
  formality: "casual" | "polite" | "formal" | "any"
  difficulty_score: number      // 1–10
  order_in_curriculum: number
  prerequisite_ids: string[]    // grammar points que devem vir antes
  created_at: Date
}

interface GrammarExplanation {
  id: string
  grammar_id: string
  structure: string             // "[Verb-て form] + から"
  explanation_short: string
  explanation_detailed: string
  usage_context: string
  common_mistakes: string
  nuances: string
  formality_notes: string
  language: "pt-BR" | "en"
}

interface GrammarExample {
  id: string
  grammar_id: string
  japanese_text: string
  hiragana_text: string
  translation: string
  notes?: string
  source_type?: string          // "anime", "dorama", "natural"
  formality: "casual" | "polite" | "formal"
}
```

## 3.11 · Entidade: CustomList

```typescript
interface CustomList {
  id: string
  user_id: string
  name: string
  description?: string
  icon?: string
  color?: string
  list_type: "kanji" | "vocabulary" | "sentences" | "mixed"
  is_public: boolean
  item_count: number
  created_at: Date
  updated_at: Date
}

interface CustomListItem {
  id: string
  list_id: string
  item_id: string               // kanji_id | vocabulary_id | sentence_id
  item_type: "kanji" | "vocabulary" | "sentence"
  position: number
  notes?: string
  added_at: Date
}
```

## 3.12 · Entidade: Notification

```typescript
interface Notification {
  id: string
  user_id: string
  type: "review_due" | "streak_warning" | "goal_completed" | "milestone" | "system" | "ai_feedback"
  title: string
  message: string
  action_url?: string
  is_read: boolean
  read_at?: Date
  created_at: Date
}
```

## 3.13 · Entidade: StudySession

```typescript
interface StudySession {
  id: string
  user_id: string
  session_type: "active_study" | "immersion" | "shadowing" | "reading" | "writing"
  duration_minutes: number
  notes?: string
  productivity_score?: number  // 1–5 (autoavaliação)
  started_at: Date
  ended_at: Date
  created_at: Date
}
```

---

# MÓDULO 04 — MODELAGEM DO BANCO DE DADOS

## 4.1 · Diagrama de Tabelas

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FLUENCY OS DATABASE                          │
└─────────────────────────────────────────────────────────────────────┘

CORE TABLES
───────────────────────────────────────────────────
users
 ├── id (uuid PK)
 ├── email (unique, not null)
 ├── username (unique, not null)
 ├── password_hash (not null)
 ├── display_name (not null)
 ├── avatar_url
 ├── role (enum: student|teacher|admin) DEFAULT student
 ├── jlpt_level (enum: N5|N4|N3|N2|N1) DEFAULT N5
 ├── timezone (DEFAULT 'America/Sao_Paulo')
 ├── is_active (boolean DEFAULT true)
 ├── email_verified_at
 ├── created_at
 ├── updated_at
 └── last_active_at

user_preferences
 ├── id (uuid PK)
 ├── user_id (FK → users.id, unique)
 ├── theme (enum: dark|light|system) DEFAULT dark
 ├── daily_goal_minutes (int DEFAULT 30)
 ├── daily_goal_kanjis (int DEFAULT 10)
 ├── srs_daily_limit (int DEFAULT 50)
 ├── notifications_enabled (boolean DEFAULT true)
 ├── language (enum: pt-BR|en) DEFAULT pt-BR
 ├── immersion_sources (jsonb)
 └── updated_at

KANJI TABLES
───────────────────────────────────────────────────
kanjis
 ├── id (uuid PK)
 ├── character (varchar(4), unique, not null)
 ├── unicode_codepoint (varchar(10), unique)
 ├── jlpt_level (enum: N5|N4|N3|N2|N1, indexed)
 ├── grade (smallint)
 ├── stroke_count (smallint, not null)
 ├── frequency_rank (int, indexed)
 ├── primary_radical_id (FK → radicals.id)
 ├── created_at
 └── updated_at

kanji_meanings
 ├── id (uuid PK)
 ├── kanji_id (FK → kanjis.id, indexed)
 ├── meaning (varchar(100), not null)
 ├── language (enum: pt-BR|en) DEFAULT pt-BR
 ├── is_primary (boolean DEFAULT false)
 └── position (smallint)

kanji_readings
 ├── id (uuid PK)
 ├── kanji_id (FK → kanjis.id, indexed)
 ├── reading (varchar(50), not null)
 ├── reading_type (enum: onyomi|kunyomi|nanori)
 ├── romanization (varchar(100))
 ├── is_common (boolean DEFAULT false)
 └── position (smallint)

kanji_examples
 ├── id (uuid PK)
 ├── kanji_id (FK → kanjis.id, indexed)
 ├── word (varchar(50), not null)
 ├── reading (varchar(100), not null)
 ├── meaning (varchar(200), not null)
 ├── jlpt_level (enum)
 ├── frequency_rank (int)
 └── audio_url

radicals
 ├── id (uuid PK)
 ├── character (varchar(4), unique)
 ├── name (varchar(50))
 ├── stroke_count (smallint)
 └── meaning (varchar(100))

kanji_radicals (junction)
 ├── kanji_id (FK → kanjis.id)
 ├── radical_id (FK → radicals.id)
 ├── is_primary (boolean)
 └── PRIMARY KEY (kanji_id, radical_id)

USER PROGRESS TABLES
───────────────────────────────────────────────────
user_kanji_progress
 ├── id (uuid PK)
 ├── user_id (FK → users.id, indexed)
 ├── kanji_id (FK → kanjis.id, indexed)
 ├── srs_level (smallint DEFAULT 0, check 0–5)
 ├── is_mastered (boolean DEFAULT false)
 ├── is_favorited (boolean DEFAULT false)
 ├── is_suspended (boolean DEFAULT false)
 ├── ease_factor (decimal(4,2) DEFAULT 2.5)
 ├── interval_days (int DEFAULT 1)
 ├── next_review_at (timestamptz, indexed)
 ├── last_reviewed_at (timestamptz)
 ├── total_reviews (int DEFAULT 0)
 ├── correct_reviews (int DEFAULT 0)
 ├── incorrect_reviews (int DEFAULT 0)
 ├── first_seen_at (timestamptz DEFAULT now())
 ├── mastered_at (timestamptz)
 └── UNIQUE (user_id, kanji_id)

user_vocabulary_progress
 ├── id (uuid PK)
 ├── user_id (FK)
 ├── vocabulary_id (FK)
 ├── srs_level (smallint DEFAULT 0)
 ├── is_mastered (boolean DEFAULT false)
 ├── is_favorited (boolean DEFAULT false)
 ├── ease_factor (decimal(4,2) DEFAULT 2.5)
 ├── interval_days (int DEFAULT 1)
 ├── next_review_at (timestamptz, indexed)
 ├── last_reviewed_at
 ├── total_reviews (int DEFAULT 0)
 ├── correct_reviews (int DEFAULT 0)
 └── UNIQUE (user_id, vocabulary_id)

REVIEW TABLES
───────────────────────────────────────────────────
review_sessions
 ├── id (uuid PK)
 ├── user_id (FK → users.id, indexed)
 ├── session_type (enum: kanji|vocabulary|grammar|sentence)
 ├── status (enum: in_progress|completed|abandoned)
 ├── total_items (int DEFAULT 0)
 ├── reviewed_items (int DEFAULT 0)
 ├── correct_items (int DEFAULT 0)
 ├── incorrect_items (int DEFAULT 0)
 ├── accuracy_rate (decimal(5,2))
 ├── duration_seconds (int)
 ├── started_at (timestamptz)
 └── completed_at (timestamptz)

review_answers
 ├── id (uuid PK)
 ├── session_id (FK → review_sessions.id)
 ├── user_id (FK → users.id)
 ├── item_id (uuid)
 ├── item_type (enum: kanji|vocabulary|grammar)
 ├── answer_quality (smallint, check 0–3)
 ├── response_time_ms (int)
 ├── previous_srs_level (smallint)
 ├── new_srs_level (smallint)
 ├── previous_interval (int)
 ├── new_interval (int)
 └── answered_at (timestamptz DEFAULT now())

STREAK & GOALS TABLES
───────────────────────────────────────────────────
streaks
 ├── id (uuid PK)
 ├── user_id (FK → users.id, unique)
 ├── current_streak (int DEFAULT 0)
 ├── longest_streak (int DEFAULT 0)
 ├── last_activity_date (date, indexed)
 ├── freeze_count (smallint DEFAULT 0)
 ├── freeze_used_at (date)
 ├── total_days_studied (int DEFAULT 0)
 └── updated_at

streak_history
 ├── id (uuid PK)
 ├── user_id (FK)
 ├── date (date, not null, indexed)
 ├── was_active (boolean DEFAULT false)
 ├── minutes_studied (int DEFAULT 0)
 ├── kanjis_reviewed (int DEFAULT 0)
 ├── activity_types (text[])
 └── UNIQUE (user_id, date)

daily_goals
 ├── id (uuid PK)
 ├── user_id (FK)
 ├── date (date, not null)
 ├── goal_minutes (int)
 ├── goal_kanjis (int)
 ├── actual_minutes (int DEFAULT 0)
 ├── actual_kanjis (int DEFAULT 0)
 ├── is_completed (boolean DEFAULT false)
 ├── completed_at
 └── UNIQUE (user_id, date)

CONTENT TABLES
───────────────────────────────────────────────────
vocabulary
 ├── id (uuid PK)
 ├── word (varchar(100), not null)
 ├── hiragana (varchar(200), not null)
 ├── romaji (varchar(200))
 ├── jlpt_level (enum, indexed)
 ├── part_of_speech (enum)
 ├── formality (enum)
 ├── frequency_rank (int, indexed)
 ├── category (enum, indexed)
 └── audio_url

vocabulary_meanings (similar pattern to kanji_meanings)

grammar_points
 ├── id (uuid PK)
 ├── pattern (varchar(100), not null)
 ├── title (varchar(200))
 ├── jlpt_level (enum, indexed)
 ├── category (enum)
 ├── formality (enum)
 ├── difficulty_score (smallint)
 ├── order_in_curriculum (int, indexed)
 └── prerequisite_ids (uuid[])

grammar_explanations (1:1 with grammar_points)
grammar_examples (1:N with grammar_points)

IMMERSION & MINING TABLES
───────────────────────────────────────────────────
immersion_logs
 ├── id (uuid PK)
 ├── user_id (FK, indexed)
 ├── source_type (enum)
 ├── source_name (varchar(300))
 ├── immersion_type (enum: active|passive)
 ├── difficulty_level (enum: easy|medium|hard)
 ├── duration_minutes (int)
 ├── comprehension_rate (smallint)
 ├── notes (text)
 ├── jlpt_target (enum)
 └── logged_at (timestamptz, indexed)

mined_sentences
 ├── id (uuid PK)
 ├── user_id (FK)
 ├── immersion_log_id (FK → immersion_logs.id)
 ├── japanese_text (text, not null)
 ├── hiragana_text (text)
 ├── translation (text)
 ├── source_name (varchar(300))
 ├── context (text)
 ├── grammar_point_ids (uuid[])
 ├── vocabulary_ids (uuid[])
 ├── kanji_ids (uuid[])
 ├── jlpt_level (enum)
 ├── difficulty (enum)
 ├── is_favorited (boolean DEFAULT false)
 ├── is_reviewed (boolean DEFAULT false)
 ├── notes (text)
 └── created_at

ORGANIZATION TABLES
───────────────────────────────────────────────────
custom_lists
 ├── id (uuid PK)
 ├── user_id (FK)
 ├── name (varchar(100), not null)
 ├── description (text)
 ├── icon (varchar(10))
 ├── color (varchar(20))
 ├── list_type (enum)
 ├── is_public (boolean DEFAULT false)
 └── timestamps

custom_list_items
 ├── id (uuid PK)
 ├── list_id (FK → custom_lists.id)
 ├── item_id (uuid)
 ├── item_type (enum)
 ├── position (int)
 ├── notes (text)
 └── added_at

notifications
 ├── id (uuid PK)
 ├── user_id (FK, indexed)
 ├── type (enum)
 ├── title (varchar(200))
 ├── message (text)
 ├── action_url (varchar(500))
 ├── is_read (boolean DEFAULT false)
 ├── read_at
 └── created_at (indexed)

refresh_tokens
 ├── id (uuid PK)
 ├── user_id (FK)
 ├── token_hash (varchar(255), unique, indexed)
 ├── device_info (jsonb)
 ├── expires_at (timestamptz)
 ├── revoked_at
 └── created_at
```

## 4.2 · Índices Críticos

```sql
-- Performance de busca
CREATE INDEX idx_kanjis_jlpt ON kanjis(jlpt_level);
CREATE INDEX idx_kanjis_frequency ON kanjis(frequency_rank);
CREATE INDEX idx_kanji_meanings_kanji ON kanji_meanings(kanji_id);
CREATE INDEX idx_kanji_readings_kanji ON kanji_readings(kanji_id);

-- Full-text search
CREATE INDEX idx_kanji_meanings_text ON kanji_meanings USING GIN(to_tsvector('portuguese', meaning));
CREATE INDEX idx_kanji_readings_text ON kanji_readings USING GIN(reading gin_trgm_ops);

-- SRS queue crítico
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

---

# MÓDULO 05 — API REST COMPLETA

## 5.0 · Status Operacional das Rotas

As seções 5.1+ descrevem o contrato alvo do produto. Nem todas as rotas deste módulo estão implementadas na release atual.

### 5.0.1 Implementado

```
GET    /
GET    /health/live
GET    /health
GET    /health/ready

POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GET    /kanji
GET    /kanji/search
GET    /kanji/search/:query
GET    /kanji/:id

GET    /admin/kanjis
POST   /admin/kanjis
PUT    /admin/kanjis/:id
DELETE /admin/kanjis/:id

GET    /dashboard/summary
```

### 5.0.2 Em desenvolvimento

```
GET    /dashboard/overview
GET    /dashboard/streak
GET    /dashboard/daily-goal
GET    /dashboard/heatmap
GET    /dashboard/recent-activity
GET    /dashboard/milestones
```

### 5.0.3 Planejado/Futuro

Todos os demais grupos do módulo 05 (users, review, vocabulary, grammar, immersion, sentence mining, notifications, custom lists, AI tutor) permanecem como escopo alvo e ainda não devem ser tratados como ativos na release atual.

## 5.1 · Convenções da API

```
Base URL:     https://api.fluencyos.app/v1
Auth Header:  Authorization: Bearer <access_token>
Content-Type: application/json
Versioning:   URL path (/v1, /v2)
Pagination:   cursor-based (next_cursor, prev_cursor, limit)
Timestamps:   ISO 8601 UTC (2024-01-15T10:30:00Z)
Errors:       RFC 7807 Problem Details
```

---

## 5.2 · Auth Routes

```
POST   /auth/register          Cadastro de novo usuário
POST   /auth/login             Login com email/senha
POST   /auth/logout            Revoga refresh token
POST   /auth/refresh           Renova access token
POST   /auth/forgot-password   Solicita reset de senha
POST   /auth/reset-password    Confirma reset com token
POST   /auth/verify-email      Verifica email com código
GET    /auth/me                Dados do usuário autenticado
```

### POST /auth/register

```
Request:
{
  "email": "user@example.com",
  "username": "estudante_jp",
  "password": "minimo8chars",
  "display_name": "Tanaka Studies",
  "jlpt_level": "N5",
  "timezone": "America/Sao_Paulo"
}

Response 201:
{
  "user": { ...UserPublic },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900
}

Errors:
  409 - Email já cadastrado
  409 - Username já em uso
  422 - Validação falhou
```

### POST /auth/login

```
Request:
{
  "email": "user@example.com",
  "password": "senha123"
}

Response 200:
{
  "user": { ...UserPublic },
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 900
}

Errors:
  401 - Credenciais inválidas
  403 - Email não verificado
  429 - Rate limit atingido (5 tentativas/min)
```

---

## 5.3 · User Routes

```
GET    /users/me                   Perfil completo do usuário
PATCH  /users/me                   Atualiza perfil
GET    /users/me/preferences       Preferências do usuário
PATCH  /users/me/preferences       Atualiza preferências
GET    /users/me/stats             Estatísticas gerais
GET    /users/me/activity          Histórico de atividade (calendar heatmap)
POST   /users/me/avatar            Upload de avatar
```

### GET /users/me/stats

```
Response 200:
{
  "kanjis": {
    "total_in_system": 2136,
    "total_added": 16,
    "mastered": 11,
    "learning": 5,
    "by_jlpt": { "N5": 16, "N4": 0, "N3": 0 }
  },
  "vocabulary": {
    "total_added": 342,
    "mastered": 210,
    "learning": 132
  },
  "streak": {
    "current": 7,
    "longest": 23,
    "total_days_studied": 45
  },
  "daily_goal": {
    "goal_minutes": 60,
    "actual_minutes": 45,
    "goal_kanjis": 10,
    "actual_kanjis": 8,
    "is_completed": false
  },
  "review_queue": {
    "total_due": 42,
    "kanjis_due": 28,
    "vocabulary_due": 14
  },
  "immersion": {
    "total_minutes_active": 1240,
    "total_minutes_passive": 3600
  }
}
```

---

## 5.4 · Kanji Routes

```
GET    /kanji                      Lista kanjis com filtros e paginação
GET    /kanji/:id                  Detalhe completo de um kanji
GET    /kanji/:id/examples         Exemplos de palavras do kanji
GET    /kanji/:id/radicals         Radicais do kanji
GET    /kanji/search               Busca full-text de kanjis
GET    /kanji/by-character/:char   Busca por caractere exato

GET    /kanji/me                   Kanjis do usuário (com progresso)
GET    /kanji/me/stats             Estatísticas de kanji do usuário
GET    /kanji/me/due               Fila de revisão de kanji
GET    /kanji/me/mastered          Kanjis dominados
GET    /kanji/me/favorites         Kanjis favoritos

POST   /kanji/:id/add              Adiciona kanji ao progresso do usuário
POST   /kanji/:id/favorite         Favorita/desfavorita um kanji
POST   /kanji/:id/suspend          Suspende/retoma revisão de um kanji
DELETE /kanji/:id/remove           Remove kanji do progresso
```

### GET /kanji · Query Params

```
?jlpt=N5,N4           Filtra por nível (múltiplos)
?mastered=true|false  Filtra por status de dominado
?favorited=true       Filtra por favoritos
?search=日            Busca por caractere, significado ou leitura
?grade=1              Filtra por grau escolar
?frequency_max=500    Frequência máxima no ranking
?page_size=50         Itens por página (max 200)
?cursor=<token>       Token de paginação
?sort=frequency|jlpt|srs_level|mastered
?order=asc|desc
```

### GET /kanji · Response

```json
{
  "data": [
    {
      "id": "uuid-001",
      "character": "日",
      "jlpt_level": "N5",
      "stroke_count": 4,
      "frequency_rank": 1,
      "grade": 1,
      "meanings": ["sol", "dia"],
      "onyomi": ["ニチ", "ジツ"],
      "kunyomi": ["ひ", "か"],
      "radicals": ["日"],
      "user_progress": {
        "srs_level": 5,
        "is_mastered": true,
        "is_favorited": true,
        "next_review_at": "2024-01-20T00:00:00Z",
        "total_reviews": 24,
        "accuracy_rate": 95.8
      }
    }
  ],
  "meta": {
    "total": 2136,
    "filtered": 80,
    "page_size": 50,
    "next_cursor": "eyJpZCI6ImFiYyJ9",
    "has_more": true
  }
}
```

### GET /kanji/:id · Response Completo

```json
{
  "id": "uuid-001",
  "character": "日",
  "unicode_codepoint": "U+65E5",
  "jlpt_level": "N5",
  "stroke_count": 4,
  "frequency_rank": 1,
  "grade": 1,
  "meanings": [
    { "meaning": "sol", "is_primary": true, "position": 1 },
    { "meaning": "dia", "is_primary": false, "position": 2 }
  ],
  "readings": [
    { "reading": "ニチ", "type": "onyomi", "is_common": true },
    { "reading": "ジツ", "type": "onyomi", "is_common": false },
    { "reading": "ひ", "type": "kunyomi", "is_common": true },
    { "reading": "か", "type": "kunyomi", "is_common": false }
  ],
  "examples": [
    {
      "word": "日本",
      "reading": "にほん",
      "meaning": "Japão",
      "jlpt_level": "N5",
      "audio_url": "https://cdn.fluencyos.app/audio/nihon.mp3"
    }
  ],
  "radicals": [
    { "character": "日", "name": "sun", "stroke_count": 4 }
  ],
  "user_progress": {
    "srs_level": 5,
    "is_mastered": true,
    "is_favorited": true,
    "is_suspended": false,
    "ease_factor": 2.7,
    "interval_days": 21,
    "next_review_at": "2024-01-20T00:00:00Z",
    "last_reviewed_at": "2024-01-15T14:30:00Z",
    "total_reviews": 24,
    "correct_reviews": 23,
    "incorrect_reviews": 1,
    "first_seen_at": "2024-01-01T09:00:00Z",
    "mastered_at": "2024-01-10T11:00:00Z"
  }
}
```

---

## 5.5 · Review Routes

```
GET    /review/queue               Fila de revisão do dia
GET    /review/queue/count         Contagem de itens na fila
POST   /review/sessions            Inicia nova sessão de revisão
GET    /review/sessions/:id        Dados da sessão atual
POST   /review/sessions/:id/answer Registra resposta de um item
POST   /review/sessions/:id/end    Encerra a sessão
GET    /review/sessions/history    Histórico de sessões
GET    /review/sessions/:id/stats  Estatísticas de uma sessão
```

### GET /review/queue

```json
{
  "total_due": 42,
  "items": [
    {
      "progress_id": "uuid",
      "item_type": "kanji",
      "item": { ...KanjiBasic },
      "srs_level": 2,
      "last_reviewed_at": "2024-01-14T00:00:00Z",
      "next_review_at": "2024-01-15T00:00:00Z",
      "review_count": 5
    }
  ],
  "by_type": {
    "kanji": 28,
    "vocabulary": 14
  }
}
```

### POST /review/sessions/:id/answer

```
Request:
{
  "item_id": "kanji-uuid",
  "item_type": "kanji",
  "answer_quality": 2,      // 0=fail, 1=hard, 2=ok, 3=easy
  "response_time_ms": 3200
}

Response 200:
{
  "previous_srs_level": 3,
  "new_srs_level": 4,
  "previous_interval": 8,
  "new_interval": 21,
  "next_review_at": "2024-02-05T00:00:00Z",
  "is_mastered": false,
  "session_progress": {
    "reviewed": 15,
    "total": 42,
    "correct": 12,
    "incorrect": 3
  }
}
```

---

## 5.6 · Dashboard Routes

```
GET    /dashboard/overview         Todos os dados do home dashboard
GET    /dashboard/streak           Streak atual e histórico
GET    /dashboard/daily-goal       Meta diária do dia atual
GET    /dashboard/heatmap          Heatmap de atividade (365 dias)
GET    /dashboard/recent-activity  Atividades recentes
GET    /dashboard/milestones       Marcos atingidos e próximos
```

### GET /dashboard/overview

```json
{
  "user": { "display_name": "Estudante", "jlpt_level": "N4" },
  "streak": { "current": 7, "longest": 23 },
  "daily_goal": {
    "goal_minutes": 60, "actual_minutes": 45,
    "goal_kanjis": 10, "actual_kanjis": 8,
    "percentage": 75, "is_completed": false
  },
  "review_queue": { "total_due": 42 },
  "kanji_stats": {
    "total_added": 16, "mastered": 11,
    "learning": 5, "by_jlpt": { "N5": 16 }
  },
  "vocabulary_stats": {
    "total_added": 342, "mastered": 210
  },
  "immersion_today": {
    "active_minutes": 30, "passive_minutes": 60
  },
  "weekly_summary": [
    { "date": "2024-01-15", "minutes": 45, "kanjis": 8, "was_active": true }
  ]
}
```

---

## 5.7 · Vocabulary Routes

```
GET    /vocabulary                 Lista vocabulário com filtros
GET    /vocabulary/:id             Detalhe de uma palavra
GET    /vocabulary/me              Vocabulário do usuário
GET    /vocabulary/me/due          Fila de revisão de vocabulário
POST   /vocabulary/:id/add         Adiciona ao progresso
POST   /vocabulary/:id/favorite    Favorita
POST   /vocabulary/import          Importa lista de palavras
```

---

## 5.8 · Grammar Routes

```
GET    /grammar                    Lista pontos gramaticais
GET    /grammar/:id                Detalhe completo
GET    /grammar/me                 Gramática do usuário com progresso
GET    /grammar/:id/examples       Exemplos de uso
GET    /grammar/:id/related        Gramáticas relacionadas
```

---

## 5.9 · Immersion Routes

```
GET    /immersion/logs             Logs de imersão do usuário
POST   /immersion/logs             Registra nova sessão de imersão
GET    /immersion/logs/:id         Detalhe de um log
PATCH  /immersion/logs/:id         Atualiza um log
DELETE /immersion/logs/:id         Remove um log
GET    /immersion/stats            Estatísticas de imersão
```

### POST /immersion/logs

```
Request:
{
  "source_type": "anime",
  "source_name": "Jujutsu Kaisen S02E03",
  "immersion_type": "active",
  "difficulty_level": "medium",
  "duration_minutes": 24,
  "comprehension_rate": 65,
  "jlpt_target": "N4",
  "notes": "Muita linguagem de luta, difícil mas divertido"
}

Response 201:
{
  "id": "uuid",
  "logged_at": "2024-01-15T20:00:00Z",
  "daily_goal_update": {
    "actual_minutes": 45,
    "goal_minutes": 60,
    "percentage": 75
  }
}
```

---

## 5.10 · Sentence Mining Routes

```
GET    /sentences                  Frases do usuário
POST   /sentences                  Cria nova frase minada
GET    /sentences/:id              Detalhe de uma frase
PATCH  /sentences/:id              Atualiza frase
DELETE /sentences/:id              Remove frase
POST   /sentences/:id/favorite     Favorita frase
POST   /sentences/:id/review       Marca como revisada
```

---

## 5.11 · Notification Routes

```
GET    /notifications              Lista notificações
PATCH  /notifications/:id/read     Marca como lida
PATCH  /notifications/read-all     Marca todas como lidas
DELETE /notifications/:id          Remove notificação
GET    /notifications/unread-count Contagem de não lidas
```

---

## 5.12 · Custom Lists Routes

```
GET    /lists                      Listas do usuário
POST   /lists                      Cria nova lista
GET    /lists/:id                  Detalhe de uma lista
PATCH  /lists/:id                  Atualiza lista
DELETE /lists/:id                  Remove lista
GET    /lists/:id/items            Itens de uma lista
POST   /lists/:id/items            Adiciona item à lista
DELETE /lists/:id/items/:itemId    Remove item da lista
PATCH  /lists/:id/items/reorder    Reordena itens
```

---

## 5.13 · AI Tutor Routes

```
POST   /ai/chat                    Mensagem para o AI Tutor
GET    /ai/chat/:sessionId         Histórico de uma conversa
POST   /ai/explain                 Explicar kanji/palavra/gramática
POST   /ai/generate-examples       Gerar exemplos para um item
POST   /ai/correct                 Corrigir texto em japonês
POST   /ai/translate               Traduzir japonês → português
```

---

## 5.14 · Admin Routes (role: admin)

```
GET    /admin/kanjis               Gerenciar banco de kanjis
POST   /admin/kanjis               Criar kanji
PUT    /admin/kanjis/:id           Atualizar kanji completo
DELETE /admin/kanjis/:id           Remover kanji
POST   /admin/kanjis/import        Importar kanjis em lote (JSON/CSV)

GET    /admin/users                Listar usuários
GET    /admin/users/:id            Detalhe de um usuário
PATCH  /admin/users/:id            Editar papel/status
GET    /admin/stats                Estatísticas globais do sistema
```

---

## 5.15 · Tratamento de Erros

```json
// 400 Bad Request
{
  "type": "https://api.fluencyos.app/errors/validation",
  "title": "Validation Error",
  "status": 400,
  "detail": "O campo 'jlpt_level' deve ser N5, N4, N3, N2 ou N1",
  "instance": "/v1/kanji",
  "errors": [
    { "field": "jlpt_level", "message": "Valor inválido" }
  ]
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

---

# MÓDULO 06 — FLUXOS DE DADOS

## 6.1 · Fluxo de Revisão SRS (Principal)

```
┌─────────────────────────────────────────────────────────────────┐
│  FLUXO: Sessão de Revisão SRS                                   │
└─────────────────────────────────────────────────────────────────┘

Usuário clica em "Revisar" (42)
        │
        ▼
Frontend → GET /review/queue
        │
        ▼
ReviewService.getQueue(userId)
  │  ├── Busca user_kanji_progress WHERE next_review_at <= NOW()
  │  ├── Ordena por: vencidos primeiro, depois por srs_level
  │  └── Limita a user_preferences.srs_daily_limit
        │
        ▼
Frontend recebe fila de 42 itens
        │
        ▼
POST /review/sessions { session_type: "kanji" }
  │
  ▼
ReviewService.createSession(userId, type)
  └── INSERT INTO review_sessions { status: "in_progress" }
        │
        ▼
Para cada item da fila:
        │
        ▼
Usuário vê o kanji e dá uma resposta (0, 1, 2, ou 3)
        │
        ▼
POST /review/sessions/:id/answer { item_id, quality, response_time_ms }
        │
        ▼
SRSService.calculateNextReview(progress, quality)
  │
  ├── quality = 0 (Falhou)
  │   ├── new_srs_level = MAX(1, current - 1)
  │   ├── interval = 1 dia
  │   └── ease_factor não muda
  │
  ├── quality = 1 (Difícil)
  │   ├── new_srs_level = current (mantém)
  │   ├── interval = interval × 1.2
  │   └── ease_factor -= 0.15 (mínimo: 1.3)
  │
  ├── quality = 2 (OK)
  │   ├── new_srs_level = MIN(5, current + 1)
  │   ├── interval = interval × ease_factor
  │   └── ease_factor não muda
  │
  └── quality = 3 (Fácil)
      ├── new_srs_level = MIN(5, current + 1)
      ├── interval = interval × ease_factor × 1.3
      └── ease_factor += 0.1
        │
        ▼
UPDATE user_kanji_progress
  ├── srs_level = new_srs_level
  ├── ease_factor = new_ease_factor
  ├── interval_days = new_interval
  ├── next_review_at = NOW() + interval days
  ├── is_mastered = (new_srs_level >= 5)
  └── total_reviews++, correct_reviews++/incorrect_reviews++
        │
        ▼
INSERT INTO review_answers (histórico)
        │
        ▼
StreakService.checkAndUpdate(userId)
        │
        ▼
DailyGoalService.updateProgress(userId, kanjisReviewed: 1)
        │
        ▼
EventEmitter.emit("KANJI_REVIEWED", { userId, kanjiId, quality })
        │
        ▼
[se is_mastered = true]
EventEmitter.emit("KANJI_MASTERED", { userId, kanjiId })
        │
        ▼
Response retorna: new_srs_level, new_interval, next_review_at, session_progress
        │
        ▼
[quando todos revisados ou usuário para]
POST /review/sessions/:id/end
        │
        ▼
ReviewService.endSession(sessionId)
  ├── UPDATE review_sessions { status: "completed", completed_at: NOW() }
  ├── Calcula accuracy_rate
  └── Emite evento SESSION_COMPLETED
```

## 6.2 · Fluxo de Autenticação

```
Usuário → POST /auth/login { email, password }
        │
        ▼
AuthService.login()
  ├── Busca user por email
  ├── Verifica password_hash (bcrypt)
  ├── Verifica email_verified_at
  └── Verifica is_active
        │
        ▼
[Sucesso]
  ├── Gera access_token (JWT, 15min)
  ├── Gera refresh_token (UUID v4)
  ├── Armazena hash do refresh_token na DB
  └── Response: { access_token, refresh_token, user }
        │
        ▼
Toda requisição autenticada:
Request → AuthGuard → JWT.verify(access_token) → inject req.user
        │
        ▼
[Token expirado] → Frontend usa refresh_token
POST /auth/refresh { refresh_token }
  ├── Busca refresh_token na DB (por hash)
  ├── Verifica expires_at e revoked_at
  ├── Revoga o token atual
  ├── Gera novo par de tokens
  └── Response: { access_token, refresh_token }
```

## 6.3 · Fluxo de Streak

```
Qualquer atividade do usuário
        │
        ▼
StreakService.recordActivity(userId, activityType)
        │
        ▼
Busca ou cria streak_history para hoje (user_id, date=TODAY)
        │
        ▼
UPDATE streak_history
  ├── was_active = true
  ├── minutes_studied += duration
  ├── kanjis_reviewed += count
  └── activity_types = ARRAY_APPEND(...)
        │
        ▼
Busca streaks WHERE user_id
        │
        ▼
Calcula status do dia anterior:
  ├── streak_history[ontem].was_active = true → streak continua
  ├── streak_history[ontem] não existe → verificar freeze
  └── streak_history[ontem].was_active = false → streak quebrado
        │
        ▼
[Streak continua]
  ├── current_streak += 1
  └── longest_streak = MAX(current, longest)

[Streak quebrado sem freeze]
  └── current_streak = 1

[Streak quebrado COM freeze disponível]
  ├── freeze_count -= 1
  ├── freeze_used_at = ontem
  └── current_streak mantém
        │
        ▼
UPDATE streaks
        │
        ▼
EventEmitter.emit("STREAK_UPDATED", { userId, current, longest })
```

---

# MÓDULO 07 — CASOS DE USO

## 7.1 · Módulo de Kanji

```
UC-K001  Explorar banco de kanjis
  Ator: Estudante
  Precondição: Autenticado
  Fluxo: Lista kanjis com filtros JLPT / mastered / busca
  Pós-condição: Kanji selecionado ou página filtrada

UC-K002  Visualizar detalhe de kanji
  Ator: Estudante
  Precondição: Autenticado
  Fluxo: Clica em kanji → abre dialog com exemplos, radicais, SRS
  Pós-condição: Usuário tem contexto completo do kanji

UC-K003  Adicionar kanji ao progresso
  Ator: Estudante
  Precondição: Kanji não está no progresso do usuário
  Fluxo: POST /kanji/:id/add → cria user_kanji_progress (srs_level=1)
  Pós-condição: Kanji aparece na fila de revisão futura

UC-K004  Favoritar kanji
  Ator: Estudante
  Precondição: Kanji no progresso do usuário
  Fluxo: Toggle star → POST /kanji/:id/favorite
  Pós-condição: is_favorited atualizado

UC-K005  Dominar kanji via revisão
  Ator: Sistema SRS
  Precondição: Usuário revisou kanji repetidamente com qualidade >= 2
  Fluxo: srs_level alcança 5 → is_mastered = true → notificação
  Pós-condição: Kanji aparece em "Dominados", intervalo aumenta muito

UC-K006  Suspender kanji
  Ator: Estudante
  Precondição: Kanji no progresso
  Fluxo: POST /kanji/:id/suspend → is_suspended = true
  Pós-condição: Kanji não aparece na fila de revisão

UC-K007  Buscar kanji
  Ator: Estudante
  Fluxo: Digita no search → filtra por kanji char, significado, onyomi, kunyomi
  Pós-condição: Lista filtrada em tempo real

UC-K008  Iniciar revisão imediata de kanji específico
  Ator: Estudante
  Fluxo: Dialog → "Revisar Agora" → cria sessão de 1 item
  Pós-condição: Sessão de revisão iniciada
```

## 7.2 · Módulo de Revisão

```
UC-R001  Iniciar sessão de revisão diária
  Fluxo: Botão "Revisar 42" → queue → sessão → responder todos

UC-R002  Responder item com qualidade
  Fluxo: Vê item → pensa → revela resposta → julga (0/1/2/3)
  Resultado: SRS atualizado conforme algoritmo SM-2

UC-R003  Abandonar sessão
  Fluxo: Usuário fecha → sessão marcada como "abandoned"
  Nota: Progresso dos itens já revisados é salvo

UC-R004  Ver resultados da sessão
  Fluxo: Sessão encerrada → tela de resumo com accuracy, tempo, kanjis dominados
```

## 7.3 · Módulo de Imersão

```
UC-I001  Registrar sessão de imersão
  Fluxo: Seleciona fonte, tipo, duração, dificuldade → POST /immersion/logs
  Resultado: Meta diária atualizada, histórico registrado

UC-I002  Minar frase da imersão
  Fluxo: Durante imersão → encontra frase → cria MinedSentence vinculada ao log
  Resultado: Frase salva com análise gramatical

UC-I003  Ver estatísticas de imersão
  Fluxo: GET /immersion/stats → total por fonte, por tipo, por dificuldade

UC-I004  Shadowing (futuro)
  Fluxo: Seleciona frase/áudio → repete → grava → AI avalia pronúncia
```

## 7.4 · Módulo de Dashboard

```
UC-D001  Ver visão geral do progresso
  Fluxo: GET /dashboard/overview → todos os dados na home

UC-D002  Ver streak e heatmap
  Fluxo: GET /dashboard/heatmap → 365 dias de atividade

UC-D003  Checar meta diária
  Fluxo: GET /dashboard/daily-goal → progresso em tempo real

UC-D004  Ver marcos (milestones)
  Fluxo: GET /dashboard/milestones → marcos atingidos e próximos
  Exemplos: "100 kanjis dominados", "30 dias de streak", "N5 completo"
```

---

# MÓDULO 08 — SERVIÇOS BACKEND

## 8.1 · KanjiService

```typescript
class KanjiService {
  // CRUD global
  findAll(filters: KanjiFilters, pagination: Pagination): Promise<PaginatedKanji>
  findById(id: string): Promise<KanjiDetail>
  findByCharacter(character: string): Promise<KanjiDetail>
  search(query: string, filters: KanjiFilters): Promise<KanjiBasic[]>

  // Progresso do usuário
  getUserKanjis(userId: string, filters: KanjiFilters): Promise<UserKanjiList>
  addToProgress(userId: string, kanjiId: string): Promise<UserKanjiProgress>
  removeFromProgress(userId: string, kanjiId: string): Promise<void>
  toggleFavorite(userId: string, kanjiId: string): Promise<boolean>
  toggleSuspend(userId: string, kanjiId: string): Promise<boolean>

  // Estatísticas
  getUserStats(userId: string): Promise<KanjiStats>
  getDueCount(userId: string): Promise<number>
}
```

## 8.2 · SRSService

```typescript
class SRSService {
  // Fila de revisão
  getReviewQueue(userId: string, type?: ItemType): Promise<ReviewQueueItem[]>
  getDueCount(userId: string): Promise<{ kanji: number; vocabulary: number; total: number }>

  // Algoritmo SM-2
  calculateNextReview(progress: UserProgress, quality: 0|1|2|3): SRSResult
  /*
    SRSResult = {
      new_srs_level: number
      new_ease_factor: number
      new_interval_days: number
      next_review_at: Date
      is_mastered: boolean
    }
  */

  // Sessões
  createSession(userId: string, type: SessionType): Promise<ReviewSession>
  submitAnswer(sessionId: string, answer: AnswerInput): Promise<AnswerResult>
  endSession(sessionId: string): Promise<SessionSummary>
  abandonSession(sessionId: string): Promise<void>

  // Histórico
  getSessionHistory(userId: string, pagination: Pagination): Promise<SessionHistory[]>
  getSessionStats(sessionId: string): Promise<SessionStats>
}
```

## 8.3 · StreakService

```typescript
class StreakService {
  getStreak(userId: string): Promise<Streak>
  recordActivity(userId: string, activity: ActivityInput): Promise<Streak>
  getHistory(userId: string, days: number): Promise<StreakHistory[]>
  getHeatmap(userId: string, year: number): Promise<HeatmapData>
  useFreeze(userId: string): Promise<Streak>
  addFreeze(userId: string, count: number): Promise<Streak>  // admin

  private checkAndUpdateStreak(userId: string, date: Date): Promise<void>
  private isStreakBroken(lastActivity: Date, today: Date): boolean
}
```

## 8.4 · DailyGoalService

```typescript
class DailyGoalService {
  getToday(userId: string): Promise<DailyGoal>
  updateProgress(userId: string, updates: GoalProgressInput): Promise<DailyGoal>
  getHistory(userId: string, days: number): Promise<DailyGoal[]>
  checkCompletion(userId: string): Promise<boolean>

  private resetForNewDay(userId: string): Promise<DailyGoal>
}
```

## 8.5 · ImmersionService

```typescript
class ImmersionService {
  getLogs(userId: string, filters: ImmersionFilters): Promise<ImmersionLog[]>
  createLog(userId: string, data: CreateImmersionInput): Promise<ImmersionLog>
  updateLog(userId: string, logId: string, data: UpdateImmersionInput): Promise<ImmersionLog>
  deleteLog(userId: string, logId: string): Promise<void>
  getStats(userId: string, period: 'week'|'month'|'year'|'all'): Promise<ImmersionStats>
}
```

## 8.6 · NotificationService

```typescript
class NotificationService {
  getNotifications(userId: string): Promise<Notification[]>
  getUnreadCount(userId: string): Promise<number>
  markAsRead(userId: string, notificationId: string): Promise<void>
  markAllAsRead(userId: string): Promise<void>
  delete(userId: string, notificationId: string): Promise<void>

  // Criação de notificações (chamados por outros serviços via eventos)
  createReviewDueNotification(userId: string, count: number): Promise<void>
  createStreakWarningNotification(userId: string): Promise<void>
  createGoalCompletedNotification(userId: string): Promise<void>
  createMilestoneNotification(userId: string, milestone: Milestone): Promise<void>
  createKanjiMasteredNotification(userId: string, kanji: string): Promise<void>
}
```

## 8.7 · AuthService

```typescript
class AuthService {
  register(data: RegisterInput): Promise<AuthResponse>
  login(email: string, password: string): Promise<AuthResponse>
  logout(refreshToken: string): Promise<void>
  refreshTokens(refreshToken: string): Promise<AuthResponse>
  forgotPassword(email: string): Promise<void>
  resetPassword(token: string, newPassword: string): Promise<void>
  verifyEmail(token: string): Promise<void>

  private generateAccessToken(user: User): string
  private generateRefreshToken(): string
  private hashPassword(password: string): Promise<string>
  private verifyPassword(plain: string, hash: string): Promise<boolean>
}
```

## 8.8 · DashboardService

```typescript
class DashboardService {
  getOverview(userId: string): Promise<DashboardOverview>
  getHeatmap(userId: string, year?: number): Promise<HeatmapData>
  getRecentActivity(userId: string, limit: number): Promise<ActivityItem[]>
  getMilestones(userId: string): Promise<MilestoneData>
  getWeeklySummary(userId: string): Promise<WeeklySummary[]>
}
```

## 8.9 · AITutorService

```typescript
class AITutorService {
  chat(userId: string, message: string, context?: ChatContext): Promise<AIResponse>
  explainItem(type: 'kanji'|'grammar'|'vocabulary', id: string): Promise<Explanation>
  generateExamples(type: string, id: string, count: number): Promise<Example[]>
  correctText(userId: string, text: string): Promise<CorrectionResult>
  translate(text: string, from: string, to: string): Promise<Translation>
}
```

---

# MÓDULO 09 — AUTENTICAÇÃO E AUTORIZAÇÃO

## 9.1 · Estratégia de Auth

```
┌──────────────────────────────────────────────────────┐
│  ACCESS TOKEN                                         │
│  Tipo: JWT                                           │
│  Expiração: 15 minutos                               │
│  Payload: { sub: userId, role, jlpt_level, iat, exp }│
│  Armazenado: memória do frontend (não localStorage)  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  REFRESH TOKEN                                        │
│  Tipo: UUID v4 opaco                                 │
│  Expiração: 30 dias                                  │
│  Armazenado: HTTP-only cookie (frontend) + hash na DB│
│  Rotação: a cada refresh, emite novo par             │
└──────────────────────────────────────────────────────┘
```

## 9.2 · Roles e Permissões

```
┌──────────────────────────────────────────────────────────┐
│ ROLE: student (padrão)                                    │
│ ├── CRUD em seu próprio progresso                         │
│ ├── Leitura de kanjis/vocabulário/gramática globais       │
│ ├── CRUD em suas próprias listas, logs, sentences         │
│ ├── Criar e responder sessões de revisão                  │
│ └── Gerenciar suas próprias notificações                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ ROLE: teacher                                             │
│ ├── Tudo do student                                       │
│ ├── Criar listas públicas                                 │
│ ├── Ver progresso de estudantes vinculados                │
│ └── Criar conteúdo suplementar                           │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ ROLE: admin                                               │
│ ├── Tudo do teacher                                       │
│ ├── CRUD completo no banco de kanjis global               │
│ ├── Importar/exportar dados em lote                       │
│ ├── Gerenciar usuários                                    │
│ └── Acessar métricas globais do sistema                   │
└──────────────────────────────────────────────────────────┘
```

## 9.3 · Guards NestJS

```typescript
// JWT Guard — valida access_token
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// Roles Guard — verifica permissão
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler())
    const { user } = context.switchToHttp().getRequest()
    return requiredRoles.includes(user.role)
  }
}

// Owner Guard — garante que usuário só acessa seus próprios dados
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user, params } = context.switchToHttp().getRequest()
    return user.id === params.userId || user.role === 'admin'
  }
}
```

## 9.4 · Rate Limiting

```
Regras de Rate Limit:
├── POST /auth/login           5 req/min por IP
├── POST /auth/register        3 req/min por IP
├── POST /auth/forgot-password 3 req/10min por email
├── GET  /kanji                100 req/min por usuário
├── POST /review/*             200 req/min por usuário (alta frequência)
├── POST /ai/chat              10 req/min por usuário
└── Default                    60 req/min por usuário
```

---

# MÓDULO 10 — ESTRUTURA DE PASTAS

```
fluency-os-backend/
│
├── src/
│   │
│   ├── modules/
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── owner.guard.ts
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── roles.decorator.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       ├── login.dto.ts
│   │   │       └── refresh-token.dto.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   └── dto/
│   │   │       ├── update-user.dto.ts
│   │   │       └── update-preferences.dto.ts
│   │   │
│   │   ├── kanji/
│   │   │   ├── kanji.module.ts
│   │   │   ├── kanji.controller.ts
│   │   │   ├── kanji.service.ts
│   │   │   ├── kanji.repository.ts
│   │   │   ├── kanji-progress.service.ts
│   │   │   ├── kanji-progress.repository.ts
│   │   │   └── dto/
│   │   │       ├── kanji-filters.dto.ts
│   │   │       └── kanji-response.dto.ts
│   │   │
│   │   ├── review/
│   │   │   ├── review.module.ts
│   │   │   ├── review.controller.ts
│   │   │   ├── review.service.ts
│   │   │   ├── srs.service.ts           ← Algoritmo SM-2
│   │   │   ├── review.repository.ts
│   │   │   └── dto/
│   │   │       ├── submit-answer.dto.ts
│   │   │       └── session-response.dto.ts
│   │   │
│   │   ├── vocabulary/
│   │   │   ├── vocabulary.module.ts
│   │   │   ├── vocabulary.controller.ts
│   │   │   ├── vocabulary.service.ts
│   │   │   └── vocabulary.repository.ts
│   │   │
│   │   ├── grammar/
│   │   │   ├── grammar.module.ts
│   │   │   ├── grammar.controller.ts
│   │   │   └── grammar.service.ts
│   │   │
│   │   ├── immersion/
│   │   │   ├── immersion.module.ts
│   │   │   ├── immersion.controller.ts
│   │   │   ├── immersion.service.ts
│   │   │   └── immersion.repository.ts
│   │   │
│   │   ├── sentences/
│   │   │   ├── sentences.module.ts
│   │   │   ├── sentences.controller.ts
│   │   │   └── sentences.service.ts
│   │   │
│   │   ├── streak/
│   │   │   ├── streak.module.ts
│   │   │   ├── streak.service.ts
│   │   │   └── streak.repository.ts
│   │   │
│   │   ├── daily-goal/
│   │   │   ├── daily-goal.module.ts
│   │   │   ├── daily-goal.service.ts
│   │   │   └── daily-goal.repository.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts
│   │   │   └── notifications.gateway.ts  ← WebSocket
│   │   │
│   │   ├── lists/
│   │   │   ├── lists.module.ts
│   │   │   ├── lists.controller.ts
│   │   │   └── lists.service.ts
│   │   │
│   │   ├── dashboard/
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.controller.ts
│   │   │   └── dashboard.service.ts
│   │   │
│   │   └── ai/
│   │       ├── ai.module.ts
│   │       ├── ai.controller.ts
│   │       └── ai.service.ts
│   │
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── prisma.service.ts
│   │   └── migrations/
│   │       └── ...
│   │
│   ├── shared/
│   │   ├── types/
│   │   │   ├── jlpt.enum.ts
│   │   │   ├── role.enum.ts
│   │   │   └── pagination.type.ts
│   │   ├── utils/
│   │   │   ├── hash.util.ts
│   │   │   ├── date.util.ts
│   │   │   └── pagination.util.ts
│   │   └── interceptors/
│   │       ├── response-transform.interceptor.ts
│   │       └── logging.interceptor.ts
│   │
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── redis.config.ts
│   │   └── cors.config.ts
│   │
│   ├── middleware/
│   │   ├── request-logger.middleware.ts
│   │   └── rate-limit.middleware.ts
│   │
│   ├── events/
│   │   ├── events.module.ts
│   │   ├── event-emitter.service.ts
│   │   └── handlers/
│   │       ├── streak.handler.ts
│   │       ├── daily-goal.handler.ts
│   │       ├── notification.handler.ts
│   │       └── milestone.handler.ts
│   │
│   ├── jobs/
│   │   ├── jobs.module.ts
│   │   ├── daily-reset.job.ts          ← Roda à meia-noite
│   │   ├── streak-warning.job.ts       ← 20h — avisa sobre streak
│   │   └── review-reminder.job.ts      ← Avisa sobre revisões
│   │
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
│   │   ├── srs.service.spec.ts
│   │   ├── streak.service.spec.ts
│   │   └── kanji.service.spec.ts
│   └── e2e/
│       ├── auth.e2e.spec.ts
│       ├── review.e2e.spec.ts
│       └── kanji.e2e.spec.ts
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

---

# MÓDULO 11 — EVENTOS E AUTOMAÇÕES

## 11.1 · Catálogo de Eventos

```
┌─────────────────────────────────────────────────────────────────┐
│  EVENTOS DO SISTEMA — FLUENCY OS                                │
└─────────────────────────────────────────────────────────────────┘

REVIEW EVENTS
────────────────────────────────────────
REVIEW_SESSION_STARTED
  Payload: { userId, sessionId, sessionType, totalItems }
  Handlers: → LogService (analytics)

REVIEW_ANSWER_SUBMITTED
  Payload: { userId, sessionId, itemId, itemType, quality, newSrsLevel }
  Handlers: → StreakService, DailyGoalService, MilestoneService

REVIEW_SESSION_COMPLETED
  Payload: { userId, sessionId, accuracy, duration, totalReviewed }
  Handlers: → NotificationService, AnalyticsService

REVIEW_SESSION_ABANDONED
  Payload: { userId, sessionId, reviewedCount }
  Handlers: → LogService

KANJI EVENTS
────────────────────────────────────────
KANJI_ADDED
  Payload: { userId, kanjiId, srsLevel: 1 }
  Handlers: → DailyGoalService, StreakService

KANJI_REVIEWED
  Payload: { userId, kanjiId, quality, newSrsLevel }
  Handlers: → StreakService, DailyGoalService

KANJI_MASTERED
  Payload: { userId, kanjiId, character, timeToMaster }
  Handlers: → NotificationService (🎉 "Você dominou 日!"), MilestoneService

KANJI_FAVORITED
  Payload: { userId, kanjiId, isFavorited }

KANJI_SUSPENDED
  Payload: { userId, kanjiId, isSuspended }

STREAK EVENTS
────────────────────────────────────────
STREAK_UPDATED
  Payload: { userId, currentStreak, longestStreak, wasNewRecord }
  Handlers: → NotificationService, MilestoneService

STREAK_BROKEN
  Payload: { userId, previousStreak, reason }
  Handlers: → NotificationService ("Seu streak foi quebrado 😢")

STREAK_FREEZE_USED
  Payload: { userId, freezesRemaining }
  Handlers: → NotificationService ("Streak protegido! ✨")

STREAK_MILESTONE
  Payload: { userId, milestone: 7 | 30 | 100 | 365 }
  Handlers: → NotificationService, MilestoneService

DAILY GOAL EVENTS
────────────────────────────────────────
DAILY_GOAL_COMPLETED
  Payload: { userId, date, minutesStudied, kanjisReviewed }
  Handlers: → NotificationService ("Meta do dia concluída! 🎯"), StreakService

DAILY_GOAL_PROGRESS
  Payload: { userId, percentage }

IMMERSION EVENTS
────────────────────────────────────────
IMMERSION_LOGGED
  Payload: { userId, logId, sourceType, minutes, immersionType }
  Handlers: → DailyGoalService, StreakService

SENTENCE_MINED
  Payload: { userId, sentenceId, source }
  Handlers: → MilestoneService

MILESTONE EVENTS
────────────────────────────────────────
MILESTONE_ACHIEVED
  Payload: { userId, type, value, achievedAt }
  Handlers: → NotificationService, WebSocketGateway (notificação real-time)
  
  Tipos de milestone:
  ├── KANJIS_MASTERED: 10, 25, 50, 100, 200, 500
  ├── STREAK_DAYS: 7, 30, 100, 365
  ├── VOCABULARY_MASTERED: 100, 500, 1000, 2000
  ├── TOTAL_REVIEWS: 100, 500, 1000, 5000
  ├── JLPT_N5_COMPLETE
  ├── JLPT_N4_COMPLETE
  └── JLPT_N3_COMPLETE
```

## 11.2 · Jobs Agendados

```
┌─────────────────────────────────────────────────────────────────┐
│  SCHEDULED JOBS                                                 │
└─────────────────────────────────────────────────────────────────┘

DAILY_RESET_JOB
  Horário: 00:00 no timezone de cada usuário
  Ação: Cria novo daily_goal, reseta contadores diários
  Implementação: Bull Queue + timezone grouping

STREAK_WARNING_JOB
  Horário: 20:00 no timezone do usuário (se streak > 0 e sem atividade hoje)
  Ação: Envia push notification "Seu streak de X dias está em risco!"
  Filtro: Apenas usuários com current_streak >= 3

REVIEW_REMINDER_JOB
  Horário: 09:00 no timezone do usuário
  Ação: Notifica se fila de revisão > 10 itens
  Mensagem: "Você tem 42 kanjis para revisar hoje"

STREAK_FREEZE_REMINDER_JOB
  Horário: 22:00 (se streak foi congelado ontem e sem atividade hoje)
  Ação: Último aviso antes de perder o streak

ANALYTICS_AGGREGATION_JOB
  Horário: 03:00 UTC (diário)
  Ação: Agrega métricas do dia para relatórios
```

---

# MÓDULO 12 — WEBSOCKETS E TEMPO REAL

## 12.1 · Gateway de WebSocket

```typescript
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL },
  namespace: '/realtime'
})
export class RealtimeGateway {
  @WebSocketServer()
  server: Server

  // Cliente conecta e se autentica
  @SubscribeMessage('auth')
  handleAuth(@ConnectedSocket() client: Socket, @MessageBody() data: { token: string }) {
    const user = this.authService.verifyToken(data.token)
    client.join(`user:${user.id}`)  // Room privado do usuário
  }
}
```

## 12.2 · Eventos em Tempo Real

```
EVENTOS ENVIADOS DO SERVIDOR → CLIENTE

review_queue_updated
  Quando: Novo item adicionado à fila
  Payload: { new_count: 43 }
  Uso: Atualiza badge "Revisar 43" em tempo real

notification_received
  Quando: Nova notificação criada
  Payload: { id, type, title, message }
  Uso: Exibe toast + atualiza sino de notificações

streak_updated
  Quando: Streak incrementa ou quebra
  Payload: { current, longest, wasNewRecord }
  Uso: Animação de streak no sidebar

daily_goal_progress
  Quando: Progresso da meta muda
  Payload: { actual_minutes, goal_minutes, percentage }
  Uso: Atualiza barra de progresso em tempo real

milestone_achieved
  Quando: Marco atingido
  Payload: { type, value, title, description }
  Uso: Modal de celebração 🎉

session_sync
  Quando: Resposta de revisão salva
  Payload: { reviewed_count, accuracy, remaining }
  Uso: Atualiza UI da sessão de revisão
```

---

# MÓDULO 13 — ESCALABILIDADE E INFRAESTRUTURA

## 13.1 · Stack Completa

```
┌─────────────────────────────────────────────────────────────────┐
│  STACK DE PRODUÇÃO — FLUENCY OS                                 │
└─────────────────────────────────────────────────────────────────┘

FRONTEND
├── Next.js 15 (App Router)
├── TypeScript 5
├── Tailwind CSS 3
├── shadcn/ui
├── Framer Motion
├── TanStack Query (React Query) — cache + fetching
├── Zustand — estado global leve
└── Socket.io Client — WebSocket

BACKEND
├── NestJS 10 (Node.js)
├── TypeScript 5
├── Prisma ORM — type-safe queries
├── class-validator + class-transformer
├── Passport.js (JWT + Local strategies)
├── Bull — fila de jobs (Redis-backed)
├── Socket.io — WebSocket server
└── Swagger/OpenAPI — docs automáticas

BANCO DE DADOS
├── PostgreSQL 16 — dados principais
├── Redis 7 — cache, sessões, filas, rate limit
└── S3-compatible (Cloudflare R2) — áudios, avatars

INFRAESTRUTURA
├── Docker + Docker Compose
├── GitHub Actions — CI/CD
├── Cloudflare — CDN, DNS, DDoS protection
└── VPS (Hostinger VPS 4 ou Contabo) — servidor principal
```

## 13.2 · Estratégia de Cache (Redis)

```
┌─────────────────────────────────────────────────────────────────┐
│  CAMADAS DE CACHE                                               │
└─────────────────────────────────────────────────────────────────┘

CACHE DE CONTEÚDO GLOBAL (imutável entre usuários)
  Key: kanji:{id}
  TTL: 24 horas
  Invalida: quando admin edita o kanji

  Key: kanji:list:jlpt:{N5}
  TTL: 1 hora
  Conteúdo: lista de kanjis por nível

  Key: grammar:{id}
  TTL: 24 horas

CACHE DE PROGRESSO DO USUÁRIO
  Key: user:{userId}:stats
  TTL: 5 minutos
  Invalida: após revisão, imersão, ou adição de kanji

  Key: user:{userId}:review_queue_count
  TTL: 1 minuto
  Conteúdo: contagem da fila de revisão

  Key: user:{userId}:daily_goal:{date}
  TTL: até meia-noite do dia
  Invalida: quando progresso é atualizado

RATE LIMITING
  Key: rate_limit:{ip}:{endpoint}
  TTL: Janela de tempo configurada (1 min, 10 min)
  Tipo: contador Redis (INCR + EXPIRE)

SESSÕES DE REVISÃO
  Key: review_session:{sessionId}:queue
  TTL: 4 horas (sessão expira se abandonada)
  Conteúdo: fila de itens ordenada da sessão atual

BLACKLIST DE TOKENS
  Key: token_blacklist:{jti}
  TTL: até expiração do token original
  Uso: quando usuário faz logout
```

## 13.3 · Estratégia de Filas (Bull + Redis)

```
FILAS DEFINIDAS

review-processing
  Prioridade: Alta
  Concorrência: 10 workers
  Jobs: processar resposta SRS, atualizar progresso

notifications
  Prioridade: Média
  Concorrência: 5 workers
  Jobs: criar e enviar notificações

email
  Prioridade: Baixa
  Concorrência: 2 workers
  Jobs: emails de boas-vindas, reset de senha, relatório semanal

scheduled-jobs
  Tipo: Cron jobs
  Jobs: daily reset, streak warning, review reminder

analytics
  Prioridade: Baixa
  Concorrência: 1 worker
  Jobs: agregação de métricas diárias
```

## 13.4 · Monitoramento e Observabilidade

```
LOGS
  Biblioteca: Winston + pino
  Estrutura: JSON estruturado
  Níveis: error, warn, info, debug
  Destino: stdout + arquivo rotativo

MÉTRICAS
  Biblioteca: prom-client (Prometheus)
  Exposição: GET /metrics
  Métricas coletadas:
    ├── http_requests_total (por rota e status)
    ├── http_request_duration_seconds
    ├── review_sessions_total
    ├── active_users_gauge
    └── srs_queue_size_gauge

HEALTH CHECK
  GET /health → { status: "ok", database: "ok", redis: "ok" }
  GET /health/live → liveness probe (Kubernetes)
  GET /health/ready → readiness probe

ALERTAS (via Grafana)
  ├── Error rate > 1% por 5 minutos
  ├── P95 latency > 500ms
  ├── Database connection pool > 80%
  └── Redis memory > 80%
```

## 13.5 · Estratégia de Backup

```
PostgreSQL
  Frequência: Diário completo + WAL contínuo
  Retenção: 30 dias
  Destino: Cloudflare R2 (bucket separado)
  Restore test: semanal

Redis
  Frequência: RDB snapshot a cada hora
  Retenção: 7 dias
  Nota: Redis é apenas cache — pode ser reconstruído
```

---

# MÓDULO 14 — DOCUMENTAÇÃO EXECUTIVA FINAL

## 14.1 · Resumo Executivo

**Fluency OS** é um ecossistema premium de aquisição natural da língua japonesa. Sua arquitetura backend foi desenhada para suportar uma experiência de aprendizado baseada em SRS (Spaced Repetition System), imersão, e rastreamento de progresso granular.

O sistema é construído sobre uma base de **NestJS + PostgreSQL + Redis**, com uma clara separação de responsabilidades por módulo, arquitetura orientada a eventos, e suporte a tempo real via WebSocket.

---

## 14.2 · Mapa de Entidades

```
20 entidades identificadas:

Core:          users, user_preferences, refresh_tokens
Kanji:         kanjis, kanji_meanings, kanji_readings, kanji_examples, radicals, kanji_radicals
Progress:      user_kanji_progress, user_vocabulary_progress
Review:        review_sessions, review_answers
Vocabulary:    vocabulary, vocabulary_meanings
Grammar:       grammar_points, grammar_explanations, grammar_examples
Streak:        streaks, streak_history
Goals:         daily_goals
Immersion:     immersion_logs, mined_sentences
Organization:  custom_lists, custom_list_items
System:        notifications
```

## 14.3 · Estimativa de Complexidade por Módulo

```
┌────────────────────────────────────────────┬──────────────┬────────────────┐
│ Módulo                                     │ Complexidade │ Estimativa     │
├────────────────────────────────────────────┼──────────────┼────────────────┤
│ Auth (JWT + refresh + roles)               │ Média        │ 3–4 dias       │
│ Banco de Kanji (CRUD + busca full-text)    │ Média        │ 4–5 dias       │
│ SRS Engine (algoritmo SM-2 completo)       │ Alta         │ 5–7 dias       │
│ Review Sessions (fluxo completo)           │ Alta         │ 4–6 dias       │
│ Streak System (timezone, freeze)           │ Média-Alta   │ 3–4 dias       │
│ Daily Goal (reset timezone + progresso)    │ Média        │ 2–3 dias       │
│ Dashboard Aggregation (queries complexas)  │ Alta         │ 4–5 dias       │
│ Immersion + Sentence Mining                │ Média        │ 3–4 dias       │
│ Vocabulary + Grammar                       │ Baixa-Média  │ 3–4 dias       │
│ Custom Lists                               │ Baixa        │ 2 dias         │
│ Notifications + WebSocket                  │ Média-Alta   │ 4–5 dias       │
│ Event System + Jobs Agendados              │ Alta         │ 3–4 dias       │
│ AI Tutor Integration                       │ Alta         │ 5–7 dias       │
│ Admin CRUD + Import/Export                 │ Média        │ 3–4 dias       │
│ Cache Layer (Redis)                        │ Média        │ 2–3 dias       │
│ Infraestrutura + Docker + CI/CD            │ Média        │ 2–3 dias       │
│ Testes (unit + e2e)                        │ Alta         │ 5–7 dias       │
├────────────────────────────────────────────┼──────────────┼────────────────┤
│ TOTAL ESTIMADO                             │              │ 60–80 dias dev │
└────────────────────────────────────────────┴──────────────┴────────────────┘
```

## 14.4 · Fases de Desenvolvimento Recomendadas

```
FASE 1 — MVP Core (Semanas 1–4)
  ├── Auth (register, login, JWT, refresh)
  ├── Banco de Kanji (CRUD global + busca)
  ├── Progresso de Kanji (user_kanji_progress)
  ├── Review Session + SRS Engine básico
  ├── Streak básico
  ├── Daily Goal básico
  └── Dashboard Overview

FASE 2 — Conteúdo Expandido (Semanas 5–8)
  ├── Vocabulário completo
  ├── Gramática completa
  ├── Banco de Frases / Sentence Mining
  ├── Imersão Log
  ├── Custom Lists
  └── Notificações

FASE 3 — Experiência Premium (Semanas 9–12)
  ├── WebSocket em tempo real
  ├── Milestones + gamificação
  ├── Jobs agendados (streak warning, review reminder)
  ├── AI Tutor Integration
  ├── Admin panel
  └── Analytics e relatórios

FASE 4 — Produção (Semanas 13–16)
  ├── Cache Layer Redis
  ├── Rate Limiting
  ├── Testes unitários e e2e
  ├── Docker + CI/CD
  ├── Monitoramento Prometheus/Grafana
  └── Deploy e hardening de segurança
```

## 14.5 · Pontos de Atenção Críticos

```
⚠️  TIMEZONE
    O streak e as metas dependem do timezone do usuário.
    Todos os resets de meia-noite devem ser calculados por timezone,
    não em UTC. Usar Bull com timezone support.

⚠️  SRS QUEUE PERFORMANCE
    A query da fila de revisão roda constantemente.
    O índice idx_ukp_review_queue é CRÍTICO para performance.
    Monitorar explain analyze em produção.

⚠️  REFRESH TOKEN ROTATION
    Implementar detecção de token reuse (roubo de token):
    se o mesmo refresh_token for usado 2x, revogar TODOS os tokens do usuário.

⚠️  CONSISTENCY DE DADOS
    SRS updates devem ser atômicos (transação DB).
    Nunca atualizar progress + answer em requests separados.

⚠️  AI TUTOR RATE & COST
    Limitar fortemente as chamadas à API de AI.
    Implementar cache de respostas para perguntas comuns.
    Rate limit: 10 mensagens/minuto por usuário.

⚠️  SEED DE DADOS
    O banco de kanjis precisa de um seed inicial robusto.
    Usar fonte oficial: KANJIDIC2 (XML da Monash University).
    Importar 2136 kanjis + leituras + significados + radicais.
```

## 14.6 · Referências de Dados

```
FONTES PARA SEED INICIAL

Kanjis:
  KANJIDIC2     — kanjis, leituras, significados, grade, stroke
  KanjiVG       — stroke order SVG
  JMdict        — exemplos e vocabulário
  JLPT lists    — classificação N5–N1

Vocabulário:
  JMdict        — 170,000+ entradas
  JPDB.io API   — frequência real em anime/dorama
  Core 2000/6000 — vocabulário essencial ordenado

Frequência:
  Innocent Corpus — frequência em romances japoneses
  Anime Subtitle Corpus — frequência em anime/dorama
```

---

> **Fluency OS Backend Spec v1.0**  
> Documento gerado para a equipe de desenvolvimento  
> Arquitetura: NestJS · PostgreSQL · Redis · WebSocket  
> Stack Frontend: Next.js 15 · TypeScript · Tailwind · shadcn/ui  
> Licença: Interno — Não distribuir

---
*fim do documento*
