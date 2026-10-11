import { DEFAULT_TIMEZONE } from './planner.constants';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Data local (YYYY-MM-DD) no timezone informado. */
export function todayInTz(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }
}

function parseDate(date: string): number {
  if (!DATE_RE.test(date)) {
    throw new Error(`Invalid date: ${date}`);
  }
  // Meio-dia UTC evita problemas de horário de verão ao deslocar dias
  return Date.parse(`${date}T12:00:00Z`);
}

function formatUtc(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Soma/subtrai dias de uma data YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return formatUtc(parseDate(date) + days * MS_PER_DAY);
}

/** 0 = domingo … 6 = sábado. */
export function dayOfWeek(date: string): number {
  return new Date(parseDate(date)).getUTCDay();
}

/** Semana (domingo → sábado) que contém a data. */
export function weekRangeOf(date: string): {
  startDate: string;
  endDate: string;
} {
  const startDate = addDays(date, -dayOfWeek(date));
  return { startDate, endDate: addDays(startDate, 6) };
}

/**
 * Número da semana compatível com o cálculo do frontend
 * (frontend/app/(dashboard)/dashboard/planner/page.tsx): ceil(dias desde 1º de janeiro / 7), mínimo 1.
 */
export function weekNumberFor(date: string): number {
  const year = Number(date.slice(0, 4));
  const jan1 = Date.UTC(year, 0, 1, 12);
  const diffDays = Math.floor((parseDate(date) - jan1) / MS_PER_DAY);
  return Math.max(1, Math.ceil(diffDays / 7));
}

/** Label por extenso no estilo "Quinta-feira, 27 de agosto" (pt-BR). */
export function formatDateLabel(date: string): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
