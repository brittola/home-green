import {
  MONTH_NAMES_PT,
  addDays,
  firstDayOfMonth,
  formatDayMonth,
  isoWeekday,
  lastDayOfMonth,
  monthIndex,
  monthKey,
  weekStartOf,
} from './dates.js';
import type { IsoDate, Weekday } from './types.js';
import { isDateEditable } from './window.js';

export const MAX_REMOTE_DAYS_PER_WEEK = 2;

export type BlockReason =
  | { kind: 'locked' }
  | { kind: 'full'; limit: number }
  | { kind: 'weekly-max'; max: number }
  | { kind: 'monday-of-month'; usedOn: IsoDate }
  | { kind: 'friday-of-month'; usedOn: IsoDate }
  | { kind: 'monday-friday-same-week'; other: IsoDate }
  | { kind: 'friday-before-monday'; other: IsoDate }
  | { kind: 'monday-after-friday'; other: IsoDate }
  | { kind: 'consecutive-day'; other: IsoDate };

export interface AddContext {
  today: IsoDate;
  personDates: readonly IsoDate[];
  othersRemoteCount: number;
  limit: number;
}

export interface Violation {
  date: IsoDate;
  reason: BlockReason;
  message: string;
}

export function canAdd(date: IsoDate, ctx: AddContext): BlockReason | null {
  if (!isDateEditable(date, ctx.today)) return { kind: 'locked' };
  if (ctx.othersRemoteCount >= ctx.limit) return { kind: 'full', limit: ctx.limit };

  const others = ctx.personDates.filter((d) => d !== date);
  const week = weekStartOf(date);
  const sameWeek = others.filter((d) => weekStartOf(d) === week);
  if (sameWeek.length >= MAX_REMOTE_DAYS_PER_WEEK) return { kind: 'weekly-max', max: MAX_REMOTE_DAYS_PER_WEEK };

  const weekday = isoWeekday(date);
  if (weekday === 1) {
    const usedOn = others.find((d) => isoWeekday(d) === 1 && monthKey(d) === monthKey(date));
    if (usedOn) return { kind: 'monday-of-month', usedOn };
    const friday = sameWeek.find((d) => isoWeekday(d) === 5);
    if (friday) return { kind: 'monday-friday-same-week', other: friday };
    const previousFriday = addDays(date, -3);
    if (others.includes(previousFriday)) return { kind: 'monday-after-friday', other: previousFriday };
  }
  if (weekday === 5) {
    const usedOn = others.find((d) => isoWeekday(d) === 5 && monthKey(d) === monthKey(date));
    if (usedOn) return { kind: 'friday-of-month', usedOn };
    const monday = sameWeek.find((d) => isoWeekday(d) === 1);
    if (monday) return { kind: 'monday-friday-same-week', other: monday };
    const nextMonday = addDays(date, 3);
    if (others.includes(nextMonday)) return { kind: 'friday-before-monday', other: nextMonday };
  }
  const neighbour = [addDays(date, -1), addDays(date, 1)].find((d) => others.includes(d));
  if (neighbour) return { kind: 'consecutive-day', other: neighbour };
  return null;
}

export function validateAdditions(
  added: readonly IsoDate[],
  finalDates: readonly IsoDate[],
  today: IsoDate,
  othersCountByDate: Readonly<Record<IsoDate, number>>,
  limitsByWeekday: Readonly<Record<Weekday, number>>,
): Violation[] {
  const violations: Violation[] = [];
  for (const date of added) {
    const weekday = isoWeekday(date);
    const limit = weekday <= 5 ? limitsByWeekday[weekday as Weekday] : 0;
    const reason = canAdd(date, {
      today,
      personDates: finalDates.filter((d) => d !== date),
      othersRemoteCount: othersCountByDate[date] ?? 0,
      limit,
    });
    if (reason) violations.push({ date, reason, message: blockReasonMessage(reason) });
  }
  return violations;
}

const WEEKDAY_NAMES_PT = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;

function weekdayName(d: IsoDate): string {
  return WEEKDAY_NAMES_PT[isoWeekday(d) - 1] as string;
}

export function blockReasonMessage(reason: BlockReason): string {
  switch (reason.kind) {
    case 'locked':
      return 'Não dá para alterar este dia';
    case 'full':
      return 'Lotado';
    case 'weekly-max':
      return `Você já tem ${reason.max} dias de home nesta semana`;
    case 'monday-of-month':
      return `Você já usou sua segunda de ${MONTH_NAMES_PT[monthIndex(reason.usedOn)]} (${formatDayMonth(reason.usedOn)})`;
    case 'friday-of-month':
      return `Você já usou sua sexta de ${MONTH_NAMES_PT[monthIndex(reason.usedOn)]} (${formatDayMonth(reason.usedOn)})`;
    case 'monday-friday-same-week':
      return `Você já tem a ${weekdayName(reason.other)} ${formatDayMonth(reason.other)} nesta semana`;
    case 'friday-before-monday':
      return `Você já tem a segunda ${formatDayMonth(reason.other)}, então não pode marcar a sexta anterior`;
    case 'monday-after-friday':
      return `Você já tem a sexta ${formatDayMonth(reason.other)}, então não pode marcar a segunda seguinte`;
    case 'consecutive-day':
      return `Você já tem home na ${weekdayName(reason.other)} ${formatDayMonth(reason.other)}, e não pode ter dois dias seguidos`;
  }
}

export function ruleContextRange(weekStart: IsoDate): { from: IsoDate; to: IsoDate } {
  return {
    from: addDays(firstDayOfMonth(weekStart), -3),
    to: addDays(lastDayOfMonth(addDays(weekStart, 4)), 3),
  };
}
