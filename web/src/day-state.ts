import { weekDates } from '../../shared/dates.js';
import { blockReasonMessage, canAdd, type BlockReason } from '../../shared/rules.js';
import type { DayView, IsoDate, PersonSummary, WeekView } from '../../shared/types.js';
import { isDateEditable } from '../../shared/window.js';

export type DayUiState =
  | { kind: 'locked' }
  | { kind: 'selected'; removable: boolean }
  | { kind: 'available' }
  | { kind: 'blocked'; reason: BlockReason; message: string };

export function savedWeekDates(view: WeekView): IsoDate[] {
  const week = new Set(weekDates(view.weekStart));
  return view.personDates.filter((date) => week.has(date));
}

export function dayState(
  day: DayView,
  view: WeekView,
  personId: number,
  selection: ReadonlySet<IsoDate>,
): DayUiState {
  const editable = isDateEditable(day.date, view.today);
  if (selection.has(day.date)) return { kind: 'selected', removable: editable };
  if (!editable) return { kind: 'locked' };

  const week = new Set(weekDates(view.weekStart));
  const personDates = [...view.personDates.filter((date) => !week.has(date)), ...selection];
  const othersRemoteCount = day.remote.filter((person) => person.id !== personId).length;
  const reason = canAdd(day.date, { today: view.today, personDates, othersRemoteCount, limit: day.limit });
  if (reason) return { kind: 'blocked', reason, message: blockReasonMessage(reason) };
  return { kind: 'available' };
}

export function freeParkingCards(day: DayView): PersonSummary[] {
  return day.remote.filter((person) => person.hasParkingCard);
}
