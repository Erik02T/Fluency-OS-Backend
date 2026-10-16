import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { DashboardSummaryService } from './dashboard.service';
import type { DashboardSummaryResponse } from './dto';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardSummaryService: DashboardSummaryService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Resumo unificado do dashboard (Kanji, Vocabulário, Gramática e Streaks) do usuário autenticado',
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
