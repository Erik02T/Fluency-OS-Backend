export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all';

export type AnalyticsGranularity = 'day' | 'week';

export interface StudySeriesPoint {
  date: string;
  kanjiAdded: number;
  vocabularyAdded: number;
  grammarStudied: number;
  kanjiReviewed: number;
  vocabularyReviewed: number;
  immersionMinutes: number;
}

export interface ImmersionBreakdownPoint {
  type: string;
  totalMinutes: number;
}

export interface AnalyticsSummary {
  totalKanji: number;
  masteredKanji: number;
  totalVocabulary: number;
  masteredVocabulary: number;
  totalGrammar: number;
  studiedGrammar: number;
  totalReviews: number;
  accuracyRate: number | null;
  totalImmersionMinutes: number;
  currentStreakDays: number;
  longestStreakDays: number;
}
