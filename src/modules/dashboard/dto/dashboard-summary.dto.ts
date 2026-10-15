/**
 * Contrato de GET /dashboard/summary.
 *
 * Campos originais (kanjiStudied, kanjiMastered, dueReviews, favoriteKanjis,
 * totalReviews, accuracyRate, currentStreak, longestStreak, lastReviewAt)
 * preservados com os mesmos nomes e tipos. Os campos vocabularyStudied,
 * vocabularyMastered e grammarStudied são extensões aditivas (não quebram
 * consumidores existentes).
 */
export interface DashboardSummaryResponse {
  kanjiStudied: number;
  kanjiMastered: number;
  dueReviews: number;
  favoriteKanjis: number;
  totalReviews: number;
  accuracyRate: number;
  currentStreak: number;
  longestStreak: number;
  lastReviewAt: string | null;
  // Extensão Fase 6 — Vocabulário e Gramática
  vocabularyStudied: number;
  vocabularyMastered: number;
  grammarStudied: number;
}
