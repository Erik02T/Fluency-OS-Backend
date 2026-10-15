import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlannerService } from './planner.service';
import {
  CompletePlannerTaskDto,
  CreatePlannerTaskDto,
  DeletePlannerTaskResponseDto,
  PlannerHistoryItemResponseDto,
  PlannerOverviewResponseDto,
  PlannerTasksQueryDto,
  PlannerWeekQueryDto,
  TodaySummaryResponseDto,
  UpdatePlannerTaskDto,
  UpdateWeeklyGoalsDto,
  UpdateWeeklyPlanDto,
  WeeklyPlanResponseDto,
  PlannerTaskItemResponseDto,
} from './dto';

@ApiTags('Planner')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  // ─── Tarefas ───────────────────────────────────────────────────────────────

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar tarefa do planner' })
  @ApiResponse({ status: 201, description: 'Tarefa criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  createTask(
    @Body() dto: CreatePlannerTaskDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerTaskItemResponseDto> {
    return this.plannerService.createTask(req.user!.id, dto);
  }

  @Get('tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar tarefas com filtros de data/status/categoria',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-10-10' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-10-05' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-10-11' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'COMPLETED'] })
  @ApiQuery({ name: 'category', required: false, example: 'KANJI' })
  @ApiResponse({ status: 200, description: 'Lista de tarefas retornada' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  listTasks(
    @Query() query: PlannerTasksQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerTaskItemResponseDto[]> {
    return this.plannerService.listTasks(req.user!.id, query);
  }

  @Get('tasks/:id/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Histórico de transições de status da tarefa (task_id + status_antigo → status_novo)',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID da tarefa (cuid)' })
  @ApiResponse({ status: 200, description: 'Histórico retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  getTaskHistory(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerHistoryItemResponseDto[]> {
    return this.plannerService.getTaskHistory(req.user!.id, id);
  }

  @Get('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter uma tarefa pelo id' })
  @ApiParam({ name: 'id', type: String, description: 'ID da tarefa (cuid)' })
  @ApiResponse({ status: 200, description: 'Tarefa retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  getTask(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerTaskItemResponseDto> {
    return this.plannerService.getTask(req.user!.id, id);
  }

  @Patch('tasks/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Concluir/reabrir tarefa (idempotente — não duplica histórico de status)',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID da tarefa (cuid)' })
  @ApiResponse({ status: 200, description: 'Status atualizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  completeTask(
    @Param('id') id: string,
    @Body() dto: CompletePlannerTaskDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerTaskItemResponseDto> {
    return this.plannerService.completeTask(req.user!.id, id, dto);
  }

  @Patch('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar tarefa (campos e/ou status)' })
  @ApiParam({ name: 'id', type: String, description: 'ID da tarefa (cuid)' })
  @ApiResponse({ status: 200, description: 'Tarefa atualizada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  updateTask(
    @Param('id') id: string,
    @Body() dto: UpdatePlannerTaskDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerTaskItemResponseDto> {
    return this.plannerService.updateTask(req.user!.id, id, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover tarefa' })
  @ApiParam({ name: 'id', type: String, description: 'ID da tarefa (cuid)' })
  @ApiResponse({ status: 200, description: 'Tarefa removida com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  deleteTask(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<DeletePlannerTaskResponseDto> {
    return this.plannerService.deleteTask(req.user!.id, id);
  }

  // ─── Resumo / overview ─────────────────────────────────────────────────────

  @Get('summary/today')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resumo do dia (tarefas, minutos e streak)' })
  @ApiResponse({ status: 200, description: 'Resumo retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getTodaySummary(
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<TodaySummaryResponseDto> {
    return this.plannerService.getTodaySummary(req.user!.id);
  }

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Overview do planner (semana, hábitos, tarefas do dia, metas e resumo)',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-10-10' })
  @ApiResponse({ status: 200, description: 'Overview retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getOverview(
    @Query('date') date: string | undefined,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PlannerOverviewResponseDto> {
    return this.plannerService.getOverview(req.user!.id, date);
  }

  // ─── Plano semanal + metas ─────────────────────────────────────────────────

  @Get('week')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Plano semanal (cria com metas default se não existir para a data)',
  })
  @ApiQuery({ name: 'date', required: false, example: '2026-10-10' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiQuery({ name: 'weekNumber', required: false, example: 41 })
  @ApiResponse({ status: 200, description: 'Plano retornado com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Plano inexistente (year/weekNumber)',
  })
  getWeek(
    @Query() query: PlannerWeekQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<WeeklyPlanResponseDto> {
    return this.plannerService.getWeek(req.user!.id, query);
  }

  @Put('weeks/:id/goals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar metas semanais (upsert por categoria)' })
  @ApiParam({ name: 'id', type: String, description: 'ID do plano semanal' })
  @ApiResponse({ status: 200, description: 'Metas atualizadas com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  updateWeekGoals(
    @Param('id') id: string,
    @Body() dto: UpdateWeeklyGoalsDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<WeeklyPlanResponseDto> {
    return this.plannerService.updateWeekGoals(req.user!.id, id, dto);
  }

  @Patch('weeks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar plano semanal (status/notes)' })
  @ApiParam({ name: 'id', type: String, description: 'ID do plano semanal' })
  @ApiResponse({ status: 200, description: 'Plano atualizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Plano não encontrado' })
  updateWeek(
    @Param('id') id: string,
    @Body() dto: UpdateWeeklyPlanDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<WeeklyPlanResponseDto> {
    return this.plannerService.updateWeek(req.user!.id, id, dto);
  }
}
