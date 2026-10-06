import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { UserGrammarProgressEntity } from '../types/grammar.types';

@Injectable()
export class UserGrammarProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndGrammarPoint(
    userId: string,
    grammarPointId: string,
  ): Promise<UserGrammarProgressEntity | null> {
    return this.prisma.userGrammarProgress.findUnique({
      where: {
        userId_grammarPointId: { userId, grammarPointId },
      },
    });
  }

  async findByUserAndGrammarPoints(
    userId: string,
    grammarPointIds: string[],
  ): Promise<Map<string, UserGrammarProgressEntity>> {
    const progresses = await this.prisma.userGrammarProgress.findMany({
      where: {
        userId,
        grammarPointId: { in: grammarPointIds },
      },
    });

    const map = new Map<string, UserGrammarProgressEntity>();
    progresses.forEach((progress) =>
      map.set(progress.grammarPointId, progress),
    );
    return map;
  }

  async create(
    userId: string,
    grammarPointId: string,
  ): Promise<UserGrammarProgressEntity> {
    return this.prisma.userGrammarProgress.create({
      data: {
        userId,
        grammarPointId,
        isStudied: true,
        studiedAt: new Date(),
      },
    });
  }

  async update(
    userId: string,
    grammarPointId: string,
    data: Prisma.UserGrammarProgressUpdateInput,
  ): Promise<UserGrammarProgressEntity> {
    return this.prisma.userGrammarProgress.update({
      where: {
        userId_grammarPointId: { userId, grammarPointId },
      },
      data,
    });
  }
}
