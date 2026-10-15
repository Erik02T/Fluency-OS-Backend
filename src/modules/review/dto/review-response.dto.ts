import type { ReviewSessionTypeValue } from './review-session.dto';

export type ReviewStatusValue = 'in_progress' | 'completed' | 'abandoned';
export type ReviewItemTypeValue = 'kanji' | 'vocabulary' | 'sentence';

export interface ReviewQueueKanjiItemDto {
  id: string;
  character: string;
  meanings: string[];
  readings: {
    onyomi: string[];
    kunyomi: string[];
  };
  jlpt: string;
  strokes: number;
  grade?: number;
  frequency?: number;
}

export interface ReviewQueueVocabularyItemDto {
  id: string;
  word: string;
  reading: string;
  meanings: string[];
  jlpt?: string | null;
  partOfSpeech?: string | null;
}

export interface ReviewQueueItemDto {
  progress_id: string;
  item_type: ReviewItemTypeValue;
  item:
    | ReviewQueueKanjiItemDto
    | ReviewQueueVocabularyItemDto
    | Record<string, unknown>;
  srs_level: number;
  last_reviewed_at: string | null;
  next_review_at: string;
  review_count: number;
}

export interface ReviewQueueResponseDto {
  total_due: number;
  items: ReviewQueueItemDto[];
  by_type: {
    kanji: number;
    vocabulary: number;
    grammar: number;
  };
}

export interface ReviewQueueCountResponseDto {
  kanji: number;
  vocabulary: number;
  total: number;
}

export interface ReviewAnswerItemDto {
  id: string;
  item_type: ReviewItemTypeValue;
  item_id: string;
  quality: number;
  quality_name: string;
  response_time_ms?: number | null;
  srs_level_before: number;
  srs_level_after: number;
  interval_before: number;
  interval_after: number;
  answered_at: string;
}

export interface ReviewSessionResponseDto {
  id: string;
  user_id: string;
  session_type: ReviewItemTypeValue;
  status: ReviewStatusValue;
  total_items: number;
  reviewed_items: number;
  correct_items: number;
  incorrect_items: number;
  accuracy_rate: number | null;
  duration_seconds: number | null;
  started_at: string;
  completed_at: string | null;
  abandoned_at?: string | null;
  answers?: ReviewAnswerItemDto[];
}

export interface SessionProgressDto {
  reviewed: number;
  total: number;
  correct: number;
  incorrect: number;
}

export interface ReviewAnswerResponseDto {
  previous_srs_level: number;
  new_srs_level: number;
  previous_interval: number;
  new_interval: number;
  next_review_at: string;
  is_mastered: boolean;
  session_progress: SessionProgressDto;
}

export interface ReviewPaginationDto {
  page: number;
  perPage: number;
  total: number;
  pages: number;
}

export interface PaginatedReviewSessionResponseDto {
  data: ReviewSessionResponseDto[];
  pagination: ReviewPaginationDto;
}

export interface QualityBreakdownDto {
  blackout: number;
  wrong: number;
  correct_hard: number;
  correct_easy: number;
}

export interface ReviewSessionStatsResponseDto {
  session_id: string;
  status: ReviewStatusValue;
  session_type: ReviewItemTypeValue;
  total_items: number;
  reviewed_items: number;
  correct_items: number;
  incorrect_items: number;
  accuracy_rate: number;
  duration_seconds: number;
  average_response_time_ms?: number | null;
  mastered_count: number;
  quality_breakdown: QualityBreakdownDto;
  started_at: string;
  completed_at: string | null;
}

export type { ReviewSessionTypeValue };
