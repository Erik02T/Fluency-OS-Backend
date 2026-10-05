import { ApiProperty } from '@nestjs/swagger';

export class ReviewQueueCountResponseDto {
  @ApiProperty({ example: 28 })
  kanji!: number;

  @ApiProperty({ example: 14 })
  vocabulary!: number;

  @ApiProperty({ example: 42 })
  total!: number;
}
