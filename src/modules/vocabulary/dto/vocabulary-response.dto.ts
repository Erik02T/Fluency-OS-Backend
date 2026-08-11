import { JLPTLevel } from '@prisma/client';

export class VocabularyListResponseDto {
  id!: string;
  word!: string;
  reading!: string;
  jlpt!: JLPTLevel | null;
  frequency!: number | null;
  partOfSpeech!: string | null;
  tags!: string[];
  primaryMeaning!: string;

  userProgress?: {
    srsLevel: number;
    isMastered: boolean;
    isFavorited: boolean;
    isSuspended: boolean;
  };
}

export class PaginatedVocabularyResponseDto {
  data!: VocabularyListResponseDto[];
  pagination!: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
}

export class VocabularyDetailResponseDto {
  id!: string;
  word!: string;
  reading!: string;
  jlpt!: JLPTLevel | null;
  frequency!: number | null;
  partOfSpeech!: string | null;
  tags!: string[];
  notes!: string | null;
  audioUrl!: string | null;
  meanings!: Array<{
    meaning: string;
    context: string | null;
    isPrimary: boolean;
  }>;
  examples!: Array<{
    japanese: string;
    reading: string | null;
    translation: string;
    source: string | null;
  }>;

  userProgress?: {
    srsLevel: number;
    isMastered: boolean;
    isFavorited: boolean;
    isSuspended: boolean;
    easeFactor: number;
    intervalDays: number;
    nextReviewAt: Date;
    lastReviewedAt?: Date;
    totalReviews: number;
    correctReviews: number;
  };
}

export class VocabularyProgressResponseDto {
  vocabularyId!: string;
  srsLevel!: number;
  isMastered!: boolean;
  isFavorited!: boolean;
  isSuspended!: boolean;
  easeFactor!: number;
  intervalDays!: number;
  nextReviewAt!: Date;
  lastReviewedAt?: Date;
  totalReviews!: number;
  correctReviews!: number;
  addedAt!: Date;
  masteredAt?: Date;
}
