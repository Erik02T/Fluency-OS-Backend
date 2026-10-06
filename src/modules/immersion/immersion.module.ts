import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../auth/repositories/prisma.service';
import { ImmersionController } from './immersion.controller';
import { ImmersionService } from './immersion.service';
import { ImmersionRepository } from './repositories';

@Module({
  imports: [AuthModule],
  controllers: [ImmersionController],
  providers: [ImmersionService, ImmersionRepository, PrismaService],
  exports: [ImmersionService, ImmersionRepository],
})
export class ImmersionModule {}
