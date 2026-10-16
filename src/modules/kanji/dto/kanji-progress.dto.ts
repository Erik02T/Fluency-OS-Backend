import { IsBoolean, IsIn, ValidateIf } from 'class-validator';

export class UpdateKanjiProgressDto {
  @IsIn(['study', 'review'])
  action!: 'study' | 'review';

  @ValidateIf((dto: UpdateKanjiProgressDto) => dto.action === 'review')
  @IsBoolean()
  correct?: boolean;
}

export class KanjiProgressResponseDto {
  kanjiId!: string;
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
