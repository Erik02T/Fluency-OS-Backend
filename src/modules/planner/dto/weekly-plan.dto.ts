import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlannerGoalCategory, WeeklyPlanStatus } from '@prisma/client';

export class GetWeeklyPlanQueryDto {
  @ApiPropertyOptional({
    description: 'Data de referência para a semana (formato YYYY-MM-DD)',
    example: '2026-08-27',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato YYYY-MM-DD',
  })
  date?: string;

  @ApiPropertyOptional({
    description: 'Ano do planejamento semanal',
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description: 'Número da semana no ano (1 a 53)',
    example: 35,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  weekNumber?: number;
}

export class WeeklyGoalItemDto {
  @ApiProperty({
    description: 'Categoria da meta semanal',
    enum: PlannerGoalCategory,
    example: PlannerGoalCategory.IMMERSION,
  })
  @IsEnum(PlannerGoalCategory)
  @IsNotEmpty()
  category!: PlannerGoalCategory;

  @ApiProperty({
    description: 'Valor alvo da meta',
    example: 300,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetValue!: number;

  @ApiPropertyOptional({
    description: 'Unidade de medida (ex: min, kanji, palavras)',
    example: 'min',
  })
  @IsOptional()
  @IsString()
  unit?: string;
}

export class UpdateWeeklyGoalsDto {
  @ApiProperty({
    description: 'Lista de metas para a semana',
    type: [WeeklyGoalItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyGoalItemDto)
  goals!: WeeklyGoalItemDto[];
}

export class UpdateWeeklyPlanDto {
  @ApiPropertyOptional({
    description: 'Status do plano semanal',
    enum: WeeklyPlanStatus,
    example: WeeklyPlanStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(WeeklyPlanStatus)
  status?: WeeklyPlanStatus;

  @ApiPropertyOptional({
    description: 'Anotações / observações do planejamento',
    example: 'Foco total no kanji N3 esta semana',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export interface WeeklyGoalResponseDto {
  id: string;
  category: PlannerGoalCategory;
  name: string;
  kanjiGlyph: string;
  targetValue: number;
  currentValue: number;
  percentage: number;
  unit: string;
}

export interface WeeklyPlanResponseDto {
  id: string;
  userId: string;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  status: WeeklyPlanStatus;
  notes: string | null;
  goals: WeeklyGoalResponseDto[];
  createdAt: string;
  updatedAt: string;
}
