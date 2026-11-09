import path from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url: string): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}

const migrationsFolder = path.resolve(process.cwd(), 'drizzle');

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}
