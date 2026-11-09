import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';

export function registerPeopleRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/people', async () => deps.repo.listActivePeople());
}
