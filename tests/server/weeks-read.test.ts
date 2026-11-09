import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app.js';
import { createEventBus } from '../../server/events.js';
import { createMemoryRepository } from '../fakes/memory-repository.js';

const env = {
  CRON_SECRET: 'a-secret-with-enough-length',
  APP_URL: 'https://home-verdes.vercel.app',
  WEB_ORIGIN: 'https://home-verdes.vercel.app',
};

let app: FastifyInstance;
let repo: ReturnType<typeof createMemoryRepository>;

beforeEach(() => {
  repo = createMemoryRepository();
  repo.state.remote.push(
    { personId: 1, date: '2026-11-02' },
    { personId: 1, date: '2026-11-17' },
    { personId: 2, date: '2026-11-17' },
  );
  app = buildApp({ repo, clock: () => new Date('2026-11-13T19:00:00Z'), env, events: createEventBus() });
});

describe('GET /api/people', () => {
  it('lists active people ordered by name', async () => {
    const res = await app.inject('/api/people');
    expect(res.json().map((p: { name: string }) => p.name)).toEqual(['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Felipe']);
  });
});

describe('GET /api/weeks/:weekStart', () => {
  it('returns next week with limits and remote people', async () => {
    const res = await app.inject('/api/weeks/2026-11-16');
    expect(res.statusCode).toBe(200);
    const view = res.json();
    expect(view.days.map((d: { limit: number }) => d.limit)).toEqual([3, 5, 5, 5, 3]);
    expect(view.days[1].remote.map((p: { name: string }) => p.name)).toEqual(['Ana', 'Bruno']);
    expect(view.editable).toBe(true);
    expect(view.today).toBe('2026-11-13');
    expect(view.personDates).toEqual([]);
  });

  it('rejects a non-Monday weekStart', async () => {
    expect((await app.inject('/api/weeks/2026-11-17')).statusCode).toBe(400);
  });

  it('rejects garbage weekStart', async () => {
    expect((await app.inject('/api/weeks/abc')).statusCode).toBe(400);
  });

  it('rejects weeks outside the view window', async () => {
    expect((await app.inject('/api/weeks/2026-11-23')).statusCode).toBe(403);
    expect((await app.inject('/api/weeks/2026-10-12')).statusCode).toBe(403);
  });

  it('past weeks are viewable but not editable', async () => {
    const res = await app.inject('/api/weeks/2026-10-19');
    expect(res.statusCode).toBe(200);
    expect(res.json().editable).toBe(false);
  });

  it('includes personDates across the rule context range', async () => {
    const view = (await app.inject('/api/weeks/2026-11-16?personId=1')).json();
    expect(view.personDates).toEqual(['2026-11-02', '2026-11-17']);
  });

  it('404 for unknown or inactive person', async () => {
    expect((await app.inject('/api/weeks/2026-11-16?personId=999')).statusCode).toBe(404);
    expect((await app.inject('/api/weeks/2026-11-16?personId=7')).statusCode).toBe(404);
  });
});
