import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtMiddleware } from '../auth/middleware/optional-jwt.middleware';
import { PrismaService } from '../auth/repositories/prisma.service';
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
    PrismaService,
    OptionalJwtMiddleware,
  ],
  exports: [GrammarService, GrammarRepository, UserGrammarProgressRepository],
})
export class GrammarModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OptionalJwtMiddleware).forRoutes(GrammarController);
  }
}
