import { and, asc, between, eq, inArray, sql } from 'drizzle-orm';
import type { IsoDate, PersonSummary, Weekday } from '../shared/types.js';
import type { Db } from './db/client.js';
import { dayLimits, people, remindersSent, remoteDays } from './db/schema.js';

export interface RemoteDayRow {
  date: IsoDate;
  person: PersonSummary;
}

export interface Repository {
  ping(): Promise<void>;
  listActivePeople(): Promise<PersonSummary[]>;
  findActivePerson(id: number): Promise<PersonSummary | null>;
  getDayLimits(): Promise<Record<Weekday, number>>;
  listRemoteDays(from: IsoDate, to: IsoDate): Promise<RemoteDayRow[]>;
  listPersonDates(personId: number, from: IsoDate, to: IsoDate): Promise<IsoDate[]>;
  replacePersonDates(personId: number, remove: IsoDate[], add: IsoDate[]): Promise<void>;
  isReminderSent(weekStart: IsoDate): Promise<boolean>;
  markReminderSent(weekStart: IsoDate): Promise<void>;
  withLock<T>(fn: (tx: Repository) => Promise<T>, key?: number): Promise<T>;
}

export const GLOBAL_LOCK_KEY = 482901;
export const REMINDER_LOCK_KEY = 482902;

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Executor = Db | Tx;

const personColumns = {
  id: people.id,
  name: people.name,
  hasParkingCard: people.hasParkingCard,
};

function build(executor: Executor, inTransaction: boolean, root: Db): Repository {
  const repo: Repository = {
    async ping() {
      await executor.execute(sql`select 1`);
    },

    async listActivePeople() {
      return executor.select(personColumns).from(people).where(eq(people.active, true)).orderBy(asc(people.name));
    },

    async findActivePerson(id) {
      const rows = await executor
        .select(personColumns)
        .from(people)
        .where(and(eq(people.id, id), eq(people.active, true)));
      return rows[0] ?? null;
    },

    async getDayLimits() {
      const rows = await executor.select().from(dayLimits);
      const limits: Record<Weekday, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const row of rows) {
        if (row.weekday >= 1 && row.weekday <= 5) limits[row.weekday as Weekday] = row.maxRemote;
      }
      return limits;
    },

    async listRemoteDays(from, to) {
      const rows = await executor
        .select({ date: remoteDays.date, ...personColumns })
        .from(remoteDays)
        .innerJoin(people, eq(people.id, remoteDays.personId))
        .where(between(remoteDays.date, from, to))
        .orderBy(asc(remoteDays.date), asc(remoteDays.createdAt), asc(remoteDays.id));
      return rows.map((row) => ({
        date: row.date,
        person: { id: row.id, name: row.name, hasParkingCard: row.hasParkingCard },
      }));
    },

    async listPersonDates(personId, from, to) {
      const rows = await executor
        .select({ date: remoteDays.date })
        .from(remoteDays)
        .where(and(eq(remoteDays.personId, personId), between(remoteDays.date, from, to)))
        .orderBy(asc(remoteDays.date));
      return rows.map((row) => row.date);
    },

    async replacePersonDates(personId, remove, add) {
      if (remove.length > 0) {
        await executor
          .delete(remoteDays)
          .where(and(eq(remoteDays.personId, personId), inArray(remoteDays.date, remove)));
      }
      if (add.length > 0) {
        await executor
          .insert(remoteDays)
          .values(add.map((date) => ({ personId, date })))
          .onConflictDoNothing();
      }
    },

    async isReminderSent(weekStart) {
      const rows = await executor.select().from(remindersSent).where(eq(remindersSent.weekStart, weekStart));
      return rows.length > 0;
    },

    async markReminderSent(weekStart) {
      await executor.insert(remindersSent).values({ weekStart }).onConflictDoNothing();
    },

    async withLock(fn, key = GLOBAL_LOCK_KEY) {
      if (inTransaction) return fn(repo);
      return root.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${key})`);
        return fn(build(tx, true, root));
      });
    },
  };
  return repo;
}

export function createPgRepository(db: Db): Repository {
  return build(db, false, db);
}
