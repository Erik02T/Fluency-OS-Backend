import { PartialType } from '@nestjs/swagger';
import {
  ApiProperty,
  ApiPropertyOptional,
  ApiExtraModels,
} from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JLPTLevel } from '@prisma/client';

export class AdminVocabularyMeaningDto {
  @ApiProperty({ example: 'apanhar (objeto), pegar' })
  @IsString()
  @IsNotEmpty()
  meaning!: string;

  @ApiPropertyOptional({ example: 'usado em contextos formais' })
  @IsOptional()
  @IsString()
  context?: string | null;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class AdminVocabularyExampleDto {
  @ApiProperty({ example: '本を取ります。' })
  @IsString()
  @IsNotEmpty()
  japanese!: string;

  @ApiPropertyOptional({ example: 'ほんをとります。' })
  @IsOptional()
  @IsString()
  reading?: string | null;

  @ApiProperty({ example: 'Pego o livro.' })
  @IsString()
  @IsNotEmpty()
  translation!: string;

  @ApiPropertyOptional({ example: 'Tatoeba' })
  @IsOptional()
  @IsString()
  source?: string | null;
}

@ApiExtraModels(AdminVocabularyMeaningDto, AdminVocabularyExampleDto)
export class CreateVocabularyDto {
  @ApiProperty({ example: '取る' })
  @IsString()
  @IsNotEmpty()
  word!: string;

  @ApiProperty({ example: 'とる' })
  @IsString()
  @IsNotEmpty()
  reading!: string;

  @ApiProperty({ enum: JLPTLevel, example: JLPTLevel.N5 })
  @IsEnum(JLPTLevel)
  jlptLevel!: JLPTLevel;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  frequency?: number;

  @ApiPropertyOptional({ example: 'verb (godan)' })
  @IsOptional()
  @IsString()
  partOfSpeech?: string | null;

  @ApiPropertyOptional({ example: ['daily', 'formal'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audioUrl?: string | null;

  @ApiProperty({ type: [AdminVocabularyMeaningDto] })
  @IsArray()
  @ArrayNotEmpty()
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
