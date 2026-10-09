import { PartialType } from '@nestjs/swagger';
import {
  ApiProperty,
  ApiPropertyOptional,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JLPTLevel, ReadingType } from '@prisma/client';

export class AdminKanjiMeaningDto {
  @ApiProperty({ example: 'sol' })
  @IsString()
  @IsNotEmpty()
  meaning!: string;

  @ApiPropertyOptional({ example: 'pt-BR', default: 'pt-BR' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class AdminKanjiReadingDto {
  @ApiProperty({ example: 'ニチ' })
  @IsString()
  @IsNotEmpty()
  reading!: string;

  @ApiProperty({ enum: ReadingType, example: ReadingType.ONYOMI })
  @IsEnum(ReadingType)
  type!: ReadingType;

  @ApiPropertyOptional({ example: 'nichi' })
  @IsOptional()
  @IsString()
  romanji?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class AdminKanjiExampleDto {
  @ApiProperty({ example: '日本' })
  @IsString()
  @IsNotEmpty()
  word!: string;

  @ApiProperty({ example: 'にほん' })
  @IsString()
  @IsNotEmpty()
  reading!: string;

  @ApiProperty({ example: 'Japão' })
  @IsString()
  @IsNotEmpty()
  meaning!: string;

  @ApiPropertyOptional({ enum: JLPTLevel, example: JLPTLevel.N5 })
  @IsOptional()
  @IsEnum(JLPTLevel)
  jlptLevel?: JLPTLevel;
}

export class AdminKanjiRadicalDto {
  @ApiProperty({ example: '日' })
  @IsString()
  @IsNotEmpty()
  character!: string;

  @ApiProperty({ example: 'hi' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'sol' })
  @IsString()
  @IsNotEmpty()
  meaning!: string;

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  strokeCount!: number;

  @ApiPropertyOptional({ example: 72 })
  @IsOptional()
  @IsInt()
  position?: number;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

@ApiExtraModels(
  AdminKanjiMeaningDto,
  AdminKanjiReadingDto,
  AdminKanjiExampleDto,
  AdminKanjiRadicalDto,
)
export class CreateKanjiDto {
  @ApiProperty({ example: '日' })
  @IsString()
  @IsNotEmpty()
  character!: string;

  @ApiPropertyOptional({ example: 'U+65E5' })
  @IsOptional()
  @IsString()
  unicodeCodepoint?: string;

  @ApiProperty({ enum: JLPTLevel, example: JLPTLevel.N5 })
  @IsEnum(JLPTLevel)
  jlptLevel!: JLPTLevel;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  grade?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  strokeCount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  frequency?: number;

  @ApiPropertyOptional({ example: 'Day, sun' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'nichi' })
  @IsOptional()
  @IsString()
  romanization?: string;

  @ApiProperty({ type: [AdminKanjiMeaningDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminKanjiMeaningDto)
  meanings!: AdminKanjiMeaningDto[];

  @ApiProperty({ type: [AdminKanjiReadingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminKanjiReadingDto)
  readings!: AdminKanjiReadingDto[];

  @ApiPropertyOptional({ type: [AdminKanjiExampleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminKanjiExampleDto)
  examples?: AdminKanjiExampleDto[];

  @ApiPropertyOptional({ type: [AdminKanjiRadicalDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminKanjiRadicalDto)
  radicals?: AdminKanjiRadicalDto[];
}

export class UpdateKanjiDto extends PartialType(CreateKanjiDto) {}
