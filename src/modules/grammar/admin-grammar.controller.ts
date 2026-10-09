import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GrammarService } from './grammar.service';
import {
  CreateGrammarPointDto,
  UpdateGrammarPointDto,
  GrammarDetailResponseDto,
} from './dto';
import { logStructured } from '../../common/logging/structured-log';

@ApiTags('Admin Grammar')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/grammar-points')
export class AdminGrammarController {
  constructor(private readonly grammarService: GrammarService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar ponto gramatical' })
  @ApiResponse({
    status: 201,
    description: 'Ponto gramatical criado com sucesso',
    type: GrammarDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (perfil não admin)' })
  @ApiResponse({ status: 409, description: 'Ponto gramatical já existe' })
  create(
    @Body() dto: CreateGrammarPointDto,
  ): Promise<GrammarDetailResponseDto> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.create.request',
      { pattern: dto.pattern, jlptLevel: dto.jlptLevel },
    );
    return this.grammarService.createAdminGrammarPoint(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar ponto gramatical' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único do ponto gramatical (cuid)',
    example: 'clxyz1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Ponto gramatical atualizado com sucesso',
    type: GrammarDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (perfil não admin)' })
  @ApiResponse({ status: 404, description: 'Ponto gramatical não encontrado' })
  @ApiResponse({ status: 409, description: 'Ponto gramatical já existe' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGrammarPointDto,
  ): Promise<GrammarDetailResponseDto> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.update.request',
      { grammarPointId: id, payloadKeys: Object.keys(dto) },
    );
    return this.grammarService.updateAdminGrammarPoint(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover ponto gramatical' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID único do ponto gramatical (cuid)',
    example: 'clxyz1234567890',
  })
  @ApiResponse({
    status: 204,
    description: 'Ponto gramatical removido com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (perfil não admin)' })
  @ApiResponse({ status: 404, description: 'Ponto gramatical não encontrado' })
  async delete(@Param('id') id: string): Promise<void> {
    logStructured(
      'info',
      'AdminGrammarController',
      'admin.grammar.delete.request',
      { grammarPointId: id },
    );
    await this.grammarService.deleteAdminGrammarPoint(id);
  }
}
