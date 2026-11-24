import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  REVIEW_HISTORY_STATUSES,
  REVIEW_QUALITY_VALUES,
  REVIEW_SESSION_TYPES,
} from './review-session.dto';

const READABLE_REVIEW_TYPES = [...REVIEW_SESSION_TYPES, 'sentence'] as const;
const QUALITY_NAMES = [
  'blackout',
  'wrong',
  'correct_hard',
  'correct_easy',
] as const;

export type ReviewStatusValue = (typeof REVIEW_HISTORY_STATUSES)[number];
export type ReviewItemTypeValue = (typeof READABLE_REVIEW_TYPES)[number];

class ReviewKanjiReadingsDto {
  @ApiProperty({ type: [String] })
  onyomi!: string[];

  @ApiProperty({ type: [String] })
  kunyomi!: string[];
}

export class ReviewQueueKanjiItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  character!: string;

  @ApiProperty({ type: [String] })
  meanings!: string[];

  @ApiProperty({ type: ReviewKanjiReadingsDto })
  readings!: ReviewKanjiReadingsDto;

  @ApiProperty()
  jlpt!: string;

  @ApiProperty({ type: 'integer' })
  strokes!: number;

  @ApiPropertyOptional({ type: 'integer' })
  grade?: number;

  @ApiPropertyOptional({ type: 'integer' })
  frequency?: number;
}

export class ReviewQueueVocabularyItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  word!: string;

  @ApiProperty()
  reading!: string;

  @ApiProperty({ type: [String] })
  meanings!: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  jlpt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  partOfSpeech?: string | null;
}

class ReviewQueueCardDto {
  @ApiProperty()
  progress_id!: string;

  @ApiProperty({ type: 'integer' })
  srs_level!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  last_reviewed_at!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  next_review_at!: string;

  @ApiProperty({ type: 'integer' })
  review_count!: number;
}

class ReviewQueueKanjiCardDto extends ReviewQueueCardDto {
  @ApiProperty({ type: String, enum: ['kanji'] })
  item_type!: 'kanji';

  @ApiProperty({ type: ReviewQueueKanjiItemDto })
  item!: ReviewQueueKanjiItemDto;
}

class ReviewQueueVocabularyCardDto extends ReviewQueueCardDto {
  @ApiProperty({ type: String, enum: ['vocabulary'] })
  item_type!: 'vocabulary';

  @ApiProperty({ type: ReviewQueueVocabularyItemDto })
  item!: ReviewQueueVocabularyItemDto;
}

export type ReviewQueueItemDto =
  | ReviewQueueKanjiCardDto
  | ReviewQueueVocabularyCardDto;

const reviewCardsSchema = {
  type: 'array' as const,
  items: {
    oneOf: [
      { $ref: getSchemaPath(ReviewQueueKanjiCardDto) },
      { $ref: getSchemaPath(ReviewQueueVocabularyCardDto) },
    ],
    discriminator: {
      propertyName: 'item_type',
      mapping: {
        kanji: getSchemaPath(ReviewQueueKanjiCardDto),
        vocabulary: getSchemaPath(ReviewQueueVocabularyCardDto),
      },
    },
  },
};

class ReviewQueueTotalsDto {
  @ApiProperty({ type: 'integer' })
  kanji!: number;

  @ApiProperty({ type: 'integer' })
  vocabulary!: number;

  @ApiProperty({
    type: 'integer',
    enum: [0],
    description: 'Gramática usa revisão de compreensão fora da fila SRS.',
  })
  grammar!: number;
}

@ApiExtraModels(ReviewQueueKanjiCardDto, ReviewQueueVocabularyCardDto)
export class ReviewQueueResponseDto {
  @ApiProperty({ type: 'integer' })
  total_due!: number;

  @ApiProperty({ ...reviewCardsSchema })
  items!: ReviewQueueItemDto[];

  @ApiProperty({ type: ReviewQueueTotalsDto })
  by_type!: ReviewQueueTotalsDto;
}

export class ReviewQueueCountResponseDto {
  @ApiProperty({ type: 'integer' })
  kanji!: number;

  @ApiProperty({ type: 'integer' })
  vocabulary!: number;

  @ApiProperty({ type: 'integer' })
  total!: number;
}

