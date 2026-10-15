import {
  eachDayKey,
  isValidDateKey,
  periodStartDate,
  toDateKey,
} from './analytics-date.util';

describe('analytics-date.util', () => {
  const now = new Date('2026-10-10T15:30:00.000Z');

  describe('periodStartDate', () => {
    it('7d cobre 7 dias incluindo hoje', () => {
      const start = periodStartDate('7d', now);
      expect(start.toISOString().slice(0, 10)).toBe('2026-10-04');
    });

    it('30d cobre 30 dias incluindo hoje', () => {
      const start = periodStartDate('30d', now);
      expect(start.toISOString().slice(0, 10)).toBe('2026-09-11');
    });

    it('all retorna epoch', () => {
      const start = periodStartDate('all', now);
      expect(start.getTime()).toBe(0);
    });
  });

  describe('toDateKey', () => {
    it('granularidade diária usa o próprio dia', () => {
      const date = new Date('2026-10-10T23:00:00.000Z');
      expect(toDateKey(date, 'day')).toBe('2026-10-10');
    });

    it('granularidade semanal alinha ao domingo', () => {
      // 2026-10-10 é um sábado; semana começa em 2026-10-04 (domingo).
      const date = new Date('2026-10-10T12:00:00.000Z');
      expect(toDateKey(date, 'week')).toBe('2026-10-04');
    });
  });

  describe('eachDayKey', () => {
    it('lista inclusiva de dias', () => {
      const keys = eachDayKey(
        new Date('2026-10-01T00:00:00.000Z'),
        new Date('2026-10-03T00:00:00.000Z'),
      );
      expect(keys).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    });
  });

  describe('isValidDateKey', () => {
    it('valida formato YYYY-MM-DD', () => {
      expect(isValidDateKey('2026-10-10')).toBe(true);
      expect(isValidDateKey('10/10/2026')).toBe(false);
    });
  });
});
