import {
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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewService } from './review.service';
import {
  CreateReviewSessionDto,
  EnqueueReviewItemDto,
  PaginatedReviewSessionResponseDto,
  ReviewAnswerResponseDto,
  ReviewHistoryQueryDto,
  ReviewQueueCountResponseDto,
  ReviewQueueResponseDto,
  ReviewSessionResponseDto,
  ReviewSessionStatsResponseDto,
  SubmitReviewAnswerDto,
} from './dto';

@ApiTags('Review')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('queue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fila de itens vencidos para revisão' })
  @ApiResponse({
    status: 200,
    description: 'Fila de revisão retornada com sucesso',
    type: ReviewQueueResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getQueue(
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewQueueResponseDto> {
    return this.reviewService.getQueue(req.user!.id);
  }

  @Post('queue')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disponibilizar um item para revisão agora' })
  @ApiResponse({ status: 204, description: 'Item disponível na fila' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  @ApiResponse({ status: 409, description: 'Item suspenso para revisão' })
  enqueue(
    @Body() dto: EnqueueReviewItemDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<void> {
    return this.reviewService.enqueue(req.user!.id, dto);
  }

  @Get('queue/count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Contagem de itens pendentes de revisão' })
  @ApiResponse({
    status: 200,
    description: 'Contagem retornada com sucesso',
    type: ReviewQueueCountResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getQueueCount(
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewQueueCountResponseDto> {
    return this.reviewService.getQueueCount(req.user!.id);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Iniciar nova sessão de revisão',
    description:
      'Aceita Kanji e Vocabulário. Sem tipo, inicia Kanji. O limite solicitado é limitado também pela preferência do usuário.',
  })
  @ApiResponse({
    status: 201,
    description: 'Sessão criada com sucesso',
    type: ReviewSessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  createSession(
    @Body() dto: CreateReviewSessionDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    return this.reviewService.createSession(req.user!.id, dto);
  }

  // ATENÇÃO: deve permanecer antes de GET sessions/:id (contrato history)
  @Get('sessions/history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Histórico de sessões do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['in_progress', 'completed', 'abandoned'],
  })
  @ApiResponse({
    status: 200,
    description: 'Histórico paginado retornado',
    type: PaginatedReviewSessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getHistory(
    @Query() query: ReviewHistoryQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PaginatedReviewSessionResponseDto> {
    return this.reviewService.getHistory(req.user!.id, query);
  }

  @Get('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter estado de uma sessão de revisão' })
  @ApiParam({ name: 'id', type: String, description: 'ID da sessão (cuid)' })
  @ApiResponse({
    status: 200,
    description: 'Sessão retornada com sucesso',
    type: ReviewSessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  getSession(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    return this.reviewService.getSession(req.user!.id, id);
  }

  @Get('sessions/:id/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estatísticas detalhadas de uma sessão' })
  @ApiParam({ name: 'id', type: String, description: 'ID da sessão (cuid)' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas retornadas com sucesso',
    type: ReviewSessionStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  getSessionStats(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionStatsResponseDto> {
    return this.reviewService.getSessionStats(req.user!.id, id);
  }

  @Post('sessions/:id/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar resposta SRS de um item',
    description:
      'Informe ID e tipo do card da sessão e qualidade de 0 a 3. Repetir a mesma resposta devolve o resultado já gravado. O tempo de resposta em milissegundos é opcional.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID da sessão (cuid)' })
  @ApiResponse({
    status: 200,
    description: 'Resposta registrada e SRS atualizado',
    type: ReviewAnswerResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão ou item não encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Resposta divergente ou sessão fechada para novas respostas',
  })
  submitAnswer(
    @Param('id') id: string,
    @Body() dto: SubmitReviewAnswerDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewAnswerResponseDto> {
    return this.reviewService.submitAnswer(req.user!.id, id, dto);
  }

  @Post('sessions/:id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encerrar sessão de revisão' })
  @ApiParam({ name: 'id', type: String, description: 'ID da sessão (cuid)' })
  @ApiResponse({
    status: 200,
    description: 'Sessão encerrada com sucesso',
    type: ReviewSessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @ApiResponse({ status: 409, description: 'Sessão não está em progresso' })
  endSession(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    return this.reviewService.endSession(req.user!.id, id);
  }

  @Post('sessions/:id/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abandonar sessão preservando progresso' })
  @ApiParam({ name: 'id', type: String, description: 'ID da sessão (cuid)' })
  @ApiResponse({
    status: 200,
    description: 'Sessão abandonada com sucesso',
    type: ReviewSessionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  @ApiResponse({ status: 409, description: 'Sessão não está em progresso' })
  abandonSession(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ReviewSessionResponseDto> {
    return this.reviewService.abandonSession(req.user!.id, id);
  }
}
