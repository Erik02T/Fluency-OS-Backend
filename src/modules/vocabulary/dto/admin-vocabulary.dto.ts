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
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JLPTLevel } from '@prisma/client';

export class AdminVocabularyMeaningDto {
  @ApiProperty({ example: 'casa' })
  @IsString()
  @IsNotEmpty()
  meaning!: string;

  @ApiPropertyOptional({ example: 'uso diário' })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class AdminVocabularyExampleDto {
  @ApiProperty({ example: '私は家に帰ります。' })
  @IsString()
  @IsNotEmpty()
  japanese!: string;

  @ApiPropertyOptional({ example: 'わたしはいえにかえります。' })
  @IsOptional()
  @IsString()
  reading?: string;

  @ApiProperty({ example: 'Eu volto para casa.' })
  @IsString()
  @IsNotEmpty()
  translation!: string;

  @ApiPropertyOptional({ example: 'Tatoeba' })
  @IsOptional()
  @IsString()
  source?: string;
}

@ApiExtraModels(AdminVocabularyMeaningDto, AdminVocabularyExampleDto)
export class CreateVocabularyDto {
  @ApiProperty({ example: '家' })
  @IsString()
  @IsNotEmpty()
  word!: string;

  @ApiProperty({ example: 'いえ' })
  @IsString()
  @IsNotEmpty()
  reading!: string;

  @ApiProperty({ enum: JLPTLevel, example: JLPTLevel.N5 })
  @IsEnum(JLPTLevel)
  jlptLevel!: JLPTLevel;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  frequency?: number;

  @ApiPropertyOptional({ example: 'noun' })
  @IsOptional()
  @IsString()
  partOfSpeech?: string;

  @ApiPropertyOptional({ type: [String], example: ['daily', 'casa'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Notas internas' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'https://audio.example.com/ie.mp3' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiProperty({ type: [AdminVocabularyMeaningDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminVocabularyMeaningDto)
  meanings!: AdminVocabularyMeaningDto[];

  @ApiPropertyOptional({ type: [AdminVocabularyExampleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminVocabularyExampleDto)
  examples?: AdminVocabularyExampleDto[];
}

export class UpdateVocabularyDto extends PartialType(CreateVocabularyDto) {}
