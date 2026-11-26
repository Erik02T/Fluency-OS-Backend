import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JLPTLevel } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  SrsDetailProgressDto,
  SrsListProgressDto,
} from '../../../common/dto/srs-progress.dto';

class KanjiSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  character!: string;

  @ApiProperty({ enum: JLPTLevel })
  jlpt!: JLPTLevel;

  @ApiProperty({ type: 'integer' })
  strokes!: number;

  @ApiProperty({ type: 'integer' })
  frequency!: number;

  @ApiProperty({ type: 'integer' })
  grade!: number;
}

export class KanjiListResponseDto extends KanjiSummaryDto {
  @ApiProperty({ type: [String] })
  meanings!: string[];

  @ApiProperty({ type: [String] })
  onyomi!: string[];

  @ApiProperty({ type: [String] })
  kunyomi!: string[];

  @ApiPropertyOptional({ type: SrsListProgressDto })
  userProgress?: SrsListProgressDto;
}

export class PaginatedKanjiResponseDto {
  @ApiProperty({ type: [KanjiListResponseDto] })
  data!: KanjiListResponseDto[];

  @ApiProperty({ type: PaginationDto })
  pagination!: PaginationDto;
}

class KanjiMeaningDto {
  @ApiProperty()
  meaning!: string;

  @ApiProperty()
  language!: string;

  @ApiProperty()
  isPrimary!: boolean;
}

class KanjiReadingDto {
  @ApiProperty()
  reading!: string;

  @ApiProperty()
  romanization!: string;
}

class KanjiCommonReadingDto extends KanjiReadingDto {
  @ApiProperty()
  isCommon!: boolean;
}

class KanjiReadingsDto {
  @ApiProperty({ type: [KanjiCommonReadingDto] })
  onyomi!: KanjiCommonReadingDto[];

  @ApiProperty({ type: [KanjiCommonReadingDto] })
  kunyomi!: KanjiCommonReadingDto[];

  @ApiPropertyOptional({ type: [KanjiReadingDto] })
  nanori?: KanjiReadingDto[];
}

class KanjiExampleDto {
  @ApiProperty()
  word!: string;

  @ApiProperty()
  reading!: string;

  @ApiProperty()
  meaning!: string;

  @ApiProperty({ enum: JLPTLevel })
  jlpt!: JLPTLevel;

  @ApiPropertyOptional()
  audioUrl?: string;
}

class KanjiRadicalDto {
  @ApiProperty()
  character!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  meaning!: string;

  @ApiProperty()
  isPrimary!: boolean;
}

class KanjiDetailProgressDto extends SrsDetailProgressDto {
  @ApiProperty({ type: 'integer' })
  streak!: number;
}

export class KanjiDetailResponseDto extends KanjiSummaryDto {
  @ApiProperty()
  unicodeCodepoint!: string;

  @ApiProperty({ type: [KanjiMeaningDto] })
  meanings!: KanjiMeaningDto[];

  @ApiProperty({ type: KanjiReadingsDto })
  readings!: KanjiReadingsDto;

  @ApiProperty({ type: [KanjiExampleDto] })
  examples!: KanjiExampleDto[];

  @ApiProperty({ type: [KanjiRadicalDto] })
  radicals!: KanjiRadicalDto[];

  @ApiPropertyOptional({ type: KanjiDetailProgressDto })
  userProgress?: KanjiDetailProgressDto;
}

class AdminKanjiReadingsDto extends KanjiReadingsDto {
  @ApiPropertyOptional({ type: [KanjiCommonReadingDto] })
  declare nanori?: KanjiCommonReadingDto[];
}

export class AdminKanjiDetailResponseDto extends KanjiDetailResponseDto {
  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, nullable: true })
  romanization!: string | null;

  @ApiProperty({ type: AdminKanjiReadingsDto })
  declare readings: AdminKanjiReadingsDto;
}
