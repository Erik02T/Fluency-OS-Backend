import { IsBoolean, IsIn, ValidateIf } from 'class-validator';

export class UpdateVocabularyProgressDto {
  @IsIn(['study', 'review'])
  action!: 'study' | 'review';

  @ValidateIf((dto: UpdateVocabularyProgressDto) => dto.action === 'review')
  @IsBoolean()
  correct?: boolean;
}
