import { IsEnum, IsOptional, IsString, Min, Max, IsBoolean } from 'class-validator';
import { JLPTLevel } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

export class KanjiFiltersDto {
  @IsOptional()
  @IsEnum(JLPTLevel, {
    message: 'Invalid JLPT level. Must be one of: N5, N4, N3, N2, N1',
  })
  jlpt?: JLPTLevel;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(9)
  grade?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  favorites?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mastered?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  suspended?: boolean;

  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @Min(1)
  @Max(100)
  perPage: number = 20;

  @IsOptional()
  @IsString()
  sort?: 'frequency' | 'jlpt' | 'grade' | 'strokes';
}
