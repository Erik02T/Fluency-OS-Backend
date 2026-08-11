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
import { GrammarService } from './grammar.service';
import {
  CreateGrammarPointDto,
  GrammarFiltersDto,
  GrammarDetailResponseDto,
  PaginatedGrammarResponseDto,
  UpdateGrammarPointDto,
} from './dto';
import { logStructured } from '../../common/logging/structured-log';

@ApiTags('Admin Grammar')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/grammar-points')
export class AdminGrammarController {
  constructor(private readonly grammarService: GrammarService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pontos gramaticais para administração' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'jlpt', required: false, enum: JLPTLevel })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    example: 'ている',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['difficulty', 'jlpt', 'pattern', 'createdAt', 'position'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: 200,
    description: 'Lista administrativa de gramática retornada com sucesso',
    type: PaginatedGrammarResponseDto,
  })
  list(
    @Query() filters: GrammarFiltersDto,
  ): Promise<PaginatedGrammarResponseDto> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.list.request',
      {
        filters,
      },
    );
    return this.grammarService.findAll(filters);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar ponto gramatical' })
  @ApiResponse({
    status: 201,
    description: 'Ponto gramatical criado com sucesso',
    type: GrammarDetailResponseDto,
  })
  async create(
    @Body() dto: CreateGrammarPointDto,
  ): Promise<GrammarDetailResponseDto> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.create.request',
      {
        pattern: dto.pattern,
        jlptLevel: dto.jlptLevel,
      },
    );
    return this.grammarService.createAdminGrammarPoint(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar ponto gramatical completo' })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Ponto gramatical atualizado com sucesso',
    type: GrammarDetailResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGrammarPointDto,
  ): Promise<GrammarDetailResponseDto> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.update.request',
      {
        grammarPointId: id,
        payloadKeys: Object.keys(dto),
      },
    );
    return this.grammarService.updateAdminGrammarPoint(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover ponto gramatical' })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({
    status: 204,
    description: 'Ponto gramatical removido com sucesso',
  })
  async delete(@Param('id') id: string): Promise<void> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.delete.request',
      {
        grammarPointId: id,
      },
    );
    await this.grammarService.deleteAdminGrammarPoint(id);
  }
}
