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
import { VocabularyService } from './vocabulary.service';
import {
  PaginatedVocabularyResponseDto,
  VocabularyFiltersDto,
  VocabularyDetailResponseDto,
  VocabularyProgressResponseDto,
  UpdateVocabularyProgressDto,
} from './dto';

@ApiTags('Vocabulary')
@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar vocabulário com filtros e paginação' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'jlpt', required: false, enum: JLPTLevel })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    example: '食べる',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['frequency', 'jlpt', 'word', 'createdAt'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: 200,
    description: 'Lista de vocabulário retornada com sucesso',
    type: PaginatedVocabularyResponseDto,
  })
  list(
    @Query() filters: VocabularyFiltersDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PaginatedVocabularyResponseDto> {
    return this.vocabularyService.findAll(filters, req.user?.id);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obter detalhe completo de um item de vocabulário' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único do vocabulário (cuid)',
    example: 'clxyz1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalhe do vocabulário retornado',
    type: VocabularyDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Vocabulário não encontrado',
  })
  findById(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<VocabularyDetailResponseDto> {
    return this.vocabularyService.findById(id, req.user?.id);
  }

  @Post(':id/progress')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Marcar vocabulário como estudado ou revisado' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único do vocabulário (cuid)',
    example: 'clxyz1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Progresso atualizado com sucesso',
    type: VocabularyProgressResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Vocabulário não encontrado' })
  updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateVocabularyProgressDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<VocabularyProgressResponseDto> {
    return this.vocabularyService.updateProgress(req.user!.id, id, dto);
  }
}
