import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsOptional, Matches } from 'class-validator';
import { JLPTLevel } from '@prisma/client';

const phases = ['validate', 'import'] as const;

export class RunGrammarPipelineDto {
  @ApiProperty({ enum: phases })
  @IsIn(phases)
  phase!: (typeof phases)[number];

  @ApiProperty({ enum: JLPTLevel })
  @IsEnum(JLPTLevel)
  level!: JLPTLevel;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class RollbackGrammarPipelineDto {
  @ApiProperty()
  @Matches(/^c[a-z0-9]{24}$/, {
    message: 'rollbackId must be a valid rollback ID',
  })
  rollbackId!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
