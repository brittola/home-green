import { isIsoDate, isoWeekday, weekDates } from '../shared/dates.js';
import { ruleContextRange, validateAdditions, type Violation } from '../shared/rules.js';
import type { DayView, IsoDate, WeekView, Weekday } from '../shared/types.js';
import { isDateEditable, isWeekEditable, isWeekViewable, weekWindow } from '../shared/window.js';
import { HttpError } from './errors.js';
import type { Repository } from './repository.js';

const MAX_PERSON_ID = 2_147_483_647;

export function assertWeekStart(weekStart: string): void {
  if (!isIsoDate(weekStart) || isoWeekday(weekStart) !== 1) throw new HttpError(400, 'invalid-week');
}

export async function assertActivePerson(repo: Repository, personId: number): Promise<void> {
  if (!Number.isInteger(personId) || personId <= 0 || personId > MAX_PERSON_ID) {
    throw new HttpError(404, 'person-not-found');
  }
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

export type SaveResult = { ok: true } | { ok: false; violations: Violation[] };

export async function saveWeek(
  repo: Repository,
  today: IsoDate,
  weekStart: IsoDate,
  personId: number,
  dates: IsoDate[],
): Promise<SaveResult> {
  assertWeekStart(weekStart);
  const week = weekDates(weekStart);
  if (dates.some((date) => !week.includes(date))) throw new HttpError(400, 'invalid-body');
  if (!isWeekEditable(weekStart, today)) throw new HttpError(403, 'week-not-editable');
  await assertActivePerson(repo, personId);

  return repo.withLock(async (tx) => {
    const first = week[0] as IsoDate;
    const last = week[4] as IsoDate;
    const range = ruleContextRange(weekStart);
    const [limits, rows, contextDates] = await Promise.all([
      tx.getDayLimits(),
      tx.listRemoteDays(first, last),
      tx.listPersonDates(personId, range.from, range.to),
    ]);

    const saved = contextDates.filter((date) => date >= first && date <= last);
    const locked = saved.filter((date) => !isDateEditable(date, today));
    const requested = [...new Set(dates)].filter((date) => isDateEditable(date, today));
    const final = [...new Set([...locked, ...requested])].sort();
    const added = final.filter((date) => !saved.includes(date));
    const removed = saved.filter((date) => !final.includes(date));

    const othersCountByDate: Record<IsoDate, number> = {};
    for (const row of rows) {
      if (row.person.id !== personId) othersCountByDate[row.date] = (othersCountByDate[row.date] ?? 0) + 1;
    }

    const outsideWeek = contextDates.filter((date) => date < first || date > last);
    const violations = validateAdditions(added, [...outsideWeek, ...final], today, othersCountByDate, limits);
    if (violations.length > 0) return { ok: false, violations };

    await tx.replacePersonDates(personId, removed, added);
    return { ok: true };
  });
}
