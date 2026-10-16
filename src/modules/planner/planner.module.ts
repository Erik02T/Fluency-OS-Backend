import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';
import { PlannerRepository } from './repositories';

@Module({
  imports: [AuthModule],
  controllers: [PlannerController],
  providers: [PlannerService, PlannerRepository],
  exports: [PlannerService],
})
export class PlannerModule {}
