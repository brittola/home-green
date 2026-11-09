import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';

const PING_INTERVAL_MS = 25_000;

export function registerEventRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/events', (request, reply) => {
    reply.hijack();
    const origin = request.headers.origin;
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      ...(origin === deps.env.WEB_ORIGIN ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    });
    reply.raw.write(': connected\n\n');

    const unsubscribe = deps.events.subscribe((event) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify({ weekStart: event.weekStart })}\n\n`);
    });
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), PING_INTERVAL_MS);

    request.raw.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  });
}
