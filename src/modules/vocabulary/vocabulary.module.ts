import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtMiddleware } from '../auth/middleware/optional-jwt.middleware';

import { AdminVocabularyController } from './admin-vocabulary.controller';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyService } from './vocabulary.service';
import {
  UserVocabularyProgressRepository,
  VocabularyRepository,
} from './repositories';

@Module({
  imports: [AuthModule],
  controllers: [VocabularyController, AdminVocabularyController],
  providers: [
    VocabularyService,
    VocabularyRepository,
    UserVocabularyProgressRepository,

    OptionalJwtMiddleware,
  ],
  exports: [
    VocabularyService,
    VocabularyRepository,
    UserVocabularyProgressRepository,
  ],
})
export class VocabularyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OptionalJwtMiddleware).forRoutes(VocabularyController);
  }
}
