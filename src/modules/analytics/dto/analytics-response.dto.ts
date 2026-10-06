export class AnalyticsSummaryDto {
  totalKanji!: number;
  masteredKanji!: number;
  totalVocabulary!: number;
  masteredVocabulary!: number;
  totalGrammar!: number;
  studiedGrammar!: number;
  totalReviews!: number;
  accuracyRate!: number | null;
  totalImmersionMinutes!: number;
  currentStreakDays!: number;
  longestStreakDays!: number;
}

export class StudySeriesPointDto {
  date!: string;
  kanjiAdded!: number;
  vocabularyAdded!: number;
  grammarStudied!: number;
  kanjiReviewed!: number;
  vocabularyReviewed!: number;
  immersionMinutes!: number;
}

export class ImmersionBreakdownPointDto {
  type!: string;
  totalMinutes!: number;
}

export class AnalyticsOverviewResponseDto {
  summary!: AnalyticsSummaryDto;
  studyTimeSeries!: StudySeriesPointDto[];
  immersionBreakdown!: ImmersionBreakdownPointDto[];
}
