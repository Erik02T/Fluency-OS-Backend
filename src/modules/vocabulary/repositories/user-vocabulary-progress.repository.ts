import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../auth/repositories/prisma.service';
import { UserVocabularyProgressEntity } from '../types/vocabulary.types';

@Injectable()
export class UserVocabularyProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndVocabulary(
    userId: string,
    vocabularyId: string,
  ): Promise<UserVocabularyProgressEntity | null> {
    return this.prisma.userVocabularyProgress.findUnique({
      where: {
        userId_vocabularyId: { userId, vocabularyId },
      },
    });
  }

  async findByUserAndVocabularies(
    userId: string,
    vocabularyIds: string[],
  ): Promise<Map<string, UserVocabularyProgressEntity>> {
    const progresses = await this.prisma.userVocabularyProgress.findMany({
      where: {
        userId,
        vocabularyId: { in: vocabularyIds },
      },
    });

    const map = new Map<string, UserVocabularyProgressEntity>();
    progresses.forEach((progress) => map.set(progress.vocabularyId, progress));
    return map;
  }

  async create(
    userId: string,
    vocabularyId: string,
  ): Promise<UserVocabularyProgressEntity> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.userVocabularyProgress.create({
      data: {
        userId,
        vocabularyId,
        srsLevel: 1,
        nextReviewAt: tomorrow,
      },
    });
  }

  async update(
    userId: string,
    vocabularyId: string,
    data: Prisma.UserVocabularyProgressUpdateInput,
  ): Promise<UserVocabularyProgressEntity> {
    return this.prisma.userVocabularyProgress.update({
      where: {
        userId_vocabularyId: { userId, vocabularyId },
      },
      data,
    });
  }
}
