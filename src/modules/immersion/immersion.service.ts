import { Injectable } from '@nestjs/common';
import { ImmersionLog } from '@prisma/client';
import { ImmersionRepository } from './repositories';
import {
  CreateImmersionLogDto,
  ImmersionLogFiltersDto,
  ImmersionLogResponseDto,
  PaginatedImmersionLogResponseDto,
} from './dto';

@Injectable()
export class ImmersionService {
  constructor(private readonly immersionRepository: ImmersionRepository) {}

  async create(
    userId: string,
    dto: CreateImmersionLogDto,
  ): Promise<ImmersionLogResponseDto> {
    const log = await this.immersionRepository.create({
      userId,
      type: dto.type,
      title: dto.title,
      durationMinutes: dto.durationMinutes,
      episode: dto.episode,
      comprehension: dto.comprehension,
      notes: dto.notes,
      isActive: dto.isActive,
      loggedAt: dto.loggedAt,
    });

    return this.toResponseDto(log);
  }

  async findAll(
    userId: string,
    filters: ImmersionLogFiltersDto,
  ): Promise<PaginatedImmersionLogResponseDto> {
    const [items, total] = await Promise.all([
      this.immersionRepository.findAllByUser(userId, filters),
      this.immersionRepository.countByUser(userId, filters),
    ]);

    const data = items.map((item) => this.toResponseDto(item));

    return {
      data,
      pagination: {
        page: filters.page,
        perPage: filters.perPage,
        total,
        pages: Math.ceil(total / filters.perPage),
      },
    };
  }

  private toResponseDto(log: ImmersionLog): ImmersionLogResponseDto {
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
      loggedAt: log.loggedAt,
      createdAt: log.createdAt,
    };
  }
}
