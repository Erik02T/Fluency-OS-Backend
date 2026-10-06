import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import {
  DashboardSummaryService,
  type DashboardSummaryResponse,
} from './dashboard-summary.service';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardSummaryController {
  constructor(
    private readonly dashboardSummaryService: DashboardSummaryService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Resumo mínimo do dashboard do usuário autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumo retornado com sucesso',
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido ou expirado',
  })
  async summary(
    @Request() req: AuthenticatedRequest,
  ): Promise<DashboardSummaryResponse> {
    return this.dashboardSummaryService.getSummary(req.user!.id);
  }
}
