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
import { ImmersionService } from './immersion.service';
import {
  CreateImmersionLogDto,
  DeleteImmersionLogResponseDto,
  IMMERSION_SORT_FIELDS,
  IMMERSION_SORT_ORDERS,
  IMMERSION_TYPES,
  ImmersionLogQueryDto,
  ImmersionLogResponseDto,
  PaginatedImmersionLogResponseDto,
  UpdateImmersionLogDto,
} from './dto';

@ApiTags('Immersion')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('immersion')
export class ImmersionController {
  constructor(private readonly immersionService: ImmersionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nova sessão de imersão' })
  @ApiResponse({ status: 201, description: 'Sessão criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  createLog(
    @Body() dto: CreateImmersionLogDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ImmersionLogResponseDto> {
    return this.immersionService.createLog(req.user!.id, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listar sessões de imersão do usuário' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'type', required: false, enum: IMMERSION_TYPES })
  @ApiQuery({
    name: 'startDate',
    required: false,
    example: '2026-09-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    example: '2026-10-10T23:59:59.000Z',
  })
  @ApiQuery({ name: 'sort', required: false, enum: IMMERSION_SORT_FIELDS })
  @ApiQuery({ name: 'order', required: false, enum: IMMERSION_SORT_ORDERS })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada retornada com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  getLogs(
    @Query() query: ImmersionLogQueryDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PaginatedImmersionLogResponseDto> {
    return this.immersionService.getLogs(req.user!.id, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter uma sessão de imersão pelo id' })
  @ApiParam({ name: 'id', type: String, description: 'ID do log (cuid)' })
  @ApiResponse({ status: 200, description: 'Sessão retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  getLog(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ImmersionLogResponseDto> {
    return this.immersionService.getLog(req.user!.id, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar uma sessão de imersão' })
  @ApiParam({ name: 'id', type: String, description: 'ID do log (cuid)' })
  @ApiResponse({ status: 200, description: 'Sessão atualizada com sucesso' })
  @ApiResponse({ status: 400, description: 'Payload inválido' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  updateLog(
    @Param('id') id: string,
    @Body() dto: UpdateImmersionLogDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ImmersionLogResponseDto> {
    return this.immersionService.updateLog(req.user!.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover uma sessão de imersão' })
  @ApiParam({ name: 'id', type: String, description: 'ID do log (cuid)' })
  @ApiResponse({ status: 200, description: 'Sessão removida com sucesso' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 404, description: 'Sessão não encontrada' })
  deleteLog(
    @Param('id') id: string,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<DeleteImmersionLogResponseDto> {
    return this.immersionService.deleteLog(req.user!.id, id);
  }
}
