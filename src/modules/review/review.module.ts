import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { SrsService } from './srs.service';
import { ReviewRepository } from './repositories';

@Module({
  imports: [AuthModule],
  controllers: [ReviewController],
  providers: [ReviewService, SrsService, ReviewRepository],
  exports: [ReviewService, SrsService],
})
export class ReviewModule {}
