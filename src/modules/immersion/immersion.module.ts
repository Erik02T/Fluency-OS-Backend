import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImmersionController } from './immersion.controller';
import { ImmersionService } from './immersion.service';
import { ImmersionRepository } from './repositories';

@Module({
  imports: [AuthModule],
  controllers: [ImmersionController],
  providers: [ImmersionService, ImmersionRepository],
  exports: [ImmersionService],
})
export class ImmersionModule {}
