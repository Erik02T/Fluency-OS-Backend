import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JLPTLevel } from '@prisma/client';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { KanjiService } from './kanji.service';
import {
  KanjiFiltersDto,
  KanjiSearchQueryDto,
  PaginatedKanjiResponseDto,
  KanjiDetailResponseDto,
  KanjiListResponseDto,
} from './dto';

@ApiTags('Kanji')
@Controller('kanji')
export class KanjiController {
  constructor(private kanjiService: KanjiService) {}

  /**
   * GET /kanji
   * Listar kanjis com filtros, paginação e progresso do usuário
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Listar kanjis com filtros' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'jlpt', required: false, enum: JLPTLevel })
  @ApiQuery({ name: 'grade', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'search', required: false, type: String, example: '日' })
  @ApiQuery({ name: 'favorites', required: false, type: Boolean })
  @ApiQuery({ name: 'mastered', required: false, type: Boolean })
  @ApiQuery({ name: 'suspended', required: false, type: Boolean })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['frequency', 'jlpt', 'grade', 'strokes', 'srsLevel', 'mastered'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: 200,
    description: 'Lista de kanjis retornada com sucesso',
    type: PaginatedKanjiResponseDto,
  })
  async list(
    @Query() filters: KanjiFiltersDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PaginatedKanjiResponseDto> {
    const userId = req.user?.id;
    return this.kanjiService.findAll(filters, userId);
  }

  /**
   * GET /kanji/search
   * Buscar kanjis por termo (character, meaning, reading)
   */
  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Buscar kanjis por termo (full-text)' })
  @ApiQuery({ name: 'q', required: true, type: String, example: 'sol' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Resultados de busca retornados',
    type: [KanjiListResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Parâmetro de busca inválido ou ausente',
  })
  async searchByQuery(
    @Query() queryDto: KanjiSearchQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<KanjiListResponseDto[]> {
    const userId = req.user?.id;
    return this.kanjiService.search(queryDto.q, userId, queryDto.limit);
  }

  /**
   * GET /kanji/search/:query
   * @deprecated Use GET /kanji/search?q=... — mantido por compatibilidade
   */
  @Get('search/:query')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Buscar kanjis por termo (legado via path param)',
    deprecated: true,
  })
  @ApiParam({ name: 'query', type: String, example: '日' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Resultados de busca retornados',
    type: [KanjiListResponseDto],
  })
  async searchByPath(
    @Param('query') query: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<KanjiListResponseDto[]> {
    const userId = req.user?.id;
    return this.kanjiService.search(query, userId);
  }

  /**
   * GET /kanji/:id
   * Buscar detalhe de um kanji por ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obter detalhe completo de um kanji' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único do kanji (cuid)',
    example: 'clxyz1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhe do kanji retornado',
    type: KanjiDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Kanji não encontrado',
  })
  async findById(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<KanjiDetailResponseDto> {
    const userId = req.user?.id;
    return this.kanjiService.findById(id, userId);
  }
}
