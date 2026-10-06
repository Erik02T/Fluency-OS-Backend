import { Type, Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, Max, Min } from 'class-validator';
import { JLPTLevel } from '@prisma/client';

export class GrammarFiltersDto {
  @IsOptional()
  @IsEnum(JLPTLevel, {
    message: 'Invalid JLPT level. Must be one of: N5, N4, N3, N2, N1',
  })
  jlpt?: JLPTLevel;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @Min(1)
  @Max(100)
  perPage: number = 20;

  @IsOptional()
  @IsIn(['difficulty', 'jlpt', 'pattern', 'createdAt', 'position'])
  sort?: 'difficulty' | 'jlpt' | 'pattern' | 'createdAt' | 'position';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}
