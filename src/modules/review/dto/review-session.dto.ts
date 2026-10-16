import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const REVIEW_SESSION_TYPES = [
  'kanji',
  'vocabulary',
  'sentence',
] as const;
export type ReviewSessionTypeValue = (typeof REVIEW_SESSION_TYPES)[number];

export const REVIEW_QUALITY_VALUES = [0, 1, 2, 3] as const;

export class CreateReviewSessionDto {
  @ApiPropertyOptional({ enum: REVIEW_SESSION_TYPES, example: 'kanji' })
  @IsOptional()
  @IsIn(REVIEW_SESSION_TYPES)
  session_type?: ReviewSessionTypeValue;

  // Alias camelCase aceito pelo contrato do frontend
  @ApiPropertyOptional({ enum: REVIEW_SESSION_TYPES, example: 'kanji' })
  @IsOptional()
  @IsIn(REVIEW_SESSION_TYPES)
  sessionType?: ReviewSessionTypeValue;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class SubmitReviewAnswerDto {
  @ApiPropertyOptional({ example: 'clxyz1234567890' })
  @IsOptional()
  @IsString()
  item_id?: string;

  @ApiPropertyOptional({ example: 'clxyz1234567890' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ enum: REVIEW_SESSION_TYPES, example: 'kanji' })
  @IsOptional()
  @IsIn(REVIEW_SESSION_TYPES)
  item_type?: ReviewSessionTypeValue;

  @ApiPropertyOptional({ enum: REVIEW_SESSION_TYPES, example: 'kanji' })
  @IsOptional()
  @IsIn(REVIEW_SESSION_TYPES)
  itemType?: ReviewSessionTypeValue;

  @ApiPropertyOptional({ minimum: 0, maximum: 3, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  answer_quality?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 3, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  answerQuality?: number;

  // Alias do spec (fluency-os-backend-spec.md) — aceito por compatibilidade
  @ApiPropertyOptional({ minimum: 0, maximum: 3, example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  quality?: number;

  @ApiPropertyOptional({ minimum: 0, example: 3200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  response_time_ms?: number;

  @ApiPropertyOptional({ minimum: 0, example: 3200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}

export const REVIEW_HISTORY_STATUSES = [
  'in_progress',
  'completed',
  'abandoned',
] as const;
export type ReviewHistoryStatusValue = (typeof REVIEW_HISTORY_STATUSES)[number];

export class ReviewHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  @ApiPropertyOptional({ enum: REVIEW_HISTORY_STATUSES })
  @IsOptional()
  @IsIn(REVIEW_HISTORY_STATUSES)
  status?: ReviewHistoryStatusValue;
}