export class ReviewAnswerItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: READABLE_REVIEW_TYPES })
  item_type!: ReviewItemTypeValue;

  @ApiProperty()
  item_id!: string;

  @ApiProperty({ enum: REVIEW_QUALITY_VALUES })
  quality!: number;

  @ApiProperty({ enum: QUALITY_NAMES })
  quality_name!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  response_time_ms?: number | null;

  @ApiProperty({ type: 'integer' })
  srs_level_before!: number;

  @ApiProperty({ type: 'integer' })
  srs_level_after!: number;

  @ApiProperty({ type: 'integer' })
  interval_before!: number;

  @ApiProperty({ type: 'integer' })
  interval_after!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  answered_at!: string;
}

@ApiExtraModels(ReviewQueueKanjiCardDto, ReviewQueueVocabularyCardDto)
export class ReviewSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty({ enum: READABLE_REVIEW_TYPES })
  session_type!: ReviewItemTypeValue;

  @ApiProperty({ enum: REVIEW_HISTORY_STATUSES })
  status!: ReviewStatusValue;

  @ApiProperty({ type: 'integer' })
  total_items!: number;

  @ApiProperty({ type: 'integer' })
  reviewed_items!: number;

  @ApiProperty({ type: 'integer' })
  correct_items!: number;

  @ApiProperty({ type: 'integer' })
  incorrect_items!: number;

  @ApiProperty({ type: Number, nullable: true })
  accuracy_rate!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  duration_seconds!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  started_at!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completed_at!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  abandoned_at?: string | null;

  @ApiPropertyOptional({ ...reviewCardsSchema })
  cards?: ReviewQueueItemDto[];

  @ApiPropertyOptional({ type: [ReviewAnswerItemDto] })
  answers?: ReviewAnswerItemDto[];
}

class SessionProgressDto {
  @ApiProperty({ type: 'integer' })
  reviewed!: number;

  @ApiProperty({ type: 'integer' })
  total!: number;

  @ApiProperty({ type: 'integer' })
  correct!: number;

  @ApiProperty({ type: 'integer' })
  incorrect!: number;
}

export class ReviewAnswerResponseDto {
  @ApiProperty({ type: 'integer' })
  previous_srs_level!: number;

  @ApiProperty({ type: 'integer' })
  new_srs_level!: number;

  @ApiProperty({ type: 'integer' })
  previous_interval!: number;

  @ApiProperty({ type: 'integer' })
  new_interval!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  next_review_at!: string;

  @ApiProperty()
  is_mastered!: boolean;

  @ApiProperty({ type: SessionProgressDto })
  session_progress!: SessionProgressDto;
}

export class PaginatedReviewSessionResponseDto {
  @ApiProperty({ type: [ReviewSessionResponseDto] })
  data!: ReviewSessionResponseDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}

export class QualityBreakdownDto {
  @ApiProperty({ type: 'integer' })
  blackout!: number;

  @ApiProperty({ type: 'integer' })
  wrong!: number;

  @ApiProperty({ type: 'integer' })
  correct_hard!: number;

  @ApiProperty({ type: 'integer' })
  correct_easy!: number;
}

export class ReviewSessionStatsResponseDto {
  @ApiProperty()
  session_id!: string;

  @ApiProperty({ enum: REVIEW_HISTORY_STATUSES })
  status!: ReviewStatusValue;

  @ApiProperty({ enum: READABLE_REVIEW_TYPES })
  session_type!: ReviewItemTypeValue;

  @ApiProperty({ type: 'integer' })
  total_items!: number;

  @ApiProperty({ type: 'integer' })
  reviewed_items!: number;

  @ApiProperty({ type: 'integer' })
  correct_items!: number;

  @ApiProperty({ type: 'integer' })
  incorrect_items!: number;

  @ApiProperty()
  accuracy_rate!: number;

  @ApiProperty({ type: 'integer' })
  duration_seconds!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  average_response_time_ms?: number | null;

  @ApiProperty({ type: 'integer' })
  mastered_count!: number;

  @ApiProperty({ type: QualityBreakdownDto })
  quality_breakdown!: QualityBreakdownDto;

  @ApiProperty({ type: String, format: 'date-time' })
  started_at!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completed_at!: string | null;
}
