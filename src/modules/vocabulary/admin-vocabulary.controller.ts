import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
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
import { JLPTLevel, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { VocabularyService } from './vocabulary.service';
import {
  CreateVocabularyDto,
  UpdateVocabularyDto,
  VocabularyFiltersDto,
  PaginatedVocabularyResponseDto,
  VocabularyDetailResponseDto,
} from './dto';
import { logStructured } from '../../common/logging/structured-log';

@ApiTags('Admin Vocabulary')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/vocabularies')
export class AdminVocabularyController {
  constructor(private readonly vocabularyService: VocabularyService) {}

  @Get()
  @ApiOperation({ summary: 'Listar vocabulários para administração' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'jlpt', required: false, enum: JLPTLevel })
  @ApiQuery({ name: 'search', required: false, type: String, example: '家' })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['frequency', 'jlpt', 'word', 'createdAt'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: 200,
    description: 'Lista administrativa de vocabulários retornada com sucesso',
    type: PaginatedVocabularyResponseDto,
  })
  list(
    @Query() filters: VocabularyFiltersDto,
  ): Promise<PaginatedVocabularyResponseDto> {
    logStructured(
      'info',
      'AdminVocabularyController',
      'admin.vocabulary.list.request',
      {
        filters,
      },
    );
    return this.vocabularyService.findAll(filters);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar vocabulário' })
  @ApiResponse({
    status: 201,
    description: 'Vocabulário criado com sucesso',
    type: VocabularyDetailResponseDto,
  })
  async create(
    @Body() dto: CreateVocabularyDto,
  ): Promise<VocabularyDetailResponseDto> {
    logStructured(
      'info',
      'AdminVocabularyController',
      'admin.vocabulary.create.request',
      {
        word: dto.word,
        reading: dto.reading,
        jlptLevel: dto.jlptLevel,
      },
    );
    return this.vocabularyService.createAdminVocabulary(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar vocabulário completo' })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Vocabulário atualizado com sucesso',
    type: VocabularyDetailResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVocabularyDto,
  ): Promise<VocabularyDetailResponseDto> {
    logStructured(
      'info',
      'AdminVocabularyController',
      'admin.vocabulary.update.request',
      {
        vocabularyId: id,
        payloadKeys: Object.keys(dto),
      },
    );
    return this.vocabularyService.updateAdminVocabulary(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover vocabulário' })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({ status: 204, description: 'Vocabulário removido com sucesso' })
  async delete(@Param('id') id: string): Promise<void> {
    logStructured(
      'info',
      'AdminVocabularyController',
      'admin.vocabulary.delete.request',
      {
        vocabularyId: id,
      },
    );
    await this.vocabularyService.deleteAdminVocabulary(id);
  }
}
