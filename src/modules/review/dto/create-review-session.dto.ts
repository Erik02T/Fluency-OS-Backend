import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewSessionDto {
  @ApiPropertyOptional({
    description: 'Tipo de item da sessão',
    enum: ['kanji', 'vocabulary', 'sentence', 'mixed'],
    default: 'kanji',
    example: 'kanji',
  })
  @IsOptional()
  @IsIn([
    'kanji',
    'vocabulary',
    'sentence',
    'mixed',
    'KANJI',
    'VOCABULARY',
    'SENTENCE',
  ])
  session_type?: string;

  @ApiPropertyOptional({
    description: 'Alias camelCase para session_type',
    enum: ['kanji', 'vocabulary', 'sentence', 'mixed'],
    example: 'kanji',
  })
  @IsOptional()
  @IsIn([
    'kanji',
    'vocabulary',
    'sentence',
    'mixed',
    'KANJI',
    'VOCABULARY',
    'SENTENCE',
  ])
  sessionType?: string;

  @ApiPropertyOptional({
    description: 'Limite máximo de itens na sessão',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
