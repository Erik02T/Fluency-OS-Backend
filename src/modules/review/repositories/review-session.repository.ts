import { Injectable } from '@nestjs/common';
import { Prisma, ReviewSession, ReviewSessionStatus } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';

@Injectable()
export class ReviewSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    data: Prisma.ReviewSessionUncheckedCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewSession> {
    const db = tx ?? this.prisma;
    return db.reviewSession.create({
      data,
    });
  }

  async findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewSession | null> {
    const db = tx ?? this.prisma;
    return db.reviewSession.findUnique({
      where: { id },
    });
  }

  async findByIdWithAnswers(id: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    return db.reviewSession.findUnique({
      where: { id },
      include: {
        answers: {
          orderBy: { answeredAt: 'asc' },
        },
      },
    });
  }

  async findByIdAndUser(
    id: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewSession | null> {
    const db = tx ?? this.prisma;
    return db.reviewSession.findFirst({
      where: { id, userId },
    });
  }

  async findByIdAndUserWithAnswers(
    id: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    return db.reviewSession.findFirst({
      where: { id, userId },
      include: {
        answers: {
          orderBy: { answeredAt: 'asc' },
        },
      },
    });
  }

  async updateSession(
    id: string,
    data: Prisma.ReviewSessionUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ReviewSession> {
    const db = tx ?? this.prisma;
    return db.reviewSession.update({
      where: { id },
      data,
    });
  }

  async findUserHistory(
    userId: string,
    options: {
      skip?: number;
      take?: number;
      status?: ReviewSessionStatus;
    },
  ) {
    const { skip = 0, take = 20, status } = options;
    return this.prisma.reviewSession.findMany({
      where: {
        userId,
        status: status ? status : undefined,
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take,
    });
  }

  async countUserHistory(
    userId: string,
    status?: ReviewSessionStatus,
  ): Promise<number> {
    return this.prisma.reviewSession.count({
      where: {
        userId,
        status: status ? status : undefined,
      },
    });
  }
}
