import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../auth/repositories/prisma.service';

@Injectable()
export class UserKanjiProgressRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Buscar progresso de um kanji para um usuário
   * @param userId ID do usuário
   * @param kanjiId ID do kanji
   * @returns Progresso ou null
   */
  async findByUserAndKanji(userId: string, kanjiId: string): Promise<any> {
    return this.prisma.userKanjiProgress.findUnique({
      where: {
        userId_kanjiId: { userId, kanjiId },
      },
    });
  }

  /**
   * Buscar progresso de múltiplos kanjis para um usuário
   * @param userId ID do usuário
   * @param kanjiIds Array de IDs de kanji
   * @returns Map de kanjiId -> progress
   */
  async findByUserAndKanjis(userId: string, kanjiIds: string[]): Promise<Map<string, any>> {
    const progresses = await this.prisma.userKanjiProgress.findMany({
      where: {
        userId,
        kanjiId: { in: kanjiIds },
      },
    });

    const map = new Map();
    progresses.forEach(p => map.set(p.kanjiId, p));
    return map;
  }

  /**
   * Contar kanjis dominados por usuário
   * @param userId ID do usuário
   * @returns Contagem de kanjis mastered
   */
  async countMastered(userId: string): Promise<number> {
    return this.prisma.userKanjiProgress.count({
      where: {
        userId,
        isMastered: true,
      },
    });
  }

  /**
   * Criar entrada de progresso
   * @param userId ID do usuário
   * @param kanjiId ID do kanji
   * @returns Novo progresso
   */
  async create(userId: string, kanjiId: string): Promise<any> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.userKanjiProgress.create({
      data: {
        userId,
        kanjiId,
        srsLevel: 0,
        nextReviewAt: tomorrow,
      },
    });
  }
}
