import { describe, expect, it } from 'vitest';
import { blockReasonMessage, canAdd, ruleContextRange, validateAdditions } from '../../shared/rules.js';

const base = { today: '2026-11-13', othersRemoteCount: 0, limit: 5 };
const limits = { 1: 3, 2: 5, 3: 5, 4: 5, 5: 3 } as const;

describe('canAdd', () => {
  it('allows a free day', () => {
    expect(canAdd('2026-11-17', { ...base, personDates: [] })).toBeNull();
  });

  it('blocks a full day', () => {
    expect(canAdd('2026-11-17', { ...base, personDates: [], othersRemoteCount: 5 })).toEqual({ kind: 'full', limit: 5 });
  });

  it('blocks a third day in the week', () => {
    expect(canAdd('2026-11-19', { ...base, personDates: ['2026-11-17', '2026-11-18'] })).toEqual({
      kind: 'weekly-max',
      max: 2,
    });
  });

  it('blocks a second Monday in the month', () => {
    expect(canAdd('2026-11-23', { ...base, today: '2026-11-20', personDates: ['2026-11-09'] })).toEqual({
      kind: 'monday-of-month',
      usedOn: '2026-11-09',
    });
  });

  it('blocks a second Friday in the month', () => {
    expect(canAdd('2026-11-20', { ...base, personDates: ['2026-11-06'] })).toEqual({
      kind: 'friday-of-month',
      usedOn: '2026-11-06',
    });
  });

  it('counts each date in its own month when the week crosses months', () => {
    expect(canAdd('2026-12-04', { ...base, today: '2026-11-27', personDates: ['2026-11-20'] })).toBeNull();
    expect(canAdd('2026-11-30', { ...base, today: '2026-11-27', personDates: ['2026-11-09'] })).toEqual({
      kind: 'monday-of-month',
      usedOn: '2026-11-09',
    });
  });

  it('blocks Monday and Friday in the same week', () => {
    expect(canAdd('2026-11-20', { ...base, personDates: ['2026-11-16'] })).toEqual({
      kind: 'monday-friday-same-week',
      other: '2026-11-16',
    });
  });

  it('blocks Friday followed by Monday across a month boundary', () => {
    expect(canAdd('2026-11-30', { ...base, today: '2026-11-25', personDates: ['2026-11-27'] })).toEqual({
      kind: 'monday-after-friday',
      other: '2026-11-27',
    });
    expect(canAdd('2026-10-30', { ...base, today: '2026-10-25', personDates: ['2026-11-02'] })).toEqual({
      kind: 'friday-before-monday',
      other: '2026-11-02',
    });
  });

  it('locks today', () => {
    expect(canAdd('2026-11-13', { ...base, personDates: [] })).toEqual({ kind: 'locked' });
  });
});

describe('validateAdditions', () => {
  it('flags both sides of a same-week Monday+Friday pair', () => {
    const v = validateAdditions(['2026-11-16', '2026-11-20'], ['2026-11-16', '2026-11-20'], '2026-11-13', {}, limits);
    expect(v.map((x) => x.date)).toEqual(['2026-11-16', '2026-11-20']);
  });

  it('uses the per-weekday limit and the others count', () => {
    const v = validateAdditions(['2026-11-16'], ['2026-11-16'], '2026-11-13', { '2026-11-16': 3 }, limits);
    expect(v).toEqual([{ date: '2026-11-16', reason: { kind: 'full', limit: 3 }, message: 'Lotado' }]);
  });

  it('returns nothing for valid additions', () => {
    expect(validateAdditions(['2026-11-17'], ['2026-11-17', '2026-11-18'], '2026-11-13', {}, limits)).toEqual([]);
  });
});

describe('blockReasonMessage', () => {
  it('formats every reason', () => {
    expect(blockReasonMessage({ kind: 'locked' })).toBe('Não dá para alterar este dia');
    expect(blockReasonMessage({ kind: 'full', limit: 3 })).toBe('Lotado');
    expect(blockReasonMessage({ kind: 'weekly-max', max: 2 })).toBe('Você já tem 2 dias de home nesta semana');
    expect(blockReasonMessage({ kind: 'monday-of-month', usedOn: '2026-11-09' })).toBe(
      'Você já usou sua segunda de novembro (09/nov)',
    );
    expect(blockReasonMessage({ kind: 'friday-of-month', usedOn: '2026-11-06' })).toBe(
      'Você já usou sua sexta de novembro (06/nov)',
    );
    expect(blockReasonMessage({ kind: 'monday-friday-same-week', other: '2026-11-20' })).toBe(
      'Você já tem a sexta 20/nov nesta semana',
    );
    expect(blockReasonMessage({ kind: 'monday-friday-same-week', other: '2026-11-16' })).toBe(
      'Você já tem a segunda 16/nov nesta semana',
    );
    expect(blockReasonMessage({ kind: 'friday-before-monday', other: '2026-11-23' })).toBe(
      'Você já tem a segunda 23/nov, então não pode marcar a sexta anterior',
    );
    expect(blockReasonMessage({ kind: 'monday-after-friday', other: '2026-11-20' })).toBe(
      'Você já tem a sexta 20/nov, então não pode marcar a segunda seguinte',
    );
  });
});

describe('ruleContextRange', () => {
  it('covers the months of the week plus the sequence margin', () => {
    expect(ruleContextRange('2026-11-30')).toEqual({ from: '2026-10-29', to: '2027-01-03' });
  });
});
