import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImmersionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const IMMERSION_TYPES = Object.values(ImmersionType);
export const IMMERSION_SORT_FIELDS = [
  'loggedAt',
  'durationMinutes',
  'createdAt',
] as const;
export type ImmersionSortField = (typeof IMMERSION_SORT_FIELDS)[number];

export const IMMERSION_SORT_ORDERS = ['asc', 'desc'] as const;
export type ImmersionSortOrder = (typeof IMMERSION_SORT_ORDERS)[number];

export class CreateImmersionLogDto {
  @ApiProperty({ enum: IMMERSION_TYPES, example: 'ANIME' })
  @IsIn(IMMERSION_TYPES)
  type!: ImmersionType;

  @ApiProperty({ example: 'Shingeki no Kyojin' })
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiProperty({ minimum: 1, maximum: 1440, example: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @ApiPropertyOptional({ example: 'EP 01' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  episode?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 65 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  comprehension?: number;

  @ApiPropertyOptional({ example: 'Assisti sem legendas' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    example: '2026-10-10T12:00:00.000Z',
    description: 'ISO timestamp; default = agora',
  })
  @IsOptional()
  @IsString()
  loggedAt?: string;
}

export class UpdateImmersionLogDto {
  @ApiPropertyOptional({ example: 'Shingeki no Kyojin' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional({ example: 'EP 02' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  episode?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  comprehension?: number;

  @ApiPropertyOptional({ example: 'Revisitei com legendas' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}

export class ImmersionLogQueryDto {
  @ApiPropertyOptional({ minimum: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;

  @ApiPropertyOptional({ enum: IMMERSION_TYPES, example: 'ANIME' })
  @IsOptional()
  @IsIn(IMMERSION_TYPES)
  type?: ImmersionType;

  @ApiPropertyOptional({
    example: '2026-09-01T00:00:00.000Z',
    description: 'Filtra loggedAt >= startDate',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-10T23:59:59.000Z',
    description: 'Filtra loggedAt <= endDate',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ enum: IMMERSION_SORT_FIELDS, example: 'loggedAt' })
  @IsOptional()
  @IsIn(IMMERSION_SORT_FIELDS)
  sort?: ImmersionSortField;

  @ApiPropertyOptional({ enum: IMMERSION_SORT_ORDERS, example: 'desc' })
  @IsOptional()
  @IsIn(IMMERSION_SORT_ORDERS)
  order?: ImmersionSortOrder;
}
