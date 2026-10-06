import { Injectable } from '@nestjs/common';
import { Prisma, ReviewAnswer } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';

@Injectable()
export class ReviewAnswerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAnswer(
    data: Prisma.ReviewAnswerUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewAnswer> {
    const db = tx ?? this.prisma;
    return db.reviewAnswer.create({
      data,
    });
  }

  async findBySessionId(
    sessionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewAnswer[]> {
    const db = tx ?? this.prisma;
    return db.reviewAnswer.findMany({
      where: { sessionId },
      orderBy: { answeredAt: 'asc' },
    });
  }

  async findBySessionAndItem(
    sessionId: string,
    itemId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewAnswer | null> {
    const db = tx ?? this.prisma;
    return db.reviewAnswer.findFirst({
      where: { sessionId, itemId },
    });
  }

  async countBySessionId(
    sessionId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx ?? this.prisma;
    return db.reviewAnswer.count({
      where: { sessionId },
    });
  }
}
