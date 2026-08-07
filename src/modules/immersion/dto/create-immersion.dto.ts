import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ImmersionType } from '@prisma/client';

export class CreateImmersionLogDto {
  @IsEnum(ImmersionType, {
    message:
      'Invalid immersion type. Must be one of: ANIME, DRAMA, PODCAST, YOUTUBE, MANGA, NOVEL, VISUAL_NOVEL, GAME, NEWS, MUSIC, MOVIE, OTHER',
  })
  type!: ImmersionType;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  episode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  comprehension?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  notes?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  loggedAt?: Date;
}
