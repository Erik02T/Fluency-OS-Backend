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
import { Role, JLPTLevel } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KanjiService } from './kanji.service';
import {
  CreateKanjiDto,
  UpdateKanjiDto,
  KanjiFiltersDto,
  PaginatedKanjiResponseDto,
  KanjiDetailResponseDto,
} from './dto';

@ApiTags('Admin Kanji')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/kanjis')
export class AdminKanjiController {
  constructor(private readonly kanjiService: KanjiService) {}

  @Get()
  @ApiOperation({ summary: 'Listar kanjis para administração' })
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
    description: 'Lista administrativa de kanjis retornada com sucesso',
    type: PaginatedKanjiResponseDto,
  })
  list(@Query() filters: KanjiFiltersDto): Promise<PaginatedKanjiResponseDto> {
    return this.kanjiService.findAll(filters);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar kanji' })
  @ApiResponse({
    status: 201,
    description: 'Kanji criado com sucesso',
    type: KanjiDetailResponseDto,
  })
  async create(@Body() dto: CreateKanjiDto): Promise<KanjiDetailResponseDto> {
    return this.kanjiService.createAdminKanji(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar kanji completo' })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({
    status: 200,
    description: 'Kanji atualizado com sucesso',
    type: KanjiDetailResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKanjiDto,
  ): Promise<KanjiDetailResponseDto> {
    return this.kanjiService.updateAdminKanji(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover kanji' })
  @ApiParam({ name: 'id', type: String, example: 'clxyz1234567890' })
  @ApiResponse({ status: 204, description: 'Kanji removido com sucesso' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.kanjiService.deleteAdminKanji(id);
  }
}
