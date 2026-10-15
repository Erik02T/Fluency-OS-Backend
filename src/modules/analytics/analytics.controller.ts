import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import {
  ANALYTICS_GRANULARITIES,
  ANALYTICS_PERIODS,
  AnalyticsOverviewQueryDto,
  AnalyticsOverviewResponseDto,
} from './dto';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Overview analítico (resumo, série de estudo e imersão)',
  })
  @ApiQuery({ name: 'period', required: false, enum: ANALYTICS_PERIODS })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ANALYTICS_GRANULARITIES,
  })
  @ApiResponse({
    status: 200,
    description: 'Overview retornado com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getOverview(
    @Query() query: AnalyticsOverviewQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<AnalyticsOverviewResponseDto> {
    return this.analyticsService.getOverview(req.user!.id, query);
  }
}
