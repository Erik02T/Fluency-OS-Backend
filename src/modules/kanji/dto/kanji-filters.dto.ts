import {
  IsEnum,
  IsOptional,
  IsString,
  Min,
  Max,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { JLPTLevel } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

const booleanQueryParam = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return value;
};

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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  search?: string;

  @IsOptional()
  @Transform(booleanQueryParam)
  @IsBoolean()
  favorites?: boolean;

  @IsOptional()
  @Transform(booleanQueryParam)
  @IsBoolean()
  mastered?: boolean;

  @IsOptional()
  @Transform(booleanQueryParam)
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
  @IsIn(['frequency', 'jlpt', 'grade', 'strokes', 'srsLevel', 'mastered'])
  sort?: 'frequency' | 'jlpt' | 'grade' | 'strokes' | 'srsLevel' | 'mastered';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}
