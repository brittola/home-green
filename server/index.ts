import { buildApp } from './app.js';
import { systemClock } from './clock.js';
import { createDb, runMigrations } from './db/client.js';
import { loadEnv } from './env.js';
import { createEventBus } from './events.js';
import { createPgRepository } from './repository.js';
import { createSlackPoster } from './slack.js';

const env = loadEnv();
const { db } = createDb(env.DATABASE_URL);
await runMigrations(db);

const app = buildApp(
  {
    repo: createPgRepository(db),
    clock: systemClock,
    events: createEventBus(),
    slack: createSlackPoster(env.SLACK_USER_TOKEN, env.SLACK_CHANNEL_ID),
    env,
  },
  { logger: true },
);

await app.listen({ host: '0.0.0.0', port: env.PORT });
