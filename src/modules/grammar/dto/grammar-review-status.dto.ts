import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

/**
 * FASE 0 — Contrato de Arquitetura
 *
 * DTO para atualização do ReviewStatus de um GrammarPoint.
 * Usado pela rota de admin para mover um ponto pelo ciclo de vida:
 *   PENDING → GENERATED → VALIDATED → REVIEWED → PUBLISHED
 */
export class UpdateGrammarReviewStatusDto {
  @ApiPropertyOptional({
    enum: ReviewStatus,
    description: 'Novo status de revisão do ponto gramatical',
    example: ReviewStatus.REVIEWED,
  })
  @IsOptional()
  @IsEnum(ReviewStatus)
  reviewStatus?: ReviewStatus;

  @ApiPropertyOptional({
    description: 'Origem do dado (ex: "manual", "pdf-n5", "ai-generated")',
    example: 'pdf-n5',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'ID do item na fonte de origem',
    example: 'GrammarList.N5.p42',
  })
  @IsOptional()
  @IsString()
  sourceId?: string;
}
