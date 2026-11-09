import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { todayIn } from '../../shared/dates.js';
import type { AppDeps } from '../app.js';
import { HttpError } from '../errors.js';
import { getWeekView } from '../week-service.js';

const weekQuery = z.object({
  personId: z.coerce.number().int().optional(),
});

export function registerWeekRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get<{ Params: { weekStart: string } }>('/api/weeks/:weekStart', async (request) => {
    const query = weekQuery.safeParse(request.query);
    if (!query.success) throw new HttpError(400, 'invalid-query');
    return getWeekView(deps.repo, todayIn(deps.clock()), request.params.weekStart, query.data.personId);
  });
}
