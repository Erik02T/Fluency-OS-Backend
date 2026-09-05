import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QualityBreakdownDto {
  @ApiProperty({ example: 1, description: 'Falhou (quality 0)' })
  blackout!: number;

  @ApiProperty({ example: 2, description: 'Difícil (quality 1)' })
  wrong!: number;

  @ApiProperty({ example: 8, description: 'OK / Correto Difícil (quality 2)' })
  correct_hard!: number;

  @ApiProperty({ example: 4, description: 'Fácil (quality 3)' })
  correct_easy!: number;
}

export class ReviewSessionStatsResponseDto {
  @ApiProperty({ example: 'session_123' })
  session_id!: string;

  @ApiProperty({ example: 'completed' })
  status!: string;

  @ApiProperty({ example: 'kanji' })
  session_type!: string;

  @ApiProperty({ example: 15 })
  total_items!: number;

  @ApiProperty({ example: 15 })
  reviewed_items!: number;

  @ApiProperty({ example: 12 })
  correct_items!: number;

  @ApiProperty({ example: 3 })
  incorrect_items!: number;

  @ApiProperty({ example: 80.0 })
  accuracy_rate!: number;

  @ApiProperty({ example: 245 })
  duration_seconds!: number;

  @ApiPropertyOptional({ example: 2450 })
  average_response_time_ms?: number | null;

  @ApiProperty({
    example: 2,
    description:
      'Quantidade de itens que subiram para level 5 (dominados) nesta sessão',
  })
  mastered_count!: number;

  @ApiProperty({ type: QualityBreakdownDto })
  quality_breakdown!: QualityBreakdownDto;

  @ApiProperty({ example: '2024-01-15T12:00:00.000Z' })
  started_at!: string;

  @ApiPropertyOptional({ example: '2024-01-15T12:04:05.000Z' })
  completed_at!: string | null;
}
