import { Injectable } from '@nestjs/common';
import { ImmersionLog, ImmersionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import type { ImmersionSortField, ImmersionSortOrder } from '../dto';

export interface ImmersionLogFilters {
  type?: ImmersionType;
  startDate?: Date;
  endDate?: Date;
  sort: ImmersionSortField;
  order: ImmersionSortOrder;
  skip: number;
  take: number;
}

@Injectable()
export class ImmersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  private buildWhere(
    userId: string,
    filters: Pick<ImmersionLogFilters, 'type' | 'startDate' | 'endDate'>,
  ): Prisma.ImmersionLogWhereInput {
    const where: Prisma.ImmersionLogWhereInput = { userId };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.loggedAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }

    return where;
  }

  findLogs(
    userId: string,
    filters: ImmersionLogFilters,
  ): Promise<ImmersionLog[]> {
    return this.prisma.immersionLog.findMany({
      where: this.buildWhere(userId, filters),
      orderBy: { [filters.sort]: filters.order },
      skip: filters.skip,
      take: filters.take,
    });
  }

  countLogs(
    userId: string,
    filters: Pick<ImmersionLogFilters, 'type' | 'startDate' | 'endDate'>,
  ): Promise<number> {
    return this.prisma.immersionLog.count({
      where: this.buildWhere(userId, filters),
    });
  }

  findById(userId: string, id: string): Promise<ImmersionLog | null> {
    return this.prisma.immersionLog.findFirst({ where: { id, userId } });
  }

  createLog(
    userId: string,
    data: {
      type: ImmersionType;
      title: string;
      durationMinutes: number;
      episode?: string | null;
      comprehension?: number | null;
      notes?: string | null;
      isActive: boolean;
      loggedAt: Date;
    },
  ): Promise<ImmersionLog> {
    return this.prisma.immersionLog.create({
      data: { userId, ...data },
    });
  }

  updateLog(
    userId: string,
    id: string,
    data: Prisma.ImmersionLogUpdateInput,
  ): Promise<ImmersionLog | null> {
    return this.prisma.immersionLog
      .updateMany({ where: { id, userId }, data })
      .then((result) => {
        if (result.count === 0) {
          return null;
        }
        return this.prisma.immersionLog.findFirst({
          where: { id, userId },
        });
      });
  }

  deleteLog(userId: string, id: string): Promise<boolean> {
    return this.prisma.immersionLog
      .deleteMany({ where: { id, userId } })
      .then((result) => result.count > 0);
  }
}
