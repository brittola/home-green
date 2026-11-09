import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { todayIn } from '../../shared/dates.js';
import type { AppDeps } from '../app.js';
import { sendWeeklyReminder } from '../reminder.js';

function isAuthorized(header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function registerCronRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.register(async (scope) => {
    scope.removeAllContentTypeParsers();
    scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, _body, done) => done(null, undefined));

    scope.post('/api/cron/weekly-reminder', async (request, reply) => {
      if (!isAuthorized(request.headers.authorization, deps.env.CRON_SECRET)) {
        return reply.status(401).send({ error: 'unauthorized' });
      }
      try {
        const status = await sendWeeklyReminder({
          repo: deps.repo,
          slack: deps.slack,
          today: todayIn(deps.clock()),
          appUrl: deps.env.APP_URL,
        });
        request.log.info({ status }, 'weekly reminder');
        return { status };
      } catch (error) {
        request.log.error(error, 'weekly reminder failed');
        return reply.status(502).send({ error: 'slack-failed' });
      }
    });
  });
}
