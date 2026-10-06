import {
  ReviewQuality,
  ReviewSessionStatus,
  SRSItemType,
} from '@prisma/client';

export interface SRSProgressState {
  srsLevel: number;
  easeFactor: number;
  intervalDays: number;
  isMastered?: boolean;
}

export interface CalculateNextReviewResult {
  previousSrsLevel: number;
  newSrsLevel: number;
  previousEaseFactor: number;
  newEaseFactor: number;
  previousInterval: number;
  newInterval: number;
  nextReviewAt: Date;
  isMastered: boolean;
  quality: ReviewQuality;
}

export interface KanjiItemPayload {
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

export interface VocabularyItemPayload {
  id: string;
  word: string;
  reading: string;
  meanings: string[];
  jlpt?: string | null;
}

export interface ReviewQueueItemEntity {
  progressId: string;
  itemType: SRSItemType;
  itemId: string;
  item: KanjiItemPayload | VocabularyItemPayload;
  srsLevel: number;
  easeFactor: number;
  intervalDays: number;
  lastReviewedAt: Date | null;
  nextReviewAt: Date;
  reviewCount: number;
  correctReviews: number;
}

export interface ReviewSessionEntity {
  id: string;
  userId: string;
  status: ReviewSessionStatus;
  itemType: SRSItemType;
  totalItems: number;
  completedItems: number;
  correctItems: number;
  accuracyRate: number | null;
  durationSeconds: number | null;
  startedAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
}

export interface ReviewAnswerEntity {
  id: string;
  sessionId: string;
  itemType: SRSItemType;
  itemId: string;
  quality: ReviewQuality;
  responseTimeMs: number | null;
  srsLevelBefore: number;
  srsLevelAfter: number;
  intervalBefore: number;
  intervalAfter: number;
  answeredAt: Date;
}
