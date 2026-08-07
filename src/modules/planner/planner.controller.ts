import { Controller, Get, HttpCode, HttpStatus, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import type { PlannerOverviewResponseDto } from './dto';
import { PlannerService } from './planner.service';

@ApiTags('Planner')
@Controller('planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Gera e retorna o planner do usuário: tarefas diárias derivadas de progresso real, hábitos, metas semanais e resumo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Overview do planner gerado com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getOverview(
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerOverviewResponseDto> {
    return this.plannerService.getOverview(req.user!.id);
  }
}
