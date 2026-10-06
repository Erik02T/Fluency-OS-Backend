import { BadRequestException, Injectable } from '@nestjs/common';
import { ReviewQuality } from '@prisma/client';
import {
  CalculateNextReviewResult,
  SRSProgressState,
} from '../types/review.types';

@Injectable()
export class SRSService {
  /**
   * Mapeia número (0, 1, 2, 3) para Enum ReviewQuality do Prisma
   */
  mapQualityToEnum(quality: number): ReviewQuality {
    switch (quality) {
      case 0:
        return ReviewQuality.BLACKOUT;
      case 1:
        return ReviewQuality.WRONG;
      case 2:
        return ReviewQuality.CORRECT_HARD;
      case 3:
        return ReviewQuality.CORRECT_EASY;
      default:
        throw new BadRequestException(
          `Invalid answer quality ${quality}. Expected 0, 1, 2, or 3.`,
        );
    }
  }

  /**
   * Mapeia Enum ReviewQuality para número 0..3
   */
  mapEnumToQuality(quality: ReviewQuality): number {
    switch (quality) {
      case ReviewQuality.BLACKOUT:
        return 0;
      case ReviewQuality.WRONG:
        return 1;
      case ReviewQuality.CORRECT_HARD:
        return 2;
      case ReviewQuality.CORRECT_EASY:
        return 3;
      default:
        return 0;
    }
  }

  /**
   * Calcula o próximo estado SRS segundo a especificação do Fluency OS (SM-2 adaptado)
   *
   * @param current Estado atual do item
   * @param quality Nota dada pelo usuário (0, 1, 2, ou 3)
   * @param now Data base para cálculo da próxima revisão (default: new Date())
   */
  calculateNextReview(
    current: SRSProgressState,
    quality: number,
    now: Date = new Date(),
  ): CalculateNextReviewResult {
    const previousSrsLevel = Math.max(1, Math.min(5, current.srsLevel || 1));
    const previousEaseFactor = Math.max(1.3, current.easeFactor || 2.5);
    const previousInterval = Math.max(1, current.intervalDays || 1);

    let newSrsLevel = previousSrsLevel;
    let newEaseFactor = previousEaseFactor;
    let newInterval = previousInterval;

    switch (quality) {
      case 0: // Falhou / Blackout
        newSrsLevel = Math.max(1, previousSrsLevel - 1);
        newInterval = 1;
        newEaseFactor = previousEaseFactor;
        break;

      case 1: // Difícil / Wrong
        newSrsLevel = previousSrsLevel; // mantém
        newInterval = Math.max(1, Math.round(previousInterval * 1.2));
        newEaseFactor = Math.max(
          1.3,
          Number((previousEaseFactor - 0.15).toFixed(2)),
        );
        break;

      case 2: // OK / Correto Difícil
        newSrsLevel = Math.min(5, previousSrsLevel + 1);
        newInterval = Math.max(
          1,
          Math.round(previousInterval * previousEaseFactor),
        );
        newEaseFactor = previousEaseFactor;
        break;

      case 3: // Fácil / Correto Fácil
        newSrsLevel = Math.min(5, previousSrsLevel + 1);
        newInterval = Math.max(
          1,
          Math.round(previousInterval * previousEaseFactor * 1.3),
        );
        newEaseFactor = Number((previousEaseFactor + 0.1).toFixed(2));
        break;

      default:
        throw new BadRequestException(
          `Invalid answer quality ${quality}. Expected 0, 1, 2, or 3.`,
        );
    }

    const isMastered = newSrsLevel >= 5;
    const nextReviewAt = new Date(
      now.getTime() + newInterval * 24 * 60 * 60 * 1000,
    );

    return {
      previousSrsLevel,
      newSrsLevel,
      previousEaseFactor,
      newEaseFactor,
      previousInterval,
      newInterval,
      nextReviewAt,
      isMastered,
      quality: this.mapQualityToEnum(quality),
    };
  }
}
