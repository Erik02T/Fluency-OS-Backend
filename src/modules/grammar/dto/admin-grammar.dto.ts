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

  // FASE 6 - Campos de enriquecimento
  @ApiPropertyOptional({
    type: Array,
    example: [
      { text: '毎朝', reading: 'まいあさ' },
      { text: '日本語', reading: 'にほんご' },
    ],
  })
  @IsOptional()
  @IsArray()
  furigana?: Array<{ text: string; reading: string }>;

  @ApiPropertyOptional({
    type: Object,
    example: {
      uniqueKanji: [{ character: '日', reading: 'にち', meaning: 'dia' }],
      totalKanjiCount: 1,
    },
  })
  @IsOptional()
  kanjiBreakdown?: {
    uniqueKanji: Array<{
      character: string;
      reading?: string;
      meaning?: string;
      jlpt?: string;
    }>;
    totalKanjiCount: number;
  };

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  characterCount?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  wordCount?: number;
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

  // FASE 6 - Campos de enriquecimento do pattern
  @ApiPropertyOptional({
    type: Array,
    example: [
      { text: '〜て', reading: '〜て' },
      { text: 'いる', reading: 'いる' },
    ],
  })
  @IsOptional()
  @IsArray()
  patternFurigana?: Array<{ text: string; reading: string }>;

  @ApiPropertyOptional({
    type: Object,
    example: {
      uniqueKanji: [],
      totalKanjiCount: 0,
    },
  })
  @IsOptional()
  patternKanjiBreakdown?: {
    uniqueKanji: Array<{
      character: string;
      reading?: string;
      meaning?: string;
      jlpt?: string;
    }>;
    totalKanjiCount: number;
  };

  // FASE 6 - Metadados de enriquecimento
  @ApiPropertyOptional({
    type: Object,
    example: {
      enrichedAt: '2026-09-30T00:00:00Z',
      enricherVersion: '1.0.0',
      totalUniqueKanji: 0,
    },
  })
  @IsOptional()
  enrichmentData?: {
    enrichedAt: string;
    enricherVersion: string;
    totalUniqueKanji: number;
  };

  // FASE 7 - Metadados de validação
  @ApiPropertyOptional({
    type: Object,
    example: {
      validatedAt: '2026-09-30T00:00:00Z',
      contentHash: 'abc123...',
      warnings: [],
    },
  })
  @IsOptional()
  validationMetadata?: {
    validatedAt: string;
    contentHash: string;
    warnings: string[];
  };

  // FASE 7 - Metadados de proveniência
  @ApiPropertyOptional({ example: 'tanos' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'N5-001' })
  @IsOptional()
  @IsString()
  sourceId?: string;
}

export class UpdateGrammarPointDto extends PartialType(CreateGrammarPointDto) {}
