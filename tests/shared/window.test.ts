import { describe, expect, it } from 'vitest';
import { isDateEditable, isWeekEditable, isWeekViewable, weekWindow } from '../../shared/window.js';

describe('week window', () => {
  it('weekWindow on Friday 2026-11-13', () => {
    expect(weekWindow('2026-11-13')).toEqual({
      currentWeekStart: '2026-11-09',
      minWeekStart: '2026-10-19',
      maxWeekStart: '2026-11-16',
    });
  });

  it('isDateEditable locks today and the past', () => {
    expect(isDateEditable('2026-11-13', '2026-11-13')).toBe(false);
    expect(isDateEditable('2026-11-12', '2026-11-13')).toBe(false);
    expect(isDateEditable('2026-11-16', '2026-11-13')).toBe(true);
    expect(isDateEditable('2026-11-23', '2026-11-13')).toBe(false);
  });

  it('on Sunday only next week is editable', () => {
    expect(isWeekEditable('2026-11-09', '2026-11-15')).toBe(true);
    expect(isDateEditable('2026-11-13', '2026-11-15')).toBe(false);
    expect(isDateEditable('2026-11-16', '2026-11-15')).toBe(true);
  });

  it('viewable window bounds', () => {
    expect(isWeekViewable('2026-10-19', '2026-11-13')).toBe(true);
    expect(isWeekViewable('2026-10-12', '2026-11-13')).toBe(false);
    expect(isWeekViewable('2026-11-23', '2026-11-13')).toBe(false);
    expect(isWeekEditable('2026-11-02', '2026-11-13')).toBe(false);
  });
});
