import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JLPTLevel, ReviewStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

class GrammarSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  pattern!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: JLPTLevel })
  jlpt!: JLPTLevel;

  @ApiProperty({ type: 'integer' })
  difficulty!: number;

  @ApiProperty({ type: 'integer' })
  position!: number;

  @ApiProperty()
  formalityLevel!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty()
  shortExplanation!: string;

  @ApiProperty({ enum: ReviewStatus })
  reviewStatus!: ReviewStatus;
}

class GrammarExamplePreviewDto {
  @ApiProperty()
  japanese!: string;

  @ApiProperty({ type: String, nullable: true })
  reading!: string | null;

  @ApiProperty()
  translation!: string;
}

class GrammarExampleDto extends GrammarExamplePreviewDto {
  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty()
  isNatural!: boolean;
}

class GrammarListProgressDto {
  @ApiProperty()
  isStudied!: boolean;

  @ApiProperty()
  isFavorited!: boolean;

  @ApiProperty({ minimum: 0, maximum: 5 })
  confidenceLevel!: number;

  @ApiProperty({ type: 'integer' })
  reviewCount!: number;
}

class GrammarDetailProgressDto extends GrammarListProgressDto {
  @ApiPropertyOptional()
  studiedAt?: Date;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes?: string | null;
}

export class GrammarListResponseDto extends GrammarSummaryDto {
  @ApiProperty({ type: [GrammarExamplePreviewDto] })
  examplesPreview!: GrammarExamplePreviewDto[];

  @ApiPropertyOptional({ type: GrammarListProgressDto })
  userProgress?: GrammarListProgressDto;
}

export class PaginatedGrammarResponseDto {
  @ApiProperty({ type: [GrammarListResponseDto] })
  data!: GrammarListResponseDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}

export class GrammarDetailResponseDto extends GrammarSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  detailedExplanation!: string | null;

  @ApiProperty({ type: [GrammarExampleDto] })
  examples!: GrammarExampleDto[];

  @ApiProperty({ type: String, nullable: true })
  source!: string | null;

  @ApiProperty({ type: String, nullable: true })
  sourceId!: string | null;

  @ApiProperty({ type: 'integer' })
  contentVersion!: number;

  @ApiProperty({ type: Date, nullable: true })
  reviewedAt!: Date | null;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: GrammarDetailProgressDto })
  userProgress?: GrammarDetailProgressDto;
}

export class GrammarProgressResponseDto extends GrammarDetailProgressDto {
  @ApiProperty()
  grammarPointId!: string;
}
