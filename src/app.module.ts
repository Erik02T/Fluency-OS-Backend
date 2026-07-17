import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { KanjiModule } from './modules/kanji/kanji.module';
import { CommonModule } from './common/common.module';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { validateEnv } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    CommonModule,
    AuthModule,
    KanjiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar rate limiting a todas as rotas exceto health check
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
