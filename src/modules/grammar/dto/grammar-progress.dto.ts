import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, Max, Min, ValidateIf } from 'class-validator';

const PROGRESS_ACTIONS = ['study', 'review'] as const;

export class UpdateGrammarProgressDto {
  @ApiProperty({ enum: PROGRESS_ACTIONS, example: 'study' })
  @IsIn(PROGRESS_ACTIONS)
  action!: (typeof PROGRESS_ACTIONS)[number];

  @ApiPropertyOptional({
    description:
      'Indica se o ponto foi compreendido. Obrigatório para review e ignorado para study.',
    example: true,
  })
  @ValidateIf((dto: UpdateGrammarProgressDto) => dto.action === 'review')
  @IsBoolean()
  understood?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 5,
    description:
      'Confiança selecionada pelo estudante. Obrigatório para review e ignorado para study.',
    example: 4,
  })
  @ValidateIf((dto: UpdateGrammarProgressDto) => dto.action === 'review')
  @Min(0)
  @Max(5)
  confidenceLevel?: number;
}
