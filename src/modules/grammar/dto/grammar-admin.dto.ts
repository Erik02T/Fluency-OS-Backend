import { PartialType } from '@nestjs/swagger';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JLPTLevel } from '@prisma/client';

export class AdminGrammarExampleDto {
  @ApiProperty({ example: '日本に行きたい。' })
  @IsString()
  @IsNotEmpty()
  japanese!: string;

  @ApiPropertyOptional({ example: 'にほんにいきたい。' })
  @IsOptional()
  @IsString()
  reading?: string | null;

  @ApiProperty({ example: 'Quero ir ao Japão.' })
  @IsString()
  @IsNotEmpty()
  translation!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isNatural?: boolean;
}

@ApiExtraModels(AdminGrammarExampleDto)
export class CreateGrammarPointDto {
  @ApiProperty({ example: '〜たい' })
  @IsString()
  @IsNotEmpty()
  pattern!: string;

  @ApiProperty({ enum: JLPTLevel, example: JLPTLevel.N5 })
  @IsEnum(JLPTLevel)
  jlptLevel!: JLPTLevel;

  @ApiProperty({ example: 'Expressar desejo' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Indica vontade de realizar uma ação.' })
  @IsString()
  @IsNotEmpty()
  shortExplanation!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detailedExplanation?: string | null;

  @ApiPropertyOptional({ enum: ['casual', 'neutral', 'formal', 'written'] })
  @IsOptional()
  @IsString()
  formalityLevel?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ example: ['verb', 'desire'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ type: [AdminGrammarExampleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminGrammarExampleDto)
  examples?: AdminGrammarExampleDto[];
}

export class UpdateGrammarPointDto extends PartialType(CreateGrammarPointDto) {}
