import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { UserKanjiProgressEntity } from '../types/kanji.types';

@Injectable()
export class UserKanjiProgressRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Buscar progresso de um kanji para um usuário
   * @param userId ID do usuário
   * @param kanjiId ID do kanji
   * @returns Progresso ou null
   */
  async findByUserAndKanji(
    userId: string,
    kanjiId: string,
  ): Promise<UserKanjiProgressEntity | null> {
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
  async findByUserAndKanjis(
    userId: string,
    kanjiIds: string[],
  ): Promise<Map<string, UserKanjiProgressEntity>> {
    const progresses = await this.prisma.userKanjiProgress.findMany({
      where: {
        userId,
        kanjiId: { in: kanjiIds },
      },
    });

    const map = new Map<string, UserKanjiProgressEntity>();
    progresses.forEach((progress) => map.set(progress.kanjiId, progress));
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
  async create(
    userId: string,
    kanjiId: string,
  ): Promise<UserKanjiProgressEntity> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.userKanjiProgress.create({
      data: {
        userId,
        kanjiId,
        srsLevel: 1,
        nextReviewAt: tomorrow,
      },
    });
  }

  /**
   * Atualizar entrada de progresso
   * @param userId ID do usuário
   * @param kanjiId ID do kanji
   * @param data Dados para atualizar
   * @returns Progresso atualizado
   */
  async update(
    userId: string,
    kanjiId: string,
    data: import('@prisma/client').Prisma.UserKanjiProgressUpdateInput,
  ): Promise<UserKanjiProgressEntity> {
    return this.prisma.userKanjiProgress.update({
      where: {
        userId_kanjiId: { userId, kanjiId },
      },
      data,
    });
  }

  /**
   * Criar ou ignorar se já existir (upsert idempotente)
   * @param userId ID do usuário
   * @param kanjiId ID do kanji
   * @returns Progresso existente ou recém-criado
   */
  async upsert(
    userId: string,
    kanjiId: string,
  ): Promise<UserKanjiProgressEntity> {
    const existing = await this.findByUserAndKanji(userId, kanjiId);
    if (existing) {
      return existing;
    }
    return this.create(userId, kanjiId);
  }
}
