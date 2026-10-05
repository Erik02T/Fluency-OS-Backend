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
  UpdateGrammarReviewStatusDto,
} from './dto';
import { logStructured } from '../../common/logging/structured-log';

// FASE 16 - DTOs para administração do pipeline
class PipelineOperationDto {
  phase!: string;
  level?: string;
  dryRun?: boolean;
  force?: boolean;
}

class RollbackOperationDto {
  rollbackId!: string;
  dryRun?: boolean;
  force?: boolean;
}

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
    name: 'status',
    required: false,
    enum: ['PENDING', 'GENERATED', 'VALIDATED', 'REVIEWED', 'PUBLISHED'],
  })
  @ApiQuery({ name: 'tag', required: false, type: String, example: 'verb' })
  @ApiQuery({
    name: 'difficulty',
    required: false,
    type: Number,
    example: 2,
    minimum: 1,
    maximum: 5,
  })
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

  @Get(':id')
  @ApiOperation({
    summary: 'Obter detalhe completo de ponto gramatical (admin)',
  })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Detalhe administrativo da gramática retornado',
    type: GrammarDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Ponto gramatical não encontrado',
  })
  async getById(@Param('id') id: string): Promise<GrammarDetailResponseDto> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.detail.request',
      {
        grammarPointId: id,
      },
    );
    return this.grammarService.findById(id);
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

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Atualizar status de revisão e metadados de proveniência',
  })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Status de revisão atualizado com sucesso',
    type: GrammarDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Ponto gramatical não encontrado',
  })
  async patchStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGrammarReviewStatusDto,
  ): Promise<GrammarDetailResponseDto> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.patch-status.request',
      {
        grammarPointId: id,
        reviewStatus: dto.reviewStatus,
        source: dto.source,
        sourceId: dto.sourceId,
      },
    );
    return this.grammarService.updateGrammarReviewStatus(id, dto);
  }

  // FASE 16 - Endpoints de administração do pipeline

  @Post('pipeline/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Executar fase do pipeline de gramática' })
  @ApiResponse({
    status: 202,
    description: 'Fase do pipeline iniciada com sucesso',
  })
  // eslint-disable-next-line @typescript-eslint/require-await
  async runPipelinePhase(
    @Body() dto: PipelineOperationDto,
  ): Promise<{ message: string; dryRun: boolean }> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.pipeline.run',
      {
        phase: dto.phase,
        level: dto.level,
        dryRun: dto.dryRun,
      },
    );

    // Integrar com scripts do pipeline (scripts/grammar/*.ts)
    // Por enquanto, retorna resposta placeholder
    return {
      message: `Pipeline phase ${dto.phase} ${dto.dryRun ? '(dry-run)' : ''} initiated`,
      dryRun: dto.dryRun || false,
    };
  }

  @Get('pipeline/rollbacks')
  @ApiOperation({ summary: 'Listar rollbacks disponíveis' })
  @ApiResponse({
    status: 200,
    description: 'Lista de rollbacks disponíveis',
  })
  // eslint-disable-next-line @typescript-eslint/require-await
  async listRollbacks(): Promise<{ rollbacks: any[] }> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.pipeline.rollbacks.list',
      {},
    );

    // Integrar com sistema de rollback (scripts/utils/rollback.ts)
    // Por enquanto, retorna lista vazia
    return { rollbacks: [] };
  }

  @Post('pipeline/rollback')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Executar rollback' })
  @ApiResponse({
    status: 202,
    description: 'Rollback iniciado com sucesso',
  })
  // eslint-disable-next-line @typescript-eslint/require-await
  async executeRollback(
    @Body() dto: RollbackOperationDto,
  ): Promise<{ message: string; rollbackId: string }> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.pipeline.rollback',
      {
        rollbackId: dto.rollbackId,
        dryRun: dto.dryRun,
      },
    );

    // Integrar com sistema de rollback (scripts/utils/rollback.ts)
    // Por enquanto, retorna resposta placeholder
    return {
      message: `Rollback ${dto.rollbackId} ${dto.dryRun ? '(dry-run)' : ''} initiated`,
      rollbackId: dto.rollbackId,
    };
  }
}
