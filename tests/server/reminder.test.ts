import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server/app.js';
import { createEventBus } from '../../server/events.js';
import { buildReminderText } from '../../server/reminder.js';
import { createMemoryRepository } from '../fakes/memory-repository.js';

const env = {
  CRON_SECRET: 'a-secret-with-enough-length',
  APP_URL: 'https://hv.vercel.app',
  WEB_ORIGIN: 'https://hv.vercel.app',
};

let app: FastifyInstance;
let repo: ReturnType<typeof createMemoryRepository>;
let slackPosts: string[];
let slackFails: boolean;

beforeEach(() => {
  repo = createMemoryRepository();
  slackPosts = [];
  slackFails = false;
  const slack = {
    async post(text: string) {
      if (slackFails) throw new Error('invalid_auth');
      slackPosts.push(text);
    },
  };
  app = buildApp({ repo, clock: () => new Date('2026-11-13T19:00:00Z'), env, events: createEventBus(), slack });
});

function callCron(authorization = `Bearer ${env.CRON_SECRET}`) {
  return app.inject({ method: 'POST', url: '/api/cron/weekly-reminder', headers: { authorization } });
}

describe('buildReminderText', () => {
  it('builds the reminder text', () => {
    expect(buildReminderText('2026-11-16', 'https://hv.onrender.com')).toBe(
      '<!here> Hora de preencher a escala de home office da semana de 16 a 20/nov 👉 <https://hv.onrender.com/?week=2026-11-16|abrir escala>',
    );
  });

  it('formats a cross-month week', () => {
    expect(buildReminderText('2026-11-30', 'https://x')).toContain('30/nov a 04/dez');
  });
});

describe('POST /api/cron/weekly-reminder', () => {
  it('401 without the secret', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/cron/weekly-reminder' })).statusCode).toBe(401);
  });

  it('401 with a wrong secret', async () => {
    expect((await callCron('Bearer wrong')).statusCode).toBe(401);
  });

  it('posts the next week link', async () => {
    const res = await callCron();
    expect(res.json()).toEqual({ status: 'sent' });
    expect(slackPosts[0]).toContain('https://hv.vercel.app/?week=2026-11-16');
  });

  it('sends once per week', async () => {
    await callCron();
    const second = await callCron();
    expect(second.json()).toEqual({ status: 'already-sent' });
    expect(slackPosts).toHaveLength(1);
  });

  it('does not mark as sent when Slack fails', async () => {
    slackFails = true;
    expect((await callCron()).statusCode).toBe(502);
    expect(repo.state.reminders).toEqual([]);
    slackFails = false;
    await callCron();
    expect(slackPosts).toHaveLength(1);
  });
});
