import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, ValidateIf } from 'class-validator';
import { SrsProgressResponseDto } from '../../../common/dto/srs-progress.dto';

const PROGRESS_ACTIONS = ['study', 'review'] as const;

export class UpdateKanjiProgressDto {
  @ApiProperty({ enum: PROGRESS_ACTIONS, example: 'study' })
  @IsIn(PROGRESS_ACTIONS)
  action!: (typeof PROGRESS_ACTIONS)[number];

  @ApiPropertyOptional({
    description:
      'Indica se a resposta foi correta. Obrigatório para review e ignorado para study.',
    example: true,
  })
  @ValidateIf((dto: UpdateKanjiProgressDto) => dto.action === 'review')
  @IsBoolean()
  correct?: boolean;
}

export class KanjiProgressResponseDto extends SrsProgressResponseDto {
  @ApiProperty()
  kanjiId!: string;
}
