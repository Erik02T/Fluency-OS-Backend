import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../auth/repositories/prisma.service';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';

@Module({
  imports: [AuthModule],
  controllers: [PlannerController],
  providers: [PlannerService, PrismaService],
  exports: [PlannerService],
})
export class PlannerModule {}
