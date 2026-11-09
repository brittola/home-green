import type { IsoDate } from './types.js';

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

export const MONTH_NAMES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const MONTH_ABBR_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function toUtc(d: IsoDate): Date {
  const match = ISO_PATTERN.exec(d);
  if (!match) throw new Error(`Invalid ISO date: ${d}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function todayIn(now: Date, timeZone: string = DEFAULT_TIME_ZONE): IsoDate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isIsoDate(s: string): boolean {
  const match = ISO_PATTERN.exec(s);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return fromUtc(date) === s;
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtc(new Date(toUtc(d).getTime() + n * DAY_MS));
}

export function isoWeekday(d: IsoDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = toUtc(d).getUTCDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export function weekStartOf(d: IsoDate): IsoDate {
  return addDays(d, 1 - isoWeekday(d));
}

export function weekDates(weekStart: IsoDate): IsoDate[] {
  return [0, 1, 2, 3, 4].map((n) => addDays(weekStart, n));
}

export function monthKey(d: IsoDate): string {
  return d.slice(0, 7);
}

export function firstDayOfMonth(d: IsoDate): IsoDate {
  return `${monthKey(d)}-01`;
}

export function lastDayOfMonth(d: IsoDate): IsoDate {
  const date = toUtc(d);
  return fromUtc(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

export function monthIndex(d: IsoDate): number {
  return Number(d.slice(5, 7)) - 1;
}

export function formatDayMonth(d: IsoDate): string {
  return `${d.slice(8, 10)}/${MONTH_ABBR_PT[monthIndex(d)]}`;
}

export function formatWeekRange(weekStart: IsoDate): string {
  const end = addDays(weekStart, 4);
  if (monthKey(weekStart) === monthKey(end)) return `${weekStart.slice(8, 10)} a ${formatDayMonth(end)}`;
  return `${formatDayMonth(weekStart)} a ${formatDayMonth(end)}`;
}
