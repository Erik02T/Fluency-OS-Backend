export type PlannerTaskDomain =
  | 'kanji'
  | 'vocabulary'
  | 'grammar'
  | 'immersion'
  | 'general';

export type PlannerTaskPriority = 'high' | 'medium' | 'low';

export interface PlannerTaskDto {
  id: string;
  domain: PlannerTaskDomain;
  task: string;
  description: string | null;
  priority: PlannerTaskPriority;
  estimatedMinutes: number;
  kanjiGlyph: string;
  dueAt: string;
  action:
    | { type: 'review_kanji'; count: number }
    | { type: 'review_vocabulary'; count: number }
    | { type: 'study_grammar'; count: number }
    | { type: 'immersion'; targetMinutes: number; loggedMinutes: number }
    | { type: 'daily_review'; targetCount: number; completedCount: number }
    | { type: 'general'; note: string };
}

export interface PlannerHabitDto {
  id: string;
  name: string;
  kanji: string;
  domain: PlannerTaskDomain;
  streak: number;
  completedThisWeek: boolean[];
  weeklyTarget: number;
}

export interface PlannerWeeklyGoalDto {
  name: string;
  kanji: string;
  current: number;
  target: number;
  unit: string;
}

export interface PlannerWeekDayDto {
  date: number;
  day: string;
  isToday: boolean;
}

export interface PlannerSummaryDto {
  tasksCompletedToday: number;
  tasksTotalToday: number;
  studyMinutesToday: number;
  currentStreakDays: number;
  longestStreakDays: number;
  todayDateLabel: string;
}

export interface PlannerOverviewResponseDto {
  week: PlannerWeekDayDto[];
  habits: PlannerHabitDto[];
  todayTasks: PlannerTaskDto[];
  weeklyGoals: PlannerWeeklyGoalDto[];
  summary: PlannerSummaryDto;
}
