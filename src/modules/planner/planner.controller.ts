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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import {
  CreatePlannerTaskDto,
  GetPlannerTasksQueryDto,
  GetWeeklyPlanQueryDto,
  PlannerOverviewResponseDto,
  PlannerTaskItemResponseDto,
  TodaySummaryResponseDto,
  TogglePlannerTaskDto,
  UpdatePlannerTaskDto,
  UpdateWeeklyGoalsDto,
  UpdateWeeklyPlanDto,
  WeeklyPlanResponseDto,
} from './dto';
import { PlannerService } from './planner.service';

@ApiTags('Planner')
@Controller('planner')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  // ══════════════════════════════════════════════════════════════════════════════
  // OVERVIEW
  // ══════════════════════════════════════════════════════════════════════════════

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Gera e retorna o overview do planner do usuário para o dia/semana de referência.',
  })
  @ApiResponse({
    status: 200,
    description: 'Overview do planner gerado com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getOverview(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Query('date') date?: string,
  ): Promise<PlannerOverviewResponseDto> {
    return this.plannerService.getOverview(req.user!.id, date);
  }

  @Get('summary/today')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retorna o resumo de hoje do usuário.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumo de hoje retornado com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getTodaySummary(
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<TodaySummaryResponseDto> {
    return this.plannerService.getTodaySummary(req.user!.id);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PLANEJAMENTO SEMANAL & METAS
  // ══════════════════════════════════════════════════════════════════════════════

  @Get('week')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Obtém ou inicializa o planejamento semanal e suas metas para a data/semana especificada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Planejamento semanal retornado com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getWeeklyPlan(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Query() query: GetWeeklyPlanQueryDto,
  ): Promise<WeeklyPlanResponseDto> {
    return this.plannerService.getOrCreateWeeklyPlan(
      req.user!.id,
      query.date,
      query.year,
      query.weekNumber,
    );
  }

  @Put('weeks/:id/goals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Atualiza ou define as metas de um planejamento semanal.',
  })
  @ApiParam({ name: 'id', description: 'ID do plano semanal' })
  @ApiResponse({
    status: 200,
    description: 'Metas semanais atualizadas com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 404, description: 'Plano semanal não encontrado' })
  updateWeeklyGoals(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Param('id') planId: string,
    @Body() dto: UpdateWeeklyGoalsDto,
  ): Promise<WeeklyPlanResponseDto> {
    return this.plannerService.updateWeeklyGoals(req.user!.id, planId, dto);
  }

  @Patch('weeks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Atualiza status ou anotações de um planejamento semanal.',
  })
  @ApiParam({ name: 'id', description: 'ID do plano semanal' })
  @ApiResponse({
    status: 200,
    description: 'Plano semanal atualizado com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 404, description: 'Plano semanal não encontrado' })
  updateWeeklyPlan(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Param('id') planId: string,
    @Body() dto: UpdateWeeklyPlanDto,
  ): Promise<WeeklyPlanResponseDto> {
    return this.plannerService.updateWeeklyPlan(req.user!.id, planId, dto);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SISTEMA DE TAREFAS
  // ══════════════════════════════════════════════════════════════════════════════

  @Post('tasks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria uma nova tarefa personalizada no planner.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tarefa criada com sucesso.',
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  createTask(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Body() dto: CreatePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    return this.plannerService.createTask(req.user!.id, dto);
  }

  @Get('tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Lista as tarefas do usuário com filtros por data, período, categoria e status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de tarefas retornada com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getTasks(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Query() query: GetPlannerTasksQueryDto,
  ): Promise<PlannerTaskItemResponseDto[]> {
    return this.plannerService.getTasks(req.user!.id, query);
  }

  @Patch('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Edita uma tarefa existente do usuário.',
  })
  @ApiParam({ name: 'id', description: 'ID da tarefa' })
  @ApiResponse({
    status: 200,
    description: 'Tarefa atualizada com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  updateTask(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Param('id') taskId: string,
    @Body() dto: UpdatePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    return this.plannerService.updateTask(req.user!.id, taskId, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exclui uma tarefa do planner do usuário.',
  })
  @ApiParam({ name: 'id', description: 'ID da tarefa' })
  @ApiResponse({
    status: 200,
    description: 'Tarefa excluída com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  deleteTask(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Param('id') taskId: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.plannerService.deleteTask(req.user!.id, taskId);
  }

  @Patch('tasks/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Conclui ou reabre uma tarefa de forma idempotente.',
  })
  @ApiParam({ name: 'id', description: 'ID da tarefa' })
  @ApiResponse({
    status: 200,
    description: 'Status de conclusão da tarefa atualizado com sucesso.',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiResponse({ status: 404, description: 'Tarefa não encontrada' })
  toggleTaskCompletion(
    @Request() req: AuthRequest.AuthenticatedRequest,
    @Param('id') taskId: string,
    @Body() dto: TogglePlannerTaskDto,
  ): Promise<PlannerTaskItemResponseDto> {
    return this.plannerService.toggleTaskCompletion(req.user!.id, taskId, dto);
  }
}
