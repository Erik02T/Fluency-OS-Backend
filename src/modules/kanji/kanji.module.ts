import { Module } from '@nestjs/common';
import { KanjiController } from './kanji.controller';
import { KanjiService } from './kanji.service';
import { KanjiRepository, UserKanjiProgressRepository } from './repositories';
import { PrismaService } from '../auth/repositories/prisma.service';

@Module({
  controllers: [KanjiController],
  providers: [
    KanjiService,
    KanjiRepository,
    UserKanjiProgressRepository,
    PrismaService,
  ],
  exports: [
    KanjiService,
    KanjiRepository,
    UserKanjiProgressRepository,
  ],
})
export class KanjiModule {}
