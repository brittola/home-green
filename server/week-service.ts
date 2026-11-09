import { isIsoDate, isoWeekday, weekDates } from '../shared/dates.js';
import { ruleContextRange } from '../shared/rules.js';
import type { DayView, IsoDate, WeekView, Weekday } from '../shared/types.js';
import { isWeekEditable, isWeekViewable, weekWindow } from '../shared/window.js';
import { HttpError } from './errors.js';
import type { Repository } from './repository.js';

export function assertWeekStart(weekStart: string): void {
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) throw new HttpError(400, 'invalid-week');
}

export async function assertActivePerson(repo: Repository, personId: number): Promise<void> {
  if (!Number.isInteger(personId) || personId <= 0) throw new HttpError(404, 'person-not-found');
  const person = await repo.findActivePerson(personId);
  if (!person) throw new HttpError(404, 'person-not-found');
}

export async function getWeekView(
  repo: Repository,
  today: IsoDate,
  weekStart: IsoDate,
  personId?: number,
): Promise<WeekView> {
  assertWeekStart(weekStart);
  if (!isWeekViewable(weekStart, today)) throw new HttpError(403, 'week-out-of-range');
  if (personId !== undefined) await assertActivePerson(repo, personId);

  const dates = weekDates(weekStart);
  const [limits, rows] = await Promise.all([
    repo.getDayLimits(),
    repo.listRemoteDays(dates[0] as IsoDate, dates[4] as IsoDate),
  ]);

  const days: DayView[] = dates.map((date) => {
    const weekday = isoWeekday(date) as Weekday;
    return {
      date,
      weekday,
      limit: limits[weekday],
      remote: rows.filter((row) => row.date === date).map((row) => row.person),
    };
  });

  let personDates: IsoDate[] = [];
  if (personId !== undefined) {
    const range = ruleContextRange(weekStart);
    personDates = await repo.listPersonDates(personId, range.from, range.to);
  }

  return {
    weekStart,
    today,
    ...weekWindow(today),
    editable: isWeekEditable(weekStart, today),
    days,
    personDates,
  };
}
