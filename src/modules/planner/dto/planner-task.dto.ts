import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PlannerCategory,
  PlannerTaskPriority,
  PlannerTaskStatus,
} from '@prisma/client';

export const PLANNER_CATEGORIES = Object.values(PlannerCategory);
export const PLANNER_PRIORITIES = Object.values(PlannerTaskPriority);
export const PLANNER_STATUSES = Object.values(PlannerTaskStatus);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export class CreatePlannerTaskDto {
  @ApiProperty({ example: 'Revisar 10 kanjis do N5' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ example: 'Foco em leitura e escrita' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: PLANNER_CATEGORIES, example: 'KANJI' })
  @IsOptional()
  @IsIn(PLANNER_CATEGORIES)
  category?: PlannerCategory;

  @ApiProperty({
    example: '2026-10-10',
    description: 'YYYY-MM-DD no timezone do usuário',
  })
  @Matches(DATE_PATTERN, { message: 'date must be a YYYY-MM-DD string' })
  date!: string;

  @ApiPropertyOptional({ example: '19:30', description: 'HH:mm' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'scheduledTime must be a HH:mm string' })
  scheduledTime?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 720, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ enum: PLANNER_PRIORITIES, example: 'MEDIUM' })
  @IsOptional()
  @IsIn(PLANNER_PRIORITIES)
  priority?: PlannerTaskPriority;
}

export class UpdatePlannerTaskDto {
  @ApiPropertyOptional({ example: 'Revisar 10 kanjis do N5' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: PLANNER_CATEGORIES })
  @IsOptional()
  @IsIn(PLANNER_CATEGORIES)
  category?: PlannerCategory;

  @ApiPropertyOptional({ example: '2026-10-10' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date must be a YYYY-MM-DD string' })
  date?: string;

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: 'scheduledTime must be a HH:mm string' })
  scheduledTime?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  estimatedMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  actualMinutes?: number;

  @ApiPropertyOptional({ enum: PLANNER_PRIORITIES })
  @IsOptional()
  @IsIn(PLANNER_PRIORITIES)
  priority?: PlannerTaskPriority;

  @ApiPropertyOptional({ enum: PLANNER_STATUSES })
  @IsOptional()
  @IsIn(PLANNER_STATUSES)
  status?: PlannerTaskStatus;
}

export class CompletePlannerTaskDto {
  @ApiPropertyOptional({
    description:
      'Estado desejado. Omitido = toggle. Concluir uma tarefa já concluída é idempotente (sem histórico novo).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 720, example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  actualMinutes?: number;
}

export class PlannerTasksQueryDto {
  @ApiPropertyOptional({ example: '2026-10-10', description: 'YYYY-MM-DD' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'date must be a YYYY-MM-DD string' })
  date?: string;

  @ApiPropertyOptional({ example: '2026-10-05' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'startDate must be a YYYY-MM-DD string' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-11' })
  @IsOptional()
  @Matches(DATE_PATTERN, { message: 'endDate must be a YYYY-MM-DD string' })
  endDate?: string;

  @ApiPropertyOptional({ enum: PLANNER_STATUSES })
  @IsOptional()
  @IsIn(PLANNER_STATUSES)
  status?: PlannerTaskStatus;

  @ApiPropertyOptional({ enum: PLANNER_CATEGORIES })
  @IsOptional()
  @IsIn(PLANNER_CATEGORIES)
  category?: PlannerCategory;
}
