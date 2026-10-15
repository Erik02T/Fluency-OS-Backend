import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImmersionLog } from '@prisma/client';
import { logStructured } from '../../common/logging/structured-log';
import {
  CreateImmersionLogDto,
  ImmersionLogQueryDto,
  ImmersionLogResponseDto,
  PaginatedImmersionLogResponseDto,
  UpdateImmersionLogDto,
} from './dto';
import { ImmersionRepository } from './repositories';

@Injectable()
export class ImmersionService {
  constructor(private readonly repository: ImmersionRepository) {}

  async getLogs(
    userId: string,
    query: ImmersionLogQueryDto,
  ): Promise<PaginatedImmersionLogResponseDto> {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const sort = query.sort ?? 'loggedAt';
    const order = query.order ?? 'desc';

    const startDate = query.startDate
      ? this.parseDate(query.startDate, 'startDate')
      : undefined;
    const endDate = query.endDate
      ? this.parseDate(query.endDate, 'endDate')
      : undefined;

    const filters = {
      type: query.type,
      startDate,
      endDate,
      sort,
      order,
      skip: (page - 1) * perPage,
      take: perPage,
    };

    const [logs, total] = await Promise.all([
      this.repository.findLogs(userId, filters),
      this.repository.countLogs(userId, {
        type: query.type,
        startDate,
        endDate,
      }),
    ]);

    return {
      data: logs.map((log) => this.toResponse(log)),
      pagination: {
        page,
        perPage,
        total,
        pages: Math.ceil(total / perPage),
      },
    };
  }

  async createLog(
    userId: string,
    dto: CreateImmersionLogDto,
  ): Promise<ImmersionLogResponseDto> {
    const loggedAt = dto.loggedAt
      ? this.parseDate(dto.loggedAt, 'loggedAt')
      : new Date();

    const log = await this.repository.createLog(userId, {
      type: dto.type,
      title: dto.title.trim(),
      durationMinutes: dto.durationMinutes,
      episode: dto.episode?.trim() || null,
      comprehension: dto.comprehension ?? null,
      notes: dto.notes?.trim() || null,
      isActive: dto.isActive ?? true,
      loggedAt,
    });

    logStructured('info', 'ImmersionService', 'immersion.log.create.success', {
      userId,
      logId: log.id,
      type: log.type,
      durationMinutes: log.durationMinutes,
    });

    return this.toResponse(log);
  }

  async getLog(userId: string, id: string): Promise<ImmersionLogResponseDto> {
    const log = await this.repository.findById(userId, id);
    if (!log) {
      throw new NotFoundException(`Immersion log with id ${id} not found`);
    }
    return this.toResponse(log);
  }

  async updateLog(
    userId: string,
    id: string,
    dto: UpdateImmersionLogDto,
  ): Promise<ImmersionLogResponseDto> {
    const existing = await this.repository.findById(userId, id);
    if (!existing) {
      throw new NotFoundException(`Immersion log with id ${id} not found`);
    }

    const updated = await this.repository.updateLog(userId, id, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.episode !== undefined
        ? { episode: dto.episode.trim() || null }
        : {}),
      ...(dto.durationMinutes !== undefined
        ? { durationMinutes: dto.durationMinutes }
        : {}),
      ...(dto.comprehension !== undefined
        ? { comprehension: dto.comprehension }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });

    if (!updated) {
      throw new NotFoundException(`Immersion log with id ${id} not found`);
    }

    return this.toResponse(updated);
  }

  async deleteLog(
    userId: string,
    id: string,
  ): Promise<{ success: boolean; id: string }> {
    const deleted = await this.repository.deleteLog(userId, id);
    if (!deleted) {
      throw new NotFoundException(`Immersion log with id ${id} not found`);
    }
    return { success: true, id };
  }

  private parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field}: '${value}'`);
    }
    return date;
  }

  private toResponse(log: ImmersionLog): ImmersionLogResponseDto {
    return {
      id: log.id,
      userId: log.userId,
      type: log.type,
      title: log.title,
      episode: log.episode,
      durationMinutes: log.durationMinutes,
      comprehension: log.comprehension,
      isActive: log.isActive,
      notes: log.notes,
      loggedAt: log.loggedAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
    };
  }
}
