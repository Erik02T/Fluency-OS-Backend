import { ApiProperty } from '@nestjs/swagger';

export class ReviewQueueKanjiItemDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({ example: '日' })
  character!: string;

  @ApiProperty({ example: ['sol', 'dia'], type: [String] })
  meanings!: string[];

  @ApiProperty({
    example: { onyomi: ['ニチ', 'ジツ'], kunyomi: ['ひ', '-び', '-か'] },
  })
  readings!: {
    onyomi: string[];
    kunyomi: string[];
  };

  @ApiProperty({ example: 'N5' })
  jlpt!: string;

  @ApiProperty({ example: 4 })
  strokes!: number;

  @ApiProperty({ example: 1, required: false })
  grade?: number;

  @ApiProperty({ example: 1, required: false })
  frequency?: number;
}

export class ReviewQueueVocabularyItemDto {
  @ApiProperty({ example: 'clxyz123' })
  id!: string;

  @ApiProperty({ example: '食べる' })
  word!: string;

  @ApiProperty({ example: 'たべる' })
  reading!: string;

  @ApiProperty({ example: ['comer'], type: [String] })
  meanings!: string[];

  @ApiProperty({ example: 'N5', required: false, nullable: true })
  jlpt?: string | null;

  @ApiProperty({ example: 'v1', required: false, nullable: true })
  partOfSpeech?: string | null;
}

export class ReviewQueueItemDto {
  @ApiProperty({ example: 'clxyz456' })
  progress_id!: string;

  @ApiProperty({ example: 'kanji', enum: ['kanji', 'vocabulary', 'sentence'] })
  item_type!: string;

  @ApiProperty({ type: Object })
  item!:
    | ReviewQueueKanjiItemDto
    | ReviewQueueVocabularyItemDto
    | Record<string, unknown>;

  @ApiProperty({ example: 2 })
  srs_level!: number;

  @ApiProperty({
    example: '2024-01-14T00:00:00.000Z',
    required: false,
    nullable: true,
  })
  last_reviewed_at!: string | null;

  @ApiProperty({ example: '2024-01-15T00:00:00.000Z' })
  next_review_at!: string;

  @ApiProperty({ example: 5 })
  review_count!: number;
}

export class ReviewQueueByTypeDto {
  @ApiProperty({ example: 28 })
  kanji!: number;

  @ApiProperty({ example: 14 })
  vocabulary!: number;

  @ApiProperty({ example: 0 })
  grammar!: number;
}

export class ReviewQueueResponseDto {
  @ApiProperty({ example: 42 })
  total_due!: number;

  @ApiProperty({ type: [ReviewQueueItemDto] })
  items!: ReviewQueueItemDto[];

  @ApiProperty({ type: ReviewQueueByTypeDto })
  by_type!: ReviewQueueByTypeDto;
}
