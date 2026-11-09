import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Clock } from './clock.js';
import type { Env } from './env.js';
import { HttpError } from './errors.js';
import type { Repository } from './repository.js';
import { registerPeopleRoutes } from './routes/people.js';
import { registerWeekRoutes } from './routes/weeks.js';

export interface AppDeps {
  repo: Repository;
  clock: Clock;
  env: Pick<Env, 'CRON_SECRET' | 'APP_URL' | 'WEB_ORIGIN'>;
}

export function buildApp(deps: AppDeps, options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.register(cors, { origin: deps.env.WEB_ORIGIN, methods: ['GET', 'PUT', 'POST'] });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) return reply.status(error.status).send({ error: error.code });
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== undefined && status >= 400 && status < 500) return reply.status(status).send({ error: 'bad-request' });
    request.log.error(error);
    return reply.status(500).send({ error: 'internal-error' });
  });

  app.get('/healthz', async (_request, reply) => {
    try {
      await deps.repo.ping();
      return { ok: true };
    } catch {
      return reply.status(503).send({ ok: false });
    }
  });

  registerPeopleRoutes(app, deps);
  registerWeekRoutes(app, deps);

  return app;
}
