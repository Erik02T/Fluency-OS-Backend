import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReviewSessionResponseDto } from './review-session-response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Número da página (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Itens por página',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage: number = 20;

  @ApiPropertyOptional({
    description: 'Filtrar por status da sessão',
    enum: [
      'in_progress',
      'completed',
      'abandoned',
      'IN_PROGRESS',
      'COMPLETED',
      'ABANDONED',
    ],
    example: 'completed',
  })
  @IsOptional()
  @IsIn([
    'in_progress',
    'completed',
    'abandoned',
    'IN_PROGRESS',
    'COMPLETED',
    'ABANDONED',
  ])
  status?: string;
}

export class PaginatedReviewSessionResponseDto {
  @ApiProperty({ type: [ReviewSessionResponseDto] })
  data!: ReviewSessionResponseDto[];

  @ApiProperty({
    example: {
      page: 1,
      perPage: 20,
      total: 45,
      pages: 3,
    },
  })
  pagination!: {
    page: number;
    perPage: number;
    total: number;
    pages: number;
  };
}
