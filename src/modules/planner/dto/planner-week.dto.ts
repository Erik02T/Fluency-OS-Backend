import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PlannerGoalCategory, WeeklyPlanStatus } from '@prisma/client';

export const PLANNER_GOAL_CATEGORIES = Object.values(PlannerGoalCategory);
export const WEEKLY_PLAN_STATUSES = Object.values(WeeklyPlanStatus);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class PlannerWeekQueryDto {
  @ApiPropertyOptional({ example: '2026-10-10', description: 'YYYY-MM-DD' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date must be a YYYY-MM-DD string' })
  date?: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 41 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  weekNumber?: number;
}

export class UpdateWeeklyPlanDto {
  @ApiPropertyOptional({ enum: WEEKLY_PLAN_STATUSES, example: 'COMPLETED' })
  @IsOptional()
  @IsIn(WEEKLY_PLAN_STATUSES)
  status?: WeeklyPlanStatus;

  @ApiPropertyOptional({ example: 'Semana focada em gramática' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class WeeklyGoalItemDto {
  @ApiProperty({ enum: PLANNER_GOAL_CATEGORIES, example: 'IMMERSION' })
  @IsIn(PLANNER_GOAL_CATEGORIES)
  category!: PlannerGoalCategory;

  @ApiProperty({ minimum: 0, maximum: 100000, example: 450 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  targetValue!: number;

  @ApiPropertyOptional({ example: 'min' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit?: string;
}

export class UpdateWeeklyGoalsDto {
  @ApiProperty({
    type: [WeeklyGoalItemDto],
    description:
      'Metas a criar/atualizar no plano (demais categorias são preservadas)',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => WeeklyGoalItemDto)
  goals!: WeeklyGoalItemDto[];
}
