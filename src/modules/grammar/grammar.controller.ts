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
import { JLPTLevel } from '@prisma/client';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GrammarService } from './grammar.service';
import {
  PaginatedGrammarResponseDto,
  GrammarFiltersDto,
  GrammarDetailResponseDto,
  GrammarProgressResponseDto,
  UpdateGrammarProgressDto,
} from './dto';

@ApiTags('Grammar')
@Controller('grammar')
export class GrammarController {
  constructor(private readonly grammarService: GrammarService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar pontos gramaticais com filtros e paginação',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'jlpt', required: false, enum: JLPTLevel })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    example: '〜ている',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['difficulty', 'jlpt', 'pattern', 'createdAt', 'position'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: 200,
    description: 'Lista de gramática retornada com sucesso',
    type: PaginatedGrammarResponseDto,
  })
  list(
    @Query() filters: GrammarFiltersDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PaginatedGrammarResponseDto> {
    return this.grammarService.findAll(filters, req.user?.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Obter detalhe completo de um ponto gramatical',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único do ponto gramatical (cuid)',
    example: 'clxyz1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhe da gramática retornado',
    type: GrammarDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Ponto gramatical não encontrado',
  })
  findById(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<GrammarDetailResponseDto> {
    return this.grammarService.findById(id, req.user?.id);
  }

  @Post(':id/progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Marcar ponto gramatical como estudado ou revisado',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único do ponto gramatical (cuid)',
    example: 'clxyz1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Progresso atualizado com sucesso',
    type: GrammarProgressResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({
    status: 404,
    description: 'Ponto gramatical não encontrado',
  })
  updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateGrammarProgressDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<GrammarProgressResponseDto> {
    return this.grammarService.updateProgress(req.user!.id, id, dto);
  }
}
