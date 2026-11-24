import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty({ type: 'integer' })
  page!: number;

  @ApiProperty({ type: 'integer' })
  perPage!: number;

  @ApiProperty({ type: 'integer' })
  total!: number;

  @ApiProperty({ type: 'integer' })
  pages!: number;
}
