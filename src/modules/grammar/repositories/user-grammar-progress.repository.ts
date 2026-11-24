import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { UserGrammarProgressEntity } from '../types/grammar.types';

@Injectable()
export class UserGrammarProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  withPublishedPoint<T>(
    grammarPointId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T | null> {
    return this.prisma.$transaction(async (tx) => {
      const [point] = await tx.$queryRaw<{ id: string }[]>`SELECT "id"
        FROM "grammar_points" WHERE "id" = ${grammarPointId}
        AND "reviewStatus" = 'PUBLISHED' FOR UPDATE`;
      return point ? work(tx) : null;
    });
  }

  async findByUserAndGrammarPoint(
    userId: string,
    grammarPointId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<UserGrammarProgressEntity | null> {
    return db.userGrammarProgress.findUnique({
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
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<UserGrammarProgressEntity> {
    return db.userGrammarProgress.create({
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
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<UserGrammarProgressEntity> {
    return db.userGrammarProgress.update({
      where: {
        userId_grammarPointId: { userId, grammarPointId },
      },
      data,
    });
  }
}
