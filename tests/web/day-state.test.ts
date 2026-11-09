import { describe, expect, it } from 'vitest';
import type { DayView, WeekView } from '../../shared/types.js';
import { dayState, freeParkingCards, savedWeekDates } from '../../web/src/day-state.js';

const ana = { id: 1, name: 'Ana', hasParkingCard: true };
const bruno = { id: 2, name: 'Bruno', hasParkingCard: false };
const carla = { id: 3, name: 'Carla', hasParkingCard: true };
const diego = { id: 4, name: 'Diego', hasParkingCard: false };

function day(date: string, weekday: 1 | 2 | 3 | 4 | 5, limit: number, remote = [] as DayView['remote']): DayView {
  return { date, weekday, limit, remote };
}

function makeView(days: DayView[], personDates: string[] = []): WeekView {
  return {
    weekStart: '2026-11-16',
    today: '2026-11-13',
    currentWeekStart: '2026-11-09',
    minWeekStart: '2026-10-19',
    maxWeekStart: '2026-11-16',
    editable: true,
    days,
    personDates,
  };
}

const fullMonday = day('2026-11-16', 1, 3, [bruno, carla, diego]);
const tue = day('2026-11-17', 2, 5);
const wed = day('2026-11-18', 3, 5);
const view = makeView([fullMonday, tue, wed]);

describe('dayState', () => {
  it('marks a full day as blocked with Lotado', () => {
    expect(dayState(fullMonday, view, 1, new Set())).toMatchObject({ kind: 'blocked', message: 'Lotado' });
  });

  it('blocks a third day once two are selected', () => {
    const s = dayState(wed, view, 1, new Set(['2026-11-17', '2026-11-19']));
    expect(s).toMatchObject({ kind: 'blocked', message: 'Você já tem 2 dias de home nesta semana' });
  });

  it('selected future day is removable', () => {
    const withAna = makeView([fullMonday, day('2026-11-17', 2, 5, [ana]), wed], ['2026-11-17']);
    expect(dayState(withAna.days[1]!, withAna, 1, new Set(['2026-11-17']))).toEqual({ kind: 'selected', removable: true });
  });

  it('does not count the person against the day limit', () => {
    const monday = day('2026-11-16', 1, 3, [ana, bruno, carla]);
    const v = makeView([monday], ['2026-11-16']);
    expect(dayState(monday, v, 1, new Set())).toEqual({ kind: 'available' });
  });

  it('uses saved dates outside the week for month rules', () => {
    const friday = day('2026-11-20', 5, 3);
    const v = makeView([friday], ['2026-11-06']);
    expect(dayState(friday, v, 1, new Set())).toMatchObject({
      kind: 'blocked',
      message: 'Você já usou sua sexta de novembro (06/nov)',
    });
  });

  it('locks past and today', () => {
    const current = { ...makeView([day('2026-11-13', 5, 3)]), weekStart: '2026-11-09' };
    expect(dayState(current.days[0]!, current, 1, new Set())).toEqual({ kind: 'locked' });
  });
});

describe('helpers', () => {
  it('freeParkingCards lists card owners at home', () => {
    expect(freeParkingCards(day('2026-11-19', 4, 5, [ana, bruno, carla]))).toEqual([ana, carla]);
  });

  it('savedWeekDates keeps only dates in the week', () => {
    expect(savedWeekDates(makeView([], ['2026-11-06', '2026-11-17']))).toEqual(['2026-11-17']);
  });
});
