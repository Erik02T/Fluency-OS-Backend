import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const ANALYTICS_PERIODS = ['7d', '30d', '90d', 'all'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_GRANULARITIES = ['day', 'week'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];

export class AnalyticsOverviewQueryDto {
  @ApiPropertyOptional({ enum: ANALYTICS_PERIODS, example: '30d' })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({ enum: ANALYTICS_GRANULARITIES, example: 'day' })
  @IsOptional()
  @IsIn(ANALYTICS_GRANULARITIES)
  granularity?: AnalyticsGranularity;
}
