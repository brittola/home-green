import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../server/env.js';

const valid = {
  DATABASE_URL: 'postgres://localhost/db',
  SLACK_USER_TOKEN: 'xoxp-test',
  SLACK_CHANNEL_ID: 'C123',
  CRON_SECRET: 'a-secret-with-enough-length',
  APP_URL: 'https://home-verdes.vercel.app',
  WEB_ORIGIN: 'https://home-verdes.vercel.app',
};

describe('loadEnv', () => {
  it('rejects a short CRON_SECRET', () => {
    expect(() => loadEnv({ ...valid, CRON_SECRET: 'short' })).toThrow();
  });

  it('defaults PORT to 3000', () => {
    expect(loadEnv(valid).PORT).toBe(3000);
  });

  it('rejects APP_URL with a trailing slash', () => {
    expect(() => loadEnv({ ...valid, APP_URL: 'https://home-verdes.vercel.app/' })).toThrow();
  });
});
