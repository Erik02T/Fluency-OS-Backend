import {
  PlannerGoalCategory,
  PlannerCategory,
  PlannerTaskStatus,
} from '@prisma/client';

/**
 * RN-PLN002 — Threshold de conclusão diária ("dia bom"):
 * >= 80% das tarefas do dia concluídas OU daily_goal marcada como concluída
 * registra atividade de streak no dia (timezone do usuário).
 */
export const DAILY_COMPLETION_THRESHOLD_PERCENT = 80;

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export interface CategoryMeta {
  label: string;
  glyph: string;
  domain: 'kanji' | 'vocabulary' | 'grammar' | 'immersion' | 'general';
}

/** Labels/glyphs exatamente como o frontend (add-task-modal.tsx) apresenta. */
export const CATEGORY_META: Record<PlannerCategory, CategoryMeta> = {
  [PlannerCategory.KANJI]: { label: 'Kanji', glyph: '字', domain: 'kanji' },
  [PlannerCategory.VOCABULARY]: {
    label: 'Vocabulário',
    glyph: '語',
    domain: 'vocabulary',
  },
  [PlannerCategory.GRAMMAR]: {
    label: 'Gramática',
    glyph: '文',
    domain: 'grammar',
  },
  [PlannerCategory.CHUNK]: {
    label: 'Chunks & Expressões',
    glyph: '塊',
    domain: 'vocabulary',
  },
  [PlannerCategory.READING]: {
    label: 'Leitura',
    glyph: '読',
    domain: 'general',
  },
  [PlannerCategory.IMMERSION]: {
    label: 'Imersão',
    glyph: '映',
    domain: 'immersion',
  },
  [PlannerCategory.ACTIVE_STUDY]: {
    label: 'Estudo Ativo',
    glyph: '学',
    domain: 'general',
  },
  [PlannerCategory.PASSIVE_STUDY]: {
    label: 'Estudo Passivo',
    glyph: '聴',
    domain: 'general',
  },
  [PlannerCategory.REVIEW]: {
    label: 'Revisão Geral',
    glyph: '復',
    domain: 'general',
  },
  [PlannerCategory.GENERAL]: {
    label: 'Geral',
    glyph: '全',
    domain: 'general',
  },
  [PlannerCategory.OTHER]: {
    label: 'Outro',
    glyph: '他',
    domain: 'general',
  },
};

/** Mapeia categoria de tarefa → categoria de meta semanal. */
export const TASK_CATEGORY_TO_GOAL: Record<
  PlannerCategory,
  PlannerGoalCategory
> = {
  [PlannerCategory.KANJI]: PlannerGoalCategory.KANJI,
  [PlannerCategory.VOCABULARY]: PlannerGoalCategory.VOCABULARY,
  [PlannerCategory.CHUNK]: PlannerGoalCategory.VOCABULARY,
  [PlannerCategory.GRAMMAR]: PlannerGoalCategory.GRAMMAR,
  [PlannerCategory.REVIEW]: PlannerGoalCategory.GENERAL_REVIEW,
  [PlannerCategory.GENERAL]: PlannerGoalCategory.GENERAL_REVIEW,
  [PlannerCategory.OTHER]: PlannerGoalCategory.GENERAL_REVIEW,
  [PlannerCategory.READING]: PlannerGoalCategory.READING,
  [PlannerCategory.IMMERSION]: PlannerGoalCategory.IMMERSION,
  [PlannerCategory.ACTIVE_STUDY]: PlannerGoalCategory.ACTIVE_STUDY,
  [PlannerCategory.PASSIVE_STUDY]: PlannerGoalCategory.PASSIVE_STUDY,
};

/** Metas de tempo são somadas em minutos; demais são contagem de tarefas. */
export const TIME_BASED_GOALS: ReadonlySet<PlannerGoalCategory> = new Set([
  PlannerGoalCategory.IMMERSION,
  PlannerGoalCategory.READING,
  PlannerGoalCategory.ACTIVE_STUDY,
  PlannerGoalCategory.PASSIVE_STUDY,
]);

export interface GoalMeta {
  name: string;
  glyph: string;
  unit: string;
  targetValue: number;
}

/** Defaults criados junto do WeeklyPlan (labels iguais a edit-goals-modal.tsx). */
export const GOAL_META: Record<PlannerGoalCategory, GoalMeta> = {
  [PlannerGoalCategory.IMMERSION]: {
    name: 'Tempo de Imersão',
    glyph: '時',
    unit: 'min',
    targetValue: 300,
  },
  [PlannerGoalCategory.KANJI]: {
    name: 'Kanji Revisados',
    glyph: '字',
    unit: '',
    targetValue: 50,
  },
  [PlannerGoalCategory.VOCABULARY]: {
    name: 'Palavras Novas/Revisão',
    glyph: '語',
    unit: '',
    targetValue: 100,
  },
  [PlannerGoalCategory.GENERAL_REVIEW]: {
    name: 'Revisões Gerais',
    glyph: '復',
    unit: '',
    targetValue: 200,
  },
  [PlannerGoalCategory.GRAMMAR]: {
    name: 'Pontos Gramaticais',
    glyph: '文',
    unit: '',
    targetValue: 10,
  },
  [PlannerGoalCategory.READING]: {
    name: 'Leitura',
    glyph: '読',
    unit: 'min',
    targetValue: 60,
  },
  [PlannerGoalCategory.ACTIVE_STUDY]: {
    name: 'Estudo Ativo',
    glyph: '学',
    unit: 'min',
    targetValue: 120,
  },
  [PlannerGoalCategory.PASSIVE_STUDY]: {
    name: 'Estudo Passivo',
    glyph: '聴',
    unit: 'min',
    targetValue: 120,
  },
};

export const PLANNER_TASK_STATUS_VALUES = Object.values(PlannerTaskStatus);
