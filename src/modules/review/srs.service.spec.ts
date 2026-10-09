import { SrsService } from './srs.service';

describe('SrsService (SM-2 adaptado)', () => {
  let service: SrsService;

  beforeEach(() => {
    service = new SrsService();
  });

  const now = new Date('2026-01-01T12:00:00.000Z');

  describe('quality 0 — Falhou (BLACKOUT)', () => {
    it('decrements srsLevel keeping minimum 1 and resets interval to 1 day', () => {
      const result = service.calculateNextReview(
        { srsLevel: 4, easeFactor: 2.5, intervalDays: 10 },
        0,
        now,
      );

      expect(result.newSrsLevel).toBe(3);
      expect(result.newIntervalDays).toBe(1);
      expect(result.newEaseFactor).toBe(2.5);
      expect(result.isMastered).toBe(false);
      expect(result.nextReviewAt.getTime()).toBe(
        now.getTime() + 24 * 60 * 60 * 1000,
      );
    });

    it('never goes below level 1', () => {
      const result = service.calculateNextReview(
        { srsLevel: 1, easeFactor: 2.5, intervalDays: 5 },
        0,
        now,
      );

      expect(result.newSrsLevel).toBe(1);
      expect(result.newIntervalDays).toBe(1);
    });

    it('unmasters when failing from level 5', () => {
      const result = service.calculateNextReview(
        { srsLevel: 5, easeFactor: 2.5, intervalDays: 30 },
        0,
        now,
      );

      expect(result.newSrsLevel).toBe(4);
      expect(result.isMastered).toBe(false);
    });
  });

  describe('quality 1 — Difícil (WRONG)', () => {
    it('keeps level, multiplies interval by 1.2 and reduces ease by 0.15', () => {
      const result = service.calculateNextReview(
        { srsLevel: 3, easeFactor: 2.5, intervalDays: 10 },
        1,
        now,
      );

      expect(result.newSrsLevel).toBe(3);
      expect(result.newIntervalDays).toBe(12); // ceil(10 × 1.2)
      expect(result.newEaseFactor).toBe(2.35);
    });

    it('respects minimum ease factor of 1.3', () => {
      const result = service.calculateNextReview(
        { srsLevel: 3, easeFactor: 1.3, intervalDays: 5 },
        1,
        now,
      );

      expect(result.newEaseFactor).toBe(1.3);
    });

    it('rounds ease factor to 2 decimals', () => {
      const result = service.calculateNextReview(
        { srsLevel: 3, easeFactor: 1.45, intervalDays: 5 },
        1,
        now,
      );

      expect(result.newEaseFactor).toBe(1.3); // max(1.3, 1.30)
    });
  });

  describe('quality 2 — OK (CORRECT_HARD)', () => {
    it('increments level (max 5) and multiplies interval by ease factor', () => {
      const result = service.calculateNextReview(
        { srsLevel: 3, easeFactor: 2.5, intervalDays: 4 },
        2,
        now,
      );

      expect(result.newSrsLevel).toBe(4);
      expect(result.newIntervalDays).toBe(10); // ceil(4 × 2.5)
      expect(result.newEaseFactor).toBe(2.5);
      expect(result.isMastered).toBe(false);
    });

    it('caps level at 5 and marks as mastered', () => {
      const result = service.calculateNextReview(
        { srsLevel: 5, easeFactor: 2.5, intervalDays: 20 },
        2,
        now,
      );

      expect(result.newSrsLevel).toBe(5);
      expect(result.isMastered).toBe(true);
    });

    it('promotes to mastered when reaching level 5', () => {
      const result = service.calculateNextReview(
        { srsLevel: 4, easeFactor: 2.5, intervalDays: 10 },
        2,
        now,
      );

      expect(result.newSrsLevel).toBe(5);
      expect(result.isMastered).toBe(true);
    });
  });

  describe('quality 3 — Fácil (CORRECT_EASY)', () => {
    it('increments level, multiplies interval by ease × 1.3 and raises ease', () => {
      const result = service.calculateNextReview(
        { srsLevel: 3, easeFactor: 2.5, intervalDays: 4 },
        3,
        now,
      );

      expect(result.newSrsLevel).toBe(4);
      expect(result.newIntervalDays).toBe(13); // ceil(4 × 2.5 × 1.3)
      expect(result.newEaseFactor).toBe(2.6);
    });
  });

  describe('limites (RN-SRS004)', () => {
    it('interval never goes below 1 day', () => {
      const result = service.calculateNextReview(
        { srsLevel: 2, easeFactor: 1.3, intervalDays: 0 },
        2,
        now,
      );

      expect(result.newIntervalDays).toBeGreaterThanOrEqual(1);
    });

    it('interval is capped at 365 days', () => {
      const result = service.calculateNextReview(
        { srsLevel: 5, easeFactor: 3, intervalDays: 300 },
        3,
        now,
      );

      expect(result.newIntervalDays).toBe(365);
      expect(result.newIntervalDays).toBeLessThanOrEqual(365);
    });

    it('nextReviewAt is now + intervalDays', () => {
      const result = service.calculateNextReview(
        { srsLevel: 2, easeFactor: 2.5, intervalDays: 1 },
        2,
        now,
      );

      const expected = new Date(now);
      expected.setDate(expected.getDate() + result.newIntervalDays);
      expect(result.nextReviewAt.toISOString()).toBe(expected.toISOString());
    });
  });
});
