import { z } from 'zod';

const noTrailingSlash = (value: string) => !value.endsWith('/');

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SLACK_USER_TOKEN: z.string().min(1),
  SLACK_CHANNEL_ID: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  APP_URL: z.url().refine(noTrailingSlash, 'APP_URL must not end with a slash'),
  WEB_ORIGIN: z.url().refine(noTrailingSlash, 'WEB_ORIGIN must not end with a slash'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
