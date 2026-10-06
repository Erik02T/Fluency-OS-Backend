import { IsIn, IsOptional } from 'class-validator';
import type {
  AnalyticsGranularity,
  AnalyticsPeriod,
} from '../types/analytics.types';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', 'all'])
  period?: AnalyticsPeriod = '30d';

  @IsOptional()
  @IsIn(['day', 'week'])
  granularity?: AnalyticsGranularity = 'day';
}
