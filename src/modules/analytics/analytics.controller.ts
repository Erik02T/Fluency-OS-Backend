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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { AnalyticsService } from './analytics.service';
import { AnalyticsOverviewResponseDto, AnalyticsQueryDto } from './dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Obter séries históricas e resumo analítico do usuário autenticado',
    description:
      'Retorna agregações reais de estudo (kanji, vocab, gramática, imersão, streaks) organizadas por período e granularidade.',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d', 'all'],
    description: 'Período histórico da série (padrão: 30d)',
  })
  @ApiQuery({
    name: 'granularity',
    required: false,
    enum: ['day', 'week'],
    description: 'Granularidade de agregação (padrão: day)',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados analíticos agregados retornados com sucesso',
    type: AnalyticsOverviewResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getOverview(
    @Query() query: AnalyticsQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<AnalyticsOverviewResponseDto> {
    return this.analyticsService.getOverview(req.user!.id, query);
  }
}
