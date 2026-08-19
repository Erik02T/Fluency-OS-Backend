import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitReviewAnswerDto {
  @ApiPropertyOptional({
    description: 'ID do item (kanji_id ou vocabulary_id)',
    example: 'clxyz123',
  })
  @IsOptional()
  @IsString()
  item_id?: string;

  @ApiPropertyOptional({
    description: 'Alias camelCase para item_id',
    example: 'clxyz123',
  })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({
    description: 'Tipo do item',
    enum: [
      'kanji',
      'vocabulary',
      'sentence',
      'KANJI',
      'VOCABULARY',
      'SENTENCE',
    ],
    default: 'kanji',
    example: 'kanji',
  })
  @IsOptional()
  @IsIn(['kanji', 'vocabulary', 'sentence', 'KANJI', 'VOCABULARY', 'SENTENCE'])
  item_type?: string;

  @ApiPropertyOptional({
    description: 'Alias camelCase para item_type',
    enum: [
      'kanji',
      'vocabulary',
      'sentence',
      'KANJI',
      'VOCABULARY',
      'SENTENCE',
    ],
    example: 'kanji',
  })
  @IsOptional()
  @IsIn(['kanji', 'vocabulary', 'sentence', 'KANJI', 'VOCABULARY', 'SENTENCE'])
  itemType?: string;

  @ApiPropertyOptional({
    description:
      'Qualidade da resposta (0=fail/blackout, 1=hard/wrong, 2=ok/correct_hard, 3=easy/correct_easy)',
    example: 2,
    minimum: 0,
    maximum: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  answer_quality?: number;

  @ApiPropertyOptional({
    description: 'Alias camelCase para answer_quality',
    example: 2,
    minimum: 0,
    maximum: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  answerQuality?: number;

  @ApiPropertyOptional({
    description: 'Tempo de resposta em milissegundos',
    example: 3200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  response_time_ms?: number;

  @ApiPropertyOptional({
    description: 'Alias camelCase para response_time_ms',
    example: 3200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}

export class SessionProgressDto {
  @ApiProperty({ example: 15 })
  reviewed!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 12 })
  correct!: number;

  @ApiProperty({ example: 3 })
  incorrect!: number;
}

export class ReviewAnswerResponseDto {
  @ApiProperty({ example: 3 })
  previous_srs_level!: number;

  @ApiProperty({ example: 4 })
  new_srs_level!: number;

  @ApiProperty({ example: 8 })
  previous_interval!: number;

  @ApiProperty({ example: 21 })
  new_interval!: number;

  @ApiProperty({ example: '2024-02-05T00:00:00.000Z' })
  next_review_at!: string;

  @ApiProperty({ example: false })
  is_mastered!: boolean;

  @ApiProperty({ type: SessionProgressDto })
  session_progress!: SessionProgressDto;
}
