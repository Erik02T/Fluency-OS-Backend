import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewAnswerItemDto {
  @ApiProperty({ example: 'answer_123' })
  id!: string;

  @ApiProperty({ example: 'kanji' })
  item_type!: string;

  @ApiProperty({ example: 'clxyz123' })
  item_id!: string;

  @ApiProperty({ example: 2 })
  quality!: number;

  @ApiProperty({ example: 'CORRECT_HARD' })
  quality_name!: string;

  @ApiPropertyOptional({ example: 3200 })
  response_time_ms?: number | null;

  @ApiProperty({ example: 2 })
  srs_level_before!: number;

  @ApiProperty({ example: 3 })
  srs_level_after!: number;

  @ApiProperty({ example: 3 })
  interval_before!: number;

  @ApiProperty({ example: 8 })
  interval_after!: number;

  @ApiProperty({ example: '2024-01-15T12:30:00.000Z' })
  answered_at!: string;
}

export class ReviewSessionResponseDto {
  @ApiProperty({ example: 'session_123' })
  id!: string;

  @ApiProperty({ example: 'user_123' })
  user_id!: string;

  @ApiProperty({ example: 'kanji' })
  session_type!: string;

  @ApiProperty({
    example: 'in_progress',
    enum: ['in_progress', 'completed', 'abandoned'],
  })
  status!: string;

  @ApiProperty({ example: 42 })
  total_items!: number;

  @ApiProperty({ example: 15 })
  reviewed_items!: number;

  @ApiProperty({ example: 12 })
  correct_items!: number;

  @ApiProperty({ example: 3 })
  incorrect_items!: number;

  @ApiPropertyOptional({ example: 80.0 })
  accuracy_rate!: number | null;

  @ApiPropertyOptional({ example: 320 })
  duration_seconds!: number | null;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z' })
  started_at!: string;

  @ApiPropertyOptional({ example: '2024-01-15T12:05:20.000Z' })
  completed_at!: string | null;

  @ApiPropertyOptional({ example: null })
  abandoned_at?: string | null;

  @ApiPropertyOptional({ type: [ReviewAnswerItemDto] })
  answers?: ReviewAnswerItemDto[];
}
