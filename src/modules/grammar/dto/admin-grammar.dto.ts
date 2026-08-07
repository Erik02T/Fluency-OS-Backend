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
import { JLPTLevel } from '@prisma/client';

export class AdminGrammarExampleDto {
  @ApiProperty({ example: '毎朝日本語を勉強しています。' })
  @IsString()
  @IsNotEmpty()
  japanese!: string;

  @ApiPropertyOptional({ example: 'まいあさにほんごをべんきょうしています。' })
  @IsOptional()
  @IsString()
  reading?: string;

  @ApiProperty({ example: 'Eu estudo japonês todas as manhãs.' })
  @IsString()
  @IsNotEmpty()
  translation!: string;

  @ApiPropertyOptional({ example: 'Exemplo do livro Minna no Nihongo' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isNatural?: boolean;
}

@ApiExtraModels(AdminGrammarExampleDto)
export class CreateGrammarPointDto {
  @ApiProperty({ example: '〜ている' })
  @IsString()
  @IsNotEmpty()
  pattern!: string;

  @ApiProperty({ enum: JLPTLevel, example: JLPTLevel.N5 })
  @IsEnum(JLPTLevel)
  jlptLevel!: JLPTLevel;

  @ApiProperty({ example: 'Ação contínua / progressiva' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'Indica que uma ação está em andamento ou é um hábito.',
  })
  @IsString()
  @IsNotEmpty()
  shortExplanation!: string;

  @ApiPropertyOptional({
    example: 'Explicação detalhada longa sobre 〜ている...',
  })
  @IsOptional()
  @IsString()
  detailedExplanation?: string;

  @ApiPropertyOptional({ example: 'neutral', default: 'neutral' })
  @IsOptional()
  @IsString()
  formalityLevel?: string;

  @ApiPropertyOptional({ example: 2, default: 1, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ example: 12, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['verb', 'te-form', 'estado'],
  })
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
