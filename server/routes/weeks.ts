import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isIsoDate, todayIn } from '../../shared/dates.js';
import type { AppDeps } from '../app.js';
import { HttpError } from '../errors.js';
import { getWeekView, saveWeek } from '../week-service.js';

const weekQuery = z.object({
  personId: z.coerce.number().int().optional(),
});

const saveBody = z.object({
  dates: z.array(z.string().refine(isIsoDate)).max(5),
});

export function registerWeekRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get<{ Params: { weekStart: string } }>('/api/weeks/:weekStart', async (request) => {
    const query = weekQuery.safeParse(request.query);
    if (!query.success) throw new HttpError(400, 'invalid-query');
    return getWeekView(deps.repo, todayIn(deps.clock()), request.params.weekStart, query.data.personId);
  });

  app.put<{ Params: { weekStart: string; personId: string } }>(
    '/api/weeks/:weekStart/people/:personId',
    async (request, reply) => {
      const body = saveBody.safeParse(request.body);
      if (!body.success) throw new HttpError(400, 'invalid-body');
      const personId = Number(request.params.personId);
      const { weekStart } = request.params;
      const today = todayIn(deps.clock());

      const result = await saveWeek(deps.repo, today, weekStart, personId, body.data.dates);
      if (!result.ok) return reply.status(409).send({ error: 'rule-violation', violations: result.violations });

      deps.events.publish({ type: 'week-changed', weekStart });
      return getWeekView(deps.repo, today, weekStart, personId);
    },
  );
}
