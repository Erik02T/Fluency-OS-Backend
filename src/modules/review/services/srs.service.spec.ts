import { SRSService } from './srs.service';
import { ReviewQuality } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('SRSService', () => {
  let srsService: SRSService;
  const mockNow = new Date('2026-08-13T12:00:00.000Z');

  beforeEach(() => {
    srsService = new SRSService();
  });

  describe('mapQualityToEnum & mapEnumToQuality', () => {
    it('should map qualities correctly', () => {
      expect(srsService.mapQualityToEnum(0)).toBe(ReviewQuality.BLACKOUT);
      expect(srsService.mapQualityToEnum(1)).toBe(ReviewQuality.WRONG);
      expect(srsService.mapQualityToEnum(2)).toBe(ReviewQuality.CORRECT_HARD);
      expect(srsService.mapQualityToEnum(3)).toBe(ReviewQuality.CORRECT_EASY);

      expect(srsService.mapEnumToQuality(ReviewQuality.BLACKOUT)).toBe(0);
      expect(srsService.mapEnumToQuality(ReviewQuality.WRONG)).toBe(1);
      expect(srsService.mapEnumToQuality(ReviewQuality.CORRECT_HARD)).toBe(2);
      expect(srsService.mapEnumToQuality(ReviewQuality.CORRECT_EASY)).toBe(3);
    });

    it('should throw BadRequestException for invalid quality', () => {
      expect(() => srsService.mapQualityToEnum(4)).toThrow(BadRequestException);
      expect(() => srsService.mapQualityToEnum(-1)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('calculateNextReview - Quality 0 (Blackout / Fail)', () => {
    it('should decrease level by 1, set interval to 1 day and preserve ease factor', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 3, easeFactor: 2.5, intervalDays: 6 },
        0,
        mockNow,
      );

      expect(result.previousSrsLevel).toBe(3);
      expect(result.newSrsLevel).toBe(2);
      expect(result.newInterval).toBe(1);
      expect(result.newEaseFactor).toBe(2.5);
      expect(result.isMastered).toBe(false);
      expect(result.quality).toBe(ReviewQuality.BLACKOUT);

      const expectedNext = new Date(
        mockNow.getTime() + 1 * 24 * 60 * 60 * 1000,
      );
      expect(result.nextReviewAt.getTime()).toBe(expectedNext.getTime());
    });

    it('should not decrease srsLevel below 1', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 1, easeFactor: 2.5, intervalDays: 1 },
        0,
        mockNow,
      );

      expect(result.newSrsLevel).toBe(1);
      expect(result.newInterval).toBe(1);
    });
  });

  describe('calculateNextReview - Quality 1 (Hard / Wrong)', () => {
    it('should maintain level, multiply interval by 1.2 and decrease ease factor by 0.15', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 2, easeFactor: 2.5, intervalDays: 10 },
        1,
        mockNow,
      );

      expect(result.previousSrsLevel).toBe(2);
      expect(result.newSrsLevel).toBe(2);
      expect(result.newInterval).toBe(12); // Math.round(10 * 1.2)
      expect(result.newEaseFactor).toBe(2.35); // 2.5 - 0.15
      expect(result.isMastered).toBe(false);
      expect(result.quality).toBe(ReviewQuality.WRONG);
    });

    it('should not let ease factor drop below 1.3', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 2, easeFactor: 1.35, intervalDays: 5 },
        1,
        mockNow,
      );

      expect(result.newEaseFactor).toBe(1.3);
    });
  });

  describe('calculateNextReview - Quality 2 (OK / Correct Hard)', () => {
    it('should increment level by 1, multiply interval by ease factor, and keep ease factor', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 2, easeFactor: 2.5, intervalDays: 6 },
        2,
        mockNow,
      );

      expect(result.previousSrsLevel).toBe(2);
      expect(result.newSrsLevel).toBe(3);
      expect(result.newInterval).toBe(15); // Math.round(6 * 2.5)
      expect(result.newEaseFactor).toBe(2.5);
      expect(result.isMastered).toBe(false);
      expect(result.quality).toBe(ReviewQuality.CORRECT_HARD);
    });
  });

  describe('calculateNextReview - Quality 3 (Easy / Correct Easy)', () => {
    it('should increment level by 1, multiply interval by ease factor * 1.3, and increase ease factor by 0.1', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 3, easeFactor: 2.5, intervalDays: 10 },
        3,
        mockNow,
      );

      expect(result.previousSrsLevel).toBe(3);
      expect(result.newSrsLevel).toBe(4);
      expect(result.newInterval).toBe(33); // Math.round(10 * 2.5 * 1.3) = Math.round(32.5) = 33 (or 32/33)
      expect(result.newEaseFactor).toBe(2.6); // 2.5 + 0.1
      expect(result.isMastered).toBe(false);
      expect(result.quality).toBe(ReviewQuality.CORRECT_EASY);
    });
  });

  describe('Mastery thresholds and max level cap', () => {
    it('should mark item as mastered when srsLevel reaches 5', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 4, easeFactor: 2.5, intervalDays: 20 },
        2,
        mockNow,
      );

      expect(result.newSrsLevel).toBe(5);
      expect(result.isMastered).toBe(true);
    });

    it('should not increase srsLevel beyond 5', () => {
      const result = srsService.calculateNextReview(
        { srsLevel: 5, easeFactor: 2.5, intervalDays: 50 },
        3,
        mockNow,
      );

      expect(result.newSrsLevel).toBe(5);
      expect(result.isMastered).toBe(true);
    });
  });
});
