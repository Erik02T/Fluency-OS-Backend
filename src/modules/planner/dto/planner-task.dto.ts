import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PlannerCategory,
  PlannerTaskPriority,
  PlannerTaskStatus,
} from '@prisma/client';

export class CreatePlannerTaskDto {
  @ApiProperty({
    description: 'Título da tarefa',
    example: 'Revisar 20 kanjis do N4',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({
    description: 'Descrição ou anotações adicionais',
    example: 'Focar nos kanjis com taxa de erro maior',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Categoria da tarefa',
    enum: PlannerCategory,
    default: PlannerCategory.GENERAL,
    example: PlannerCategory.KANJI,
  })
  @IsOptional()
  @IsEnum(PlannerCategory)
  category?: PlannerCategory;

  @ApiProperty({
    description: 'Data de execução da tarefa (formato YYYY-MM-DD)',
    example: '2026-08-27',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato YYYY-MM-DD',
  })
  date!: string;

  @ApiPropertyOptional({
    description: 'Horário agendado (formato HH:mm)',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'scheduledTime deve estar no formato HH:mm (24h)',
  })
  scheduledTime?: string;

  @ApiPropertyOptional({
    description: 'Duração estimada em minutos',
    example: 25,
    default: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  estimatedMinutes?: number;

  @ApiPropertyOptional({
    description: 'Prioridade da tarefa',
    enum: PlannerTaskPriority,
    default: PlannerTaskPriority.MEDIUM,
    example: PlannerTaskPriority.HIGH,
  })
  @IsOptional()
  @IsEnum(PlannerTaskPriority)
  priority?: PlannerTaskPriority;
}

export class UpdatePlannerTaskDto {
  @ApiPropertyOptional({
    description: 'Título da tarefa',
    example: 'Revisar 25 kanjis do N4',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional({
    description: 'Descrição ou anotações adicionais',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Categoria da tarefa',
    enum: PlannerCategory,
  })
  @IsOptional()
  @IsEnum(PlannerCategory)
  category?: PlannerCategory;

  @ApiPropertyOptional({
    description: 'Data de execução (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato YYYY-MM-DD',
  })
  date?: string;

  @ApiPropertyOptional({
    description: 'Horário agendado (HH:mm)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'scheduledTime deve estar no formato HH:mm (24h)',
  })
  scheduledTime?: string;

  @ApiPropertyOptional({
    description: 'Duração estimada em minutos',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  estimatedMinutes?: number;

  @ApiPropertyOptional({
    description: 'Duração real em minutos',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  actualMinutes?: number;

  @ApiPropertyOptional({
    description: 'Prioridade da tarefa',
    enum: PlannerTaskPriority,
  })
  @IsOptional()
  @IsEnum(PlannerTaskPriority)
  priority?: PlannerTaskPriority;

  @ApiPropertyOptional({
    description: 'Status da tarefa',
    enum: PlannerTaskStatus,
  })
  @IsOptional()
  @IsEnum(PlannerTaskStatus)
  status?: PlannerTaskStatus;
}

export class TogglePlannerTaskDto {
  @ApiPropertyOptional({
    description:
      'Forçar status específico (true para concluída, false para pendente)',
  })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({
    description: 'Minutos reais gastos na execução da tarefa',
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  actualMinutes?: number;
}

export class GetPlannerTasksQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por data específica (YYYY-MM-DD)',
    example: '2026-08-27',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato YYYY-MM-DD',
  })
  date?: string;

  @ApiPropertyOptional({
    description: 'Data de início do período (YYYY-MM-DD)',
    example: '2026-08-24',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate deve estar no formato YYYY-MM-DD',
  })
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Data de fim do período (YYYY-MM-DD)',
    example: '2026-08-30',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate deve estar no formato YYYY-MM-DD',
  })
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por status',
    enum: PlannerTaskStatus,
  })
  @IsOptional()
  @IsEnum(PlannerTaskStatus)
  status?: PlannerTaskStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por categoria',
    enum: PlannerCategory,
  })
  @IsOptional()
  @IsEnum(PlannerCategory)
  category?: PlannerCategory;
}

export interface PlannerTaskItemResponseDto {
  id: string;
  userId: string;
  weeklyPlanId: string | null;
  title: string;
  description: string | null;
  category: PlannerCategory;
  categoryLabel: string;
  kanjiGlyph: string;
  date: string;
  scheduledTime: string | null;
  estimatedMinutes: number;
  actualMinutes: number | null;
  priority: PlannerTaskPriority;
  status: PlannerTaskStatus;
  completedAt: string | null;
  isAutoGenerated: boolean;
  actionPayload?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
