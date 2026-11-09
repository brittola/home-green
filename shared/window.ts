import { addDays, weekStartOf } from './dates.js';
import type { IsoDate } from './types.js';

export interface WeekWindow {
  currentWeekStart: IsoDate;
  minWeekStart: IsoDate;
  maxWeekStart: IsoDate;
}

export function weekWindow(today: IsoDate): WeekWindow {
  const currentWeekStart = weekStartOf(today);
  return {
    currentWeekStart,
    minWeekStart: addDays(currentWeekStart, -21),
    maxWeekStart: addDays(currentWeekStart, 7),
  };
}

export function isWeekViewable(weekStart: IsoDate, today: IsoDate): boolean {
  const { minWeekStart, maxWeekStart } = weekWindow(today);
  return weekStart >= minWeekStart && weekStart <= maxWeekStart;
}

export function isWeekEditable(weekStart: IsoDate, today: IsoDate): boolean {
  const { currentWeekStart, maxWeekStart } = weekWindow(today);
  return weekStart === currentWeekStart || weekStart === maxWeekStart;
}

export function isDateEditable(date: IsoDate, today: IsoDate): boolean {
  return date > today && isWeekEditable(weekStartOf(date), today);
}
