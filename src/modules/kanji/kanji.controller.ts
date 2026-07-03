import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { KanjiService } from './kanji.service';
import {
  KanjiFiltersDto,
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
  @ApiOperation({ summary: 'Listar kanjis com filtros' })
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
   * GET /kanji/search/:query
   * Buscar kanjis por termo (character, meaning, reading)
   */
  @Get('search/:query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar kanjis por termo' })
  @ApiResponse({
    status: 200,
    description: 'Resultados de busca retornados',
  })
  async search(
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
  @ApiOperation({ summary: 'Obter detalhe completo de um kanji' })
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
