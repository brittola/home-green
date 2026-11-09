import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app.js';
import { createEventBus, type WeekChanged } from '../../server/events.js';
import { createMemoryRepository } from '../fakes/memory-repository.js';

const env = {
  CRON_SECRET: 'a-secret-with-enough-length',
  APP_URL: 'https://home-verdes.vercel.app',
  WEB_ORIGIN: 'https://home-verdes.vercel.app',
};

let app: FastifyInstance;
let repo: ReturnType<typeof createMemoryRepository>;
let published: WeekChanged[];

beforeEach(() => {
  repo = createMemoryRepository();
  published = [];
  const events = createEventBus();
  events.subscribe((event) => published.push(event));
  app = buildApp({ repo, clock: () => new Date('2026-11-13T19:00:00Z'), env, events });
});

function put(weekStart: string, personId: number | string, dates: unknown) {
  return app.inject({ method: 'PUT', url: `/api/weeks/${weekStart}/people/${personId}`, payload: { dates } });
}

function seedRemote(date: string, personIds: number[]) {
  for (const personId of personIds) repo.state.remote.push({ personId, date });
}

describe('PUT /api/weeks/:weekStart/people/:personId', () => {
  it('saves two future days and publishes', async () => {
    const res = await put('2026-11-16', 1, ['2026-11-17', '2026-11-18']);
    expect(res.statusCode).toBe(200);
    expect(res.json().personDates).toEqual(['2026-11-17', '2026-11-18']);
    expect(published).toEqual([{ type: 'week-changed', weekStart: '2026-11-16' }]);
  });

  it('rejects a full day with 409', async () => {
    seedRemote('2026-11-16', [2, 3, 4]);
    const res = await put('2026-11-16', 1, ['2026-11-16']);
    expect(res.statusCode).toBe(409);
    expect(res.json().violations[0].reason.kind).toBe('full');
    expect(res.json().violations[0].message).toBe('Lotado');
    expect(published).toEqual([]);
  });

  it('rejects a third day in the week', async () => {
    const res = await put('2026-11-16', 1, ['2026-11-17', '2026-11-18', '2026-11-19']);
    expect(res.statusCode).toBe(409);
    expect(await repo.listPersonDates(1, '2026-11-16', '2026-11-20')).toEqual([]);
  });

  it('keeps locked dates regardless of body', async () => {
    seedRemote('2026-11-10', [1]);
    seedRemote('2026-11-13', [1]);
    const res = await put('2026-11-09', 1, ['2026-11-12']);
    expect(res.statusCode).toBe(200);
    expect(await repo.listPersonDates(1, '2026-11-09', '2026-11-13')).toEqual(['2026-11-10', '2026-11-13']);
  });

  it('allows removing a day even when the day is over a lowered limit', async () => {
    seedRemote('2026-11-18', [1, 2, 3, 4, 5, 6]);
    repo.state.limits[3] = 3;
    expect((await put('2026-11-16', 1, [])).statusCode).toBe(200);
    expect(await repo.listPersonDates(1, '2026-11-16', '2026-11-20')).toEqual([]);
  });

  it('keeps an existing over-limit day while adding another', async () => {
    seedRemote('2026-11-18', [1, 2, 3, 4]);
    repo.state.limits[3] = 3;
    expect((await put('2026-11-16', 1, ['2026-11-18', '2026-11-19'])).statusCode).toBe(200);
  });

  it('rejects a date outside the week', async () => {
    expect((await put('2026-11-16', 1, ['2026-11-23'])).statusCode).toBe(400);
  });

  it('rejects a malformed body', async () => {
    expect((await put('2026-11-16', 1, 'nope')).statusCode).toBe(400);
    expect((await put('2026-11-16', 1, ['2026-02-30'])).statusCode).toBe(400);
  });

  it('rejects a past week and a week beyond next', async () => {
    expect((await put('2026-11-02', 1, [])).statusCode).toBe(403);
    expect((await put('2026-11-23', 1, [])).statusCode).toBe(403);
  });

  it('rejects an invalid weekStart', async () => {
    expect((await put('2026-11-17', 1, [])).statusCode).toBe(400);
  });

  it('404 for unknown, inactive or non-numeric person', async () => {
    expect((await put('2026-11-16', 999, [])).statusCode).toBe(404);
    expect((await put('2026-11-16', 7, [])).statusCode).toBe(404);
    expect((await put('2026-11-16', 'abc', [])).statusCode).toBe(404);
  });

  it('applies month rules using dates outside the week', async () => {
    seedRemote('2026-11-06', [1]);
    const res = await put('2026-11-16', 1, ['2026-11-20']);
    expect(res.statusCode).toBe(409);
    expect(res.json().violations[0].message).toBe('Você já usou sua sexta de novembro (06/nov)');
  });
});
