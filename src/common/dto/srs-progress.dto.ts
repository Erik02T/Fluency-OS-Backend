import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SrsListProgressDto {
  @ApiProperty({ type: 'integer' })
  srsLevel!: number;

  @ApiProperty()
  isMastered!: boolean;

  @ApiProperty()
  isFavorited!: boolean;

  @ApiProperty()
  isSuspended!: boolean;
}

export class SrsDetailProgressDto extends SrsListProgressDto {
  @ApiProperty()
  easeFactor!: number;

  @ApiProperty({ type: 'integer' })
  intervalDays!: number;

  @ApiProperty()
  nextReviewAt!: Date;

  @ApiPropertyOptional()
  lastReviewedAt?: Date;

  @ApiProperty({ type: 'integer' })
  totalReviews!: number;

  @ApiProperty({ type: 'integer' })
  correctReviews!: number;
}

export class SrsProgressResponseDto extends SrsDetailProgressDto {
  @ApiProperty()
  addedAt!: Date;

  @ApiPropertyOptional()
  masteredAt?: Date;
}
