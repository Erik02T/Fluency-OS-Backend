import { Type } from 'class-transformer';
import { ImmersionType } from '@prisma/client';
import { IsDate, IsEnum, IsIn, IsOptional, Max, Min } from 'class-validator';

export class ImmersionLogFiltersDto {
  @IsOptional()
  @IsEnum(ImmersionType, {
    message:
      'Invalid immersion type. Must be one of: ANIME, DRAMA, PODCAST, YOUTUBE, MANGA, NOVEL, VISUAL_NOVEL, GAME, NEWS, MUSIC, MOVIE, OTHER',
  })
  type?: ImmersionType;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @Type(() => Number)
  @Min(1)
  @Max(100)
  perPage: number = 20;

  @IsOptional()
  @IsIn(['loggedAt', 'durationMinutes', 'createdAt'])
  sort?: 'loggedAt' | 'durationMinutes' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
