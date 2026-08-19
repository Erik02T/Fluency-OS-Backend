import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../../common/common.module';
import { PrismaService } from '../auth/repositories/prisma.service';
import { ReviewController } from './review.controller';
import {
  ReviewService,
  SRSService,
  StreakService,
  DailyGoalService,
  ReviewEventsService,
} from './services';
import {
  ReviewSessionRepository,
  ReviewAnswerRepository,
} from './repositories';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [ReviewController],
  providers: [
    PrismaService,
    ReviewSessionRepository,
    ReviewAnswerRepository,
    SRSService,
    StreakService,
    DailyGoalService,
    ReviewEventsService,
    ReviewService,
  ],
  exports: [
    ReviewService,
    SRSService,
    StreakService,
    DailyGoalService,
    ReviewEventsService,
    ReviewSessionRepository,
    ReviewAnswerRepository,
  ],
})
export class ReviewModule {}
