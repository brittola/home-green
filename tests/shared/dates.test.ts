import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatDayMonth,
  formatWeekRange,
  isIsoDate,
  isoWeekday,
  lastDayOfMonth,
  firstDayOfMonth,
  monthKey,
  todayIn,
  weekDates,
  weekStartOf,
} from '../../shared/dates.js';

describe('dates', () => {
  it('todayIn uses São Paulo time', () => {
    expect(todayIn(new Date('2026-11-14T02:30:00Z'))).toBe('2026-11-13');
  });

  it('weekStartOf maps weekend to the previous Monday', () => {
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
  });

  it('formatWeekRange inside one month', () => {
    expect(formatWeekRange('2026-11-16')).toBe('16 a 20/nov');
  });

  it('formatWeekRange across months', () => {
    expect(formatWeekRange('2026-11-30')).toBe('30/nov a 04/dez');
    expect(formatDayMonth('2026-11-09')).toBe('09/nov');
  });

  it('addDays crosses year end', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('isIsoDate rejects impossible dates', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('abc')).toBe(false);
    expect(isIsoDate('2026-11-16')).toBe(true);
  });

  it('isoWeekday, weekDates and month helpers', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(isoWeekday('2026-11-15')).toBe(7);
    expect(weekDates('2026-11-30')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']);
    expect(monthKey('2026-11-30')).toBe('2026-11');
    expect(firstDayOfMonth('2026-11-18')).toBe('2026-11-01');
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29');
  });
});
