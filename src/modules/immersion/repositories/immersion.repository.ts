import { Injectable } from '@nestjs/common';
import { Prisma, ImmersionLog } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { ImmersionLogFiltersDto } from '../dto';
import { ImmersionLogCreateInput } from '../types/immersion.types';

type ImmersionSortField = 'loggedAt' | 'durationMinutes' | 'createdAt';
type SortOrder = 'asc' | 'desc';

@Injectable()
export class ImmersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: ImmersionLogCreateInput): Promise<ImmersionLog> {
    const createData: Prisma.ImmersionLogCreateInput = {
      user: { connect: { id: data.userId } },
      type: data.type,
      title: data.title,
      durationMinutes: data.durationMinutes,
      episode: data.episode ?? undefined,
      comprehension: data.comprehension ?? undefined,
      notes: data.notes ?? undefined,
      isActive: data.isActive ?? true,
      loggedAt: data.loggedAt ?? new Date(),
    };

    return this.prisma.immersionLog.create({ data: createData });
  }

  findAllByUser(
    userId: string,
    filters: ImmersionLogFiltersDto,
  ): Promise<ImmersionLog[]> {
    const skip = (filters.page - 1) * filters.perPage;

    return this.prisma.immersionLog.findMany({
      where: this.buildWhere(userId, filters),
      orderBy: this.buildOrderBy(filters.sort, filters.order),
      skip,
      take: filters.perPage,
    });
  }

  countByUser(
    userId: string,
    filters: ImmersionLogFiltersDto,
  ): Promise<number> {
    return this.prisma.immersionLog.count({
      where: this.buildWhere(userId, filters),
    });
  }

  private buildWhere(
    userId: string,
    filters: ImmersionLogFiltersDto,
  ): Prisma.ImmersionLogWhereInput {
    const where: Prisma.ImmersionLogWhereInput = { userId };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      where.loggedAt = {};
      if (filters.startDate) {
        where.loggedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.loggedAt.lte = filters.endDate;
      }
    }

    return where;
  }

  private buildOrderBy(
    sort: ImmersionSortField | undefined,
    order: SortOrder | undefined,
  ): Prisma.ImmersionLogOrderByWithRelationInput[] {
    const sortField = sort || 'loggedAt';
    const sortOrder = order || 'desc';

    if (sortField === 'durationMinutes') {
      return [{ durationMinutes: sortOrder }];
    }

    if (sortField === 'createdAt') {
      return [{ createdAt: sortOrder }];
    }

    return [{ loggedAt: sortOrder }];
  }
}
