import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JLPTLevel } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  SrsDetailProgressDto,
  SrsListProgressDto,
  SrsProgressResponseDto,
} from '../../../common/dto/srs-progress.dto';

class VocabularySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  word!: string;

  @ApiProperty()
  reading!: string;

  @ApiProperty({ enum: JLPTLevel, nullable: true })
  jlpt!: JLPTLevel | null;

  @ApiProperty({ type: Number, nullable: true })
  frequency!: number | null;

  @ApiProperty({ type: String, nullable: true })
  partOfSpeech!: string | null;

  @ApiProperty({ type: [String] })
  tags!: string[];
}

export class VocabularyListResponseDto extends VocabularySummaryDto {
  @ApiProperty()
  primaryMeaning!: string;

  @ApiPropertyOptional({ type: SrsListProgressDto })
  userProgress?: SrsListProgressDto;
}

export class PaginatedVocabularyResponseDto {
  @ApiProperty({ type: [VocabularyListResponseDto] })
  data!: VocabularyListResponseDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}

class VocabularyMeaningDto {
  @ApiProperty()
  meaning!: string;

  @ApiProperty({ type: String, nullable: true })
  context!: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

class VocabularyExampleDto {
  @ApiProperty()
  japanese!: string;

  @ApiProperty({ type: String, nullable: true })
  reading!: string | null;

  @ApiProperty()
  translation!: string;

  @ApiProperty({ type: String, nullable: true })
  source!: string | null;
}

export class VocabularyDetailResponseDto extends VocabularySummaryDto {
  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true })
  audioUrl!: string | null;

  @ApiProperty({ type: [VocabularyMeaningDto] })
  meanings!: VocabularyMeaningDto[];

  @ApiProperty({ type: [VocabularyExampleDto] })
  examples!: VocabularyExampleDto[];

  @ApiPropertyOptional({ type: SrsDetailProgressDto })
  userProgress?: SrsDetailProgressDto;
}

export class VocabularyProgressResponseDto extends SrsProgressResponseDto {
  @ApiProperty()
  vocabularyId!: string;
}
