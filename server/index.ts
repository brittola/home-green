import { buildApp } from './app.js';
import { systemClock } from './clock.js';
import { createDb, runMigrations } from './db/client.js';
import { loadEnv } from './env.js';
import { createEventBus } from './events.js';
import { createPgRepository } from './repository.js';

const env = loadEnv();
const { db } = createDb(env.DATABASE_URL);
await runMigrations(db);

const app = buildApp(
  {
    repo: createPgRepository(db),
    clock: systemClock,
    events: createEventBus(),
    env,
  },
  { logger: true },
);

await app.listen({ host: '0.0.0.0', port: env.PORT });
