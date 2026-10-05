import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ImmersionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import * as AuthRequest from '../auth/interfaces/authenticated-request.interface';
import { ImmersionService } from './immersion.service';
import {
  CreateImmersionLogDto,
  ImmersionLogFiltersDto,
  ImmersionLogResponseDto,
  PaginatedImmersionLogResponseDto,
} from './dto';

@ApiTags('Immersion')
@Controller('immersion')
export class ImmersionController {
  constructor(private readonly immersionService: ImmersionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Criar um novo log de imersão para o usuário autenticado',
  })
  @ApiResponse({
    status: 201,
    description: 'Log de imersão criado com sucesso',
    type: ImmersionLogResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  create(
    @Body() dto: CreateImmersionLogDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<ImmersionLogResponseDto> {
    return this.immersionService.create(req.user!.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Listar logs de imersão do usuário autenticado com filtros e paginação',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: ImmersionType })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['loggedAt', 'durationMinutes', 'createdAt'],
  })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs de imersão retornada com sucesso',
    type: PaginatedImmersionLogResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  list(
    @Query() filters: ImmersionLogFiltersDto,
    @Request() req: AuthRequest.AuthenticatedRequest,
  ): Promise<PaginatedImmersionLogResponseDto> {
    return this.immersionService.findAll(req.user!.id, filters);
  }
}
