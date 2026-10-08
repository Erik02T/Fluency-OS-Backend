import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtMiddleware } from '../auth/middleware/optional-jwt.middleware';
import { GrammarController } from './grammar.controller';
import { GrammarService } from './grammar.service';
import {
  GrammarRepository,
  UserGrammarProgressRepository,
} from './repositories';

@Module({
  imports: [AuthModule],
  controllers: [GrammarController],
  providers: [
    GrammarService,
    GrammarRepository,
    UserGrammarProgressRepository,
    OptionalJwtMiddleware,
  ],
  exports: [GrammarService, GrammarRepository, UserGrammarProgressRepository],
})
export class GrammarModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OptionalJwtMiddleware).forRoutes(GrammarController);
  }
}
