import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { KanjiService } from './kanji.service';
import {
  KanjiFiltersDto,
  PaginatedKanjiResponseDto,
  KanjiDetailResponseDto,
} from './dto';

@ApiTags('Kanji')
@Controller('kanji')
export class KanjiController {
  constructor(private kanjiService: KanjiService) {}

  /**
   * GET /kanji
   * Listar kanjis com filtros, paginação e progresso do usuário
   *
   * Query params:
   *   - jlpt: JlptLevel (N5, N4, N3, N2, N1) [optional]
   *   - grade: number (1-9) [optional]
   *   - search: string [optional]
   *   - page: number (default 1)
   *   - perPage: number (default 20, max 100)
   *   - sort: 'frequency' | 'jlpt' | 'grade' | 'strokes' (default 'frequency')
   *
   * Returns: PaginatedKanjiResponseDto
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
    @Request() req: any,
  ): Promise<PaginatedKanjiResponseDto> {
    const userId = req.user?.id;
    return this.kanjiService.findAll(filters, userId);
  }

  /**
   * GET /kanji/search/:query
   * Buscar kanjis por termo (character, meaning, reading)
   *
   * Returns: Array<KanjiListResponseDto>
   */
  @Get('search/:query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buscar kanjis por termo' })
  @ApiResponse({
    status: 200,
    description: 'Resultados de busca retornados',
  })
  async search(@Param('query') query: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.kanjiService.search(query, userId);
  }

  /**
   * GET /kanji/:id
   * Buscar detalhe de um kanji por ID
   *
   * Returns: KanjiDetailResponseDto
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
    @Request() req: any,
  ): Promise<KanjiDetailResponseDto> {
    const userId = req.user?.id;
    return this.kanjiService.findById(id, userId);
  }
}
