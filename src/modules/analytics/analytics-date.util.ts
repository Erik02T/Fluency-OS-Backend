import type { AnalyticsGranularity, AnalyticsPeriod } from './dto';

const MS_PER_DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Data inicial (início do dia UTC) para o período solicitado. 'all' => epoch. */
export function periodStartDate(period: AnalyticsPeriod, now: Date): Date {
  const days = PERIOD_DAYS[period];
  if (days === null) {
    return new Date(0);
  }
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return new Date(end - (days - 1) * MS_PER_DAY);
}

const PERIOD_DAYS: Record<AnalyticsPeriod, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

/** Chave de bucket (YYYY-MM-DD, UTC) para um timestamp. */
export function toDateKey(
  value: Date,
  granularity: AnalyticsGranularity,
): string {
  const dayStart = Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );

  if (granularity === 'week') {
    // Semana começando no domingo (UTC).
    const dow = new Date(dayStart).getUTCDay();
    return formatKey(new Date(dayStart - dow * MS_PER_DAY));
  }

  return formatKey(new Date(dayStart));
}

function formatKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Lista inclusiva de chaves YYYY-MM-DD entre start e end (diária). */
export function eachDayKey(start: Date, end: Date): string[] {
  const startMs = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const endMs = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );

  const keys: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += MS_PER_DAY) {
    keys.push(formatKey(new Date(ms)));
  }
  return keys;
}

export function isValidDateKey(value: string): boolean {
  return DATE_RE.test(value);
}
