import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, pgTable, serial, smallint, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  hasParkingCard: boolean('has_parking_card').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dayLimits = pgTable(
  'day_limits',
  {
    weekday: smallint('weekday').primaryKey(),
    maxRemote: smallint('max_remote').notNull(),
  },
  (t) => [check('day_limits_weekday_range', sql`${t.weekday} BETWEEN 1 AND 5`)],
);

export const remoteDays = pgTable(
  'remote_days',
  {
    id: serial('id').primaryKey(),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('remote_days_person_date').on(t.personId, t.date), index('remote_days_date_idx').on(t.date)],
);

export const remindersSent = pgTable('reminders_sent', {
  weekStart: date('week_start', { mode: 'string' }).primaryKey(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});
