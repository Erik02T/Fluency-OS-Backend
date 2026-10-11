import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { KanjiModule } from './modules/kanji/kanji.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { GrammarModule } from './modules/grammar/grammar.module';
import { ReviewModule } from './modules/review/review.module';
import { PlannerModule } from './modules/planner/planner.module';
import { CommonModule } from './common/common.module';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { RequestObservabilityMiddleware } from './common/middleware/request-observability.middleware';
import { validateEnv } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    KanjiModule,
    VocabularyModule,
    GrammarModule,
    ReviewModule,
    PlannerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar rate limiting a todas as rotas exceto health check
    consumer
      .apply(RequestObservabilityMiddleware, RateLimitMiddleware)
      .forRoutes('*');
  }
}
