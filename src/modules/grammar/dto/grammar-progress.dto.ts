import { IsBoolean, IsIn, Max, Min, ValidateIf } from 'class-validator';

export class UpdateGrammarProgressDto {
  @IsIn(['study', 'review'])
  action!: 'study' | 'review';

  @ValidateIf((dto: UpdateGrammarProgressDto) => dto.action === 'review')
  @IsBoolean()
  understood?: boolean;

  @ValidateIf((dto: UpdateGrammarProgressDto) => dto.action === 'review')
  @Min(0)
  @Max(5)
  confidenceLevel?: number;
}
