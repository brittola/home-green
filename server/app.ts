import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Clock } from './clock.js';
import type { Env } from './env.js';
import type { Repository } from './repository.js';

export interface AppDeps {
  repo: Repository;
  clock: Clock;
  env: Pick<Env, 'CRON_SECRET' | 'APP_URL' | 'WEB_ORIGIN'>;
}

export function buildApp(deps: AppDeps, options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.register(cors, { origin: deps.env.WEB_ORIGIN, methods: ['GET', 'PUT', 'POST'] });

  app.get('/healthz', async (_request, reply) => {
    try {
      await deps.repo.ping();
      return { ok: true };
    } catch {
      return reply.status(503).send({ ok: false });
    }
  });

  return app;
}
