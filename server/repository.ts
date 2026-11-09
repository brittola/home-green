import { sql } from 'drizzle-orm';
import type { Db } from './db/client.js';

export interface Repository {
  ping(): Promise<void>;
}

export function createPgRepository(db: Db): Repository {
  return {
    async ping() {
      await db.execute(sql`select 1`);
    },
  };
}
