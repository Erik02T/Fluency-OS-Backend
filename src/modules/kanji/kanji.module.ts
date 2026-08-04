import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { KanjiController } from './kanji.controller';
import { AdminKanjiController } from './admin-kanji.controller';
import { KanjiService } from './kanji.service';
import { KanjiRepository, UserKanjiProgressRepository } from './repositories';
import { PrismaService } from '../auth/repositories/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtMiddleware } from '../auth/middleware/optional-jwt.middleware';

@Module({
  imports: [AuthModule],
  controllers: [KanjiController, AdminKanjiController],
  providers: [
    KanjiService,
    KanjiRepository,
    UserKanjiProgressRepository,
    PrismaService,
    OptionalJwtMiddleware,
  ],
  exports: [KanjiService, KanjiRepository, UserKanjiProgressRepository],
})
export class KanjiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OptionalJwtMiddleware).forRoutes(KanjiController);
  }
}
