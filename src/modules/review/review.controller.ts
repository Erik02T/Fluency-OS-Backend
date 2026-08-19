import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { ReviewService } from './services/review.service';
import {
  CreateReviewSessionDto,
  PaginatedReviewSessionResponseDto,
  ReviewAnswerResponseDto,
  ReviewHistoryQueryDto,
  ReviewQueueCountResponseDto,
  ReviewQueueResponseDto,
  ReviewSessionResponseDto,
  ReviewSessionStatsResponseDto,
  SubmitReviewAnswerDto,
} from './dto';
import { logStructured } from '../../common/logging/structured-log';

@ApiTags('Review')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  private getUserId(req: AuthRequest.AuthenticatedRequest): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException('User not authenticated');
    }
    return userId;
  }

  /**
   * GET /review/queue — Fila de revisão do dia
   */
  @Get('queue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter fila de itens vencidos para revisão' })
  @ApiResponse({
    status: 200,
    description: 'Fila de revisão retornada com sucesso',
    type: ReviewQueueResponseDto,
  })
  async getQueue(
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewQueueResponseDto> {
    const userId = this.getUserId(req);
    logStructured('info', 'ReviewController', 'review.queue.request', {
      userId,
    });
    return this.reviewService.getQueue(userId);
  }

  /**
   * GET /review/queue/count — Contagem de itens na fila
   */
  @Get('queue/count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter contagem de itens pendentes de revisão' })
  @ApiResponse({
    status: 200,
    description: 'Contagem retornada com sucesso',
    type: ReviewQueueCountResponseDto,
  })
  async getQueueCount(
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewQueueCountResponseDto> {
    const userId = this.getUserId(req);
    return this.reviewService.getQueueCount(userId);
  }

  /**
   * POST /review/sessions — Iniciar nova sessão de revisão
   */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Iniciar uma nova sessão de revisão' })
  @ApiResponse({
    status: 201,
    description: 'Sessão de revisão criada com sucesso',
    type: ReviewSessionResponseDto,
  })
  async createSession(
    @Body() dto: CreateReviewSessionDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    const userId = this.getUserId(req);
    logStructured('info', 'ReviewController', 'review.session.create.request', {
      userId,
      dto,
    });
    return this.reviewService.createSession(userId, dto);
  }

  /**
   * GET /review/sessions/history — Histórico de sessões do usuário
   */
  @Get('sessions/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar histórico de sessões do usuário autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Histórico de sessões retornado com sucesso',
    type: PaginatedReviewSessionResponseDto,
  })
  async getHistory(
    @Query() query: ReviewHistoryQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PaginatedReviewSessionResponseDto> {
    const userId = this.getUserId(req);
    logStructured('info', 'ReviewController', 'review.history.request', {
      userId,
      query,
    });
    return this.reviewService.getHistory(userId, query);
  }

  /**
   * GET /review/sessions/:id/stats — Estatísticas de uma sessão
   */
  @Get('sessions/:id/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obter estatísticas detalhadas de uma sessão de revisão',
  })
  @ApiParam({ name: 'id', description: 'ID da sessão' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas retornadas com sucesso',
    type: ReviewSessionStatsResponseDto,
  })
  async getStats(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionStatsResponseDto> {
    const userId = this.getUserId(req);
    return this.reviewService.getStats(id, userId);
  }

  /**
   * GET /review/sessions/:id — Dados da sessão atual
   */
  @Get('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter estado de uma sessão de revisão específica' })
  @ApiParam({ name: 'id', description: 'ID da sessão' })
  @ApiResponse({
    status: 200,
    description: 'Dados da sessão retornados com sucesso',
    type: ReviewSessionResponseDto,
  })
  async getSession(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    const userId = this.getUserId(req);
    return this.reviewService.getSession(id, userId);
  }

  /**
   * POST /review/sessions/:id/answer — Registrar resposta de um item
   */
  @Post('sessions/:id/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar resposta SRS de um item na sessão' })
  @ApiParam({ name: 'id', description: 'ID da sessão' })
  @ApiResponse({
    status: 200,
    description: 'Resposta gravada e próximo estado SRS calculado com sucesso',
    type: ReviewAnswerResponseDto,
  })
  async submitAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitReviewAnswerDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewAnswerResponseDto> {
    const userId = this.getUserId(req);
    logStructured('info', 'ReviewController', 'review.answer.request', {
      sessionId: id,
      userId,
      itemId: dto.item_id || dto.itemId,
    });
    return this.reviewService.submitAnswer(id, userId, dto);
  }

  /**
   * POST /review/sessions/:id/end — Encerrar sessão
   */
  @Post('sessions/:id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Encerrar sessão de revisão e calcular métricas finais',
  })
  @ApiParam({ name: 'id', description: 'ID da sessão' })
  @ApiResponse({
    status: 200,
    description: 'Sessão encerrada com sucesso',
    type: ReviewSessionResponseDto,
  })
  async endSession(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    const userId = this.getUserId(req);
    logStructured('info', 'ReviewController', 'review.end.request', {
      sessionId: id,
      userId,
    });
    return this.reviewService.endSession(id, userId);
  }

  /**
   * POST /review/sessions/:id/abandon — Abandonar sessão
   */
  @Post('sessions/:id/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Marcar sessão como abandonada mantendo progresso já feito',
  })
  @ApiParam({ name: 'id', description: 'ID da sessão' })
  @ApiResponse({
    status: 200,
    description: 'Sessão abandonada com sucesso',
    type: ReviewSessionResponseDto,
  })
  async abandonSession(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    const userId = this.getUserId(req);
    return this.reviewService.abandonSession(id, userId);
  }
}
