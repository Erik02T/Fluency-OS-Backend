import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, ValidateIf } from 'class-validator';

const PROGRESS_ACTIONS = ['study', 'review'] as const;

export class UpdateVocabularyProgressDto {
  @ApiProperty({ enum: PROGRESS_ACTIONS, example: 'study' })
  @IsIn(PROGRESS_ACTIONS)
  action!: (typeof PROGRESS_ACTIONS)[number];

  @ApiPropertyOptional({
    description:
      'Indica se a resposta foi correta. Obrigatório para review e ignorado para study.',
    example: true,
  })
  @ValidateIf((dto: UpdateVocabularyProgressDto) => dto.action === 'review')
  @IsBoolean()
  correct?: boolean;
}
