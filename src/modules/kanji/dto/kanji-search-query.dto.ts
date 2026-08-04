import { IsOptional, IsString, Min, Max, MinLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KanjiSearchQueryDto {
  @ApiProperty({
    description:
      'Termo de busca (caractere, significado, leitura ou romanização)',
    example: '日',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q!: string;

  @ApiPropertyOptional({
    description: 'Número máximo de resultados',
    example: 50,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit: number = 50;
}
