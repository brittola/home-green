# Home Verdes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared weekly home-office schedule for a 10-person team, with per-day and per-person rules, live updates, parking-card visibility, and a Slack reminder route triggered by cron-job.org.

**Architecture:** One Node 22 + TypeScript service (Fastify) serving a JSON API, an SSE stream and the built React SPA. Postgres on Neon through Drizzle. All date and rule logic lives in a pure `shared/` module imported by both the server (authoritative validation inside a locked transaction) and the web app (live block reasons while the person selects).

**Tech Stack:** Node 22, TypeScript (ESM, `module: NodeNext`), Fastify 5, `@fastify/static`, Drizzle ORM + drizzle-kit, `pg`, zod, `@slack/web-api`, React 18 + Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-home-verdes-design.md`

## Global Constraints

- **Never run unit tests** (`npm test`, `vitest`, or any equivalent). Write and update test files; verify with `npm run typecheck`, `npm run build` and the smoke checks listed in each task. Every "verify" step in this plan obeys this.
- No code comments of any kind (inline, block, JSDoc).
- Commit messages in English, Conventional Commits (`type(scope): imperative subject`), no `Co-Authored-By` footer, no "Generated with" line.
- All dates are `YYYY-MM-DD` strings (`IsoDate`) computed in time zone `America/Sao_Paulo`. No date library.
- UI copy in pt-BR.
- Day limits seeded as: Monday 3, Tuesday 5, Wednesday 5, Thursday 5, Friday 3. Read from the DB on every request, never cached.
- `MAX_REMOTE_DAYS_PER_WEEK = 2`, in code.
- Editable weeks: current and next. Viewable weeks: from current − 3 weeks to next. Today and past dates are never editable.
- Saturday/Sunday belong to the week that just ended (ISO week, Monday start).
- Env vars: `DATABASE_URL`, `SLACK_USER_TOKEN`, `SLACK_CHANNEL_ID`, `CRON_SECRET`, `APP_URL`, `PORT` (default `3000`).
- Slack text: `<!here> Hora de preencher a escala de home office da semana de {range} 👉 <{APP_URL}/?week={weekStart}|abrir escala>`.

## Review Focus

1. A week that crosses a month boundary (Mon 30/nov … Fri 4/dez): month rules count each date in its own month, and the Slack range reads `30/nov a 4/dez`. Tests in Tasks 1, 2 and 6.
2. Two concurrent confirmations for the last spot of a day: exactly one succeeds and the other gets 409 `full`. Global advisory lock in Task 5. Smoke check in Task 5.
3. A PUT body that includes today or past dates, or omits locked dates the person already has: locked dates keep their saved state no matter what the body says. Test in Task 5.
4. A `weekStart` that is not a Monday, is not a date at all, or is outside the viewable or editable window: 400 or 403, never a 500. Tests in Tasks 4 and 5.
5. A stored `personId` in the browser that no longer exists or is inactive: the picker resets instead of showing an empty or broken screen. Test in Task 7.

---

### Task 1: Project scaffold and shared date helpers

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.server.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `.nvmrc`
- Create: `shared/types.ts`, `shared/dates.ts`, `shared/window.ts`
- Test: `tests/shared/dates.test.ts`, `tests/shared/window.test.ts`

**Interfaces:**
- Produces (`shared/types.ts`):
  - `type IsoDate = string`
  - `type Weekday = 1 | 2 | 3 | 4 | 5`
  - `interface PersonSummary { id: number; name: string; hasParkingCard: boolean }`
  - `interface DayView { date: IsoDate; weekday: Weekday; limit: number; remote: PersonSummary[] }`
  - `interface WeekView { weekStart: IsoDate; today: IsoDate; currentWeekStart: IsoDate; minWeekStart: IsoDate; maxWeekStart: IsoDate; editable: boolean; days: DayView[]; personDates: IsoDate[] }`. `personDates` holds the requested person's saved dates inside `ruleContextRange(weekStart)` (Task 2), or `[]` when no person was requested.
- Produces (`shared/dates.ts`):
  - `todayIn(now: Date, timeZone?: string): IsoDate`, with `'America/Sao_Paulo'` as the default.
  - `isIsoDate(s: string): boolean`
  - `addDays(d: IsoDate, n: number): IsoDate`
  - `isoWeekday(d: IsoDate): 1|2|3|4|5|6|7`
  - `weekStartOf(d: IsoDate): IsoDate`
  - `weekDates(weekStart: IsoDate): IsoDate[]` (5 dates)
  - `monthKey(d: IsoDate): string` (`'2026-11'`)
  - `firstDayOfMonth(d): IsoDate`, `lastDayOfMonth(d): IsoDate`
  - `formatDayMonth(d): string` (`'16/nov'`)
  - `formatWeekRange(weekStart): string`
  - `MONTH_NAMES_PT: readonly string[]` (`'janeiro'…'dezembro'`)
- Produces (`shared/window.ts`):
  - `weekWindow(today: IsoDate): { currentWeekStart: IsoDate; minWeekStart: IsoDate; maxWeekStart: IsoDate }`, where `min = current − 21` and `max = current + 7`.
  - `isWeekViewable(weekStart, today): boolean`
  - `isWeekEditable(weekStart, today): boolean` (current or next week)
  - `isDateEditable(date, today): boolean`, true when `date > today` and its week is editable.

- [ ] **Step 1: Scaffold**

  - `git init`, then write a `.gitignore` covering `node_modules`, `dist`, `.env`, `.superpowers/`.
  - `.nvmrc` = `22`.
  - `package.json`:
    - `"type": "module"` and `"engines": { "node": ">=22" }`.
    - Scripts:
      - `dev:server` = `tsx watch server/index.ts`
      - `dev:web` = `vite`
      - `build` = `tsc -p tsconfig.server.json && vite build`
      - `start` = `node dist/server/index.js`
      - `typecheck` = `tsc --noEmit -p tsconfig.json`
      - `test` = `vitest run`
      - `db:generate` = `drizzle-kit generate`
  - `tsconfig.json`: `strict`, `module`/`moduleResolution` `NodeNext`, `jsx: react-jsx`, includes `server`, `shared`, `web/src`, `tests`.
  - `tsconfig.server.json`: extends the base, includes `server` and `shared` only, `rootDir: "."`, `outDir: "dist"`.
  - `vite.config.ts`: `root: 'web'`, `build.outDir: '../dist/web'`, dev proxy `/api` and `/healthz` → `http://localhost:3000`.
  - Install the dependencies from the Tech Stack.

- [ ] **Step 2: Write the failing tests**

```ts
it('todayIn uses São Paulo time', () => {
  expect(todayIn(new Date('2026-11-14T02:30:00Z'))).toBe('2026-11-13');
});
it('weekStartOf maps weekend to the previous Monday', () => {
  expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
  expect(weekStartOf('2026-11-16')).toBe('2026-11-16');
});
it('formatWeekRange inside one month', () => {
  expect(formatWeekRange('2026-11-16')).toBe('16 a 20/nov');
});
it('formatWeekRange across months', () => {
  expect(formatWeekRange('2026-11-30')).toBe('30/nov a 04/dez');
  expect(formatDayMonth('2026-11-09')).toBe('09/nov');
});
it('addDays crosses year end', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
});
it('isIsoDate rejects impossible dates', () => {
  expect(isIsoDate('2026-02-30')).toBe(false);
  expect(isIsoDate('2026-11-16')).toBe(true);
});
it('weekWindow on Friday 2026-11-13', () => {
  expect(weekWindow('2026-11-13')).toEqual({ currentWeekStart: '2026-11-09', minWeekStart: '2026-10-19', maxWeekStart: '2026-11-16' });
});
it('isDateEditable locks today and the past', () => {
  expect(isDateEditable('2026-11-13', '2026-11-13')).toBe(false);
  expect(isDateEditable('2026-11-16', '2026-11-13')).toBe(true);
  expect(isDateEditable('2026-11-23', '2026-11-13')).toBe(false);
});
it('on Sunday only next week is editable', () => {
  expect(isWeekEditable('2026-11-09', '2026-11-15')).toBe(true);
  expect(isDateEditable('2026-11-13', '2026-11-15')).toBe(false);
  expect(isDateEditable('2026-11-16', '2026-11-15')).toBe(true);
});
```

- [ ] **Step 3: Implement `shared/types.ts`, `shared/dates.ts` and `shared/window.ts`**

  - `todayIn` uses `Intl.DateTimeFormat('en-CA', { timeZone })`.
  - All other arithmetic parses `IsoDate` as UTC midnight with `Date.UTC`, so no local-time drift.
  - Month abbreviations: `jan fev mar abr mai jun jul ago set out nov dez`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with shared date and week window helpers"
```

---

### Task 2: Shared rules module

**Files:**
- Create: `shared/rules.ts`
- Test: `tests/shared/rules.test.ts`

**Interfaces:**
- Consumes: Task 1 date and window helpers.
- Produces:
  - `MAX_REMOTE_DAYS_PER_WEEK = 2`
  - `BlockReason`, one of:
    - `{ kind: 'locked' }`
    - `{ kind: 'full'; limit: number }`
    - `{ kind: 'weekly-max'; max: number }`
    - `{ kind: 'monday-of-month'; usedOn: IsoDate }`
    - `{ kind: 'friday-of-month'; usedOn: IsoDate }`
    - `{ kind: 'monday-friday-same-week'; other: IsoDate }`
    - `{ kind: 'friday-before-monday'; other: IsoDate }`: adding a Friday when the Monday after it is taken.
    - `{ kind: 'monday-after-friday'; other: IsoDate }`: adding a Monday when the Friday before it is taken.
  - `interface AddContext { today: IsoDate; personDates: readonly IsoDate[]; othersRemoteCount: number; limit: number }`, where `personDates` is the person's effective set **without** the date being checked.
  - `canAdd(date: IsoDate, ctx: AddContext): BlockReason | null`. Checks in this order: locked → full (`othersRemoteCount >= limit`) → weekly-max → month → same-week → sequence. Returns the first failure.
  - `interface Violation { date: IsoDate; reason: BlockReason; message: string }`
  - `validateAdditions(added: readonly IsoDate[], finalDates: readonly IsoDate[], today: IsoDate, othersCountByDate: Record<IsoDate, number>, limitsByWeekday: Record<Weekday, number>): Violation[]`. Runs `canAdd` for each added date, with `personDates = finalDates minus that date`.
  - `blockReasonMessage(reason: BlockReason): string`
  - `ruleContextRange(weekStart: IsoDate): { from: IsoDate; to: IsoDate }`, where `from = firstDayOfMonth(weekStart) − 3` and `to = lastDayOfMonth(weekStart + 4) + 3`.

Exact messages (`dd/mmm` is `formatDayMonth`; `{mês}` is the full month name of `usedOn`):

| kind | message |
|---|---|
| locked | `Não dá para alterar este dia` |
| full | `Lotado` |
| weekly-max | `Você já tem 2 dias de home nesta semana` |
| monday-of-month | `Você já usou sua segunda de {mês} ({dd/mmm})` |
| friday-of-month | `Você já usou sua sexta de {mês} ({dd/mmm})` |
| monday-friday-same-week | `Você já tem a {segunda\|sexta} {dd/mmm} nesta semana` |
| friday-before-monday | `Você já tem a segunda {dd/mmm}, então não pode marcar a sexta anterior` |
| monday-after-friday | `Você já tem a sexta {dd/mmm}, então não pode marcar a segunda seguinte` |

- [ ] **Step 1: Write the failing tests**

```ts
const base = { today: '2026-11-13', othersRemoteCount: 0, limit: 5 };
it('blocks a full day', () => {
  expect(canAdd('2026-11-17', { ...base, personDates: [], othersRemoteCount: 5 })).toEqual({ kind: 'full', limit: 5 });
});
it('blocks a third day in the week', () => {
  expect(canAdd('2026-11-19', { ...base, personDates: ['2026-11-17', '2026-11-18'] })).toEqual({ kind: 'weekly-max', max: 2 });
});
it('blocks a second Monday in the month', () => {
  expect(canAdd('2026-11-23', { ...base, today: '2026-11-20', personDates: ['2026-11-09'] })).toEqual({ kind: 'monday-of-month', usedOn: '2026-11-09' });
});
it('counts each date in its own month when the week crosses months', () => {
  expect(canAdd('2026-12-04', { ...base, today: '2026-11-27', personDates: ['2026-11-20'] })).toBeNull();
  expect(canAdd('2026-11-30', { ...base, today: '2026-11-27', personDates: ['2026-11-09'] })).toEqual({ kind: 'monday-of-month', usedOn: '2026-11-09' });
});
it('blocks Monday and Friday in the same week', () => {
  expect(canAdd('2026-11-20', { ...base, personDates: ['2026-11-16'] })).toEqual({ kind: 'monday-friday-same-week', other: '2026-11-16' });
});
it('blocks Friday followed by Monday across a month boundary', () => {
  expect(canAdd('2026-11-30', { ...base, today: '2026-11-25', personDates: ['2026-11-27'] })).toEqual({ kind: 'monday-after-friday', other: '2026-11-27' });
  expect(canAdd('2026-10-30', { ...base, today: '2026-10-25', personDates: ['2026-11-02'] })).toEqual({ kind: 'friday-before-monday', other: '2026-11-02' });
});
it('locks today', () => {
  expect(canAdd('2026-11-13', { ...base, personDates: [] })).toEqual({ kind: 'locked' });
});
it('validateAdditions flags both sides of a same-week Monday+Friday pair', () => {
  const v = validateAdditions(['2026-11-16', '2026-11-20'], ['2026-11-16', '2026-11-20'], '2026-11-13', {}, { 1: 3, 2: 5, 3: 5, 4: 5, 5: 3 });
  expect(v.map((x) => x.date)).toEqual(['2026-11-16', '2026-11-20']);
});
it('messages', () => {
  expect(blockReasonMessage({ kind: 'monday-of-month', usedOn: '2026-11-09' })).toBe('Você já usou sua segunda de novembro (09/nov)');
  expect(blockReasonMessage({ kind: 'monday-after-friday', other: '2026-11-20' })).toBe('Você já tem a sexta 20/nov, então não pode marcar a segunda seguinte');
});
```

- [ ] **Step 2: Implement `shared/rules.ts`**

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add shared/rules.ts tests/shared/rules.test.ts
git commit -m "feat(rules): add shared home-office rules with block reasons"
```

---

### Task 3: Database, env and server boot

**Files:**
- Create: `server/env.ts`, `server/db/schema.ts`, `server/db/client.ts`, `drizzle.config.ts`, `drizzle/*` (generated plus one custom seed migration), `server/app.ts`, `server/index.ts`, `server/clock.ts`, `.env.example`
- Test: `tests/server/env.test.ts`

**Interfaces:**
- Produces:
  - `loadEnv(source?: NodeJS.ProcessEnv): Env`, where `Env = { DATABASE_URL: string; SLACK_USER_TOKEN: string; SLACK_CHANNEL_ID: string; CRON_SECRET: string; APP_URL: string; PORT: number }`. zod rules: `CRON_SECRET` has min length 16, `APP_URL` is a URL with no trailing slash, `PORT` defaults to `3000`.
  - Drizzle tables:
    - `people`: `id` serial PK, `name` text unique not null, `has_parking_card` bool default false, `active` bool default true, `created_at` timestamptz default now.
    - `day_limits`: `weekday` smallint PK with check 1..5, `max_remote` smallint not null.
    - `remote_days`: `id` serial PK, `person_id` FK → people, `date` date (string mode), `created_at` timestamptz default now, unique(`person_id`, `date`), index on `date`.
    - `reminders_sent`: `week_start` date PK, `sent_at` timestamptz default now.
  - `createDb(url: string): { db: NodePgDatabase<typeof schema>; pool: Pool }`
  - `runMigrations(db): Promise<void>` (drizzle `migrate`, folder `drizzle`)
  - `type Clock = () => Date`
  - `interface AppDeps { repo: Repository; clock: Clock; env: Env; events: EventBus; slack: SlackPoster }`. The `Repository`, `EventBus` and `SlackPoster` types come from Tasks 4, 5 and 6; start with the subset you need and grow it.
  - `buildApp(deps: AppDeps): FastifyInstance`, which registers the routes from later tasks and `GET /healthz` (`repo.ping()` → 200 `{ ok: true }`, or 503 on failure).
  - `server/index.ts`: load env, `createDb`, `runMigrations`, `buildApp`, listen on `0.0.0.0:PORT`. In production, serve `dist/web` with `@fastify/static`, with an SPA fallback to `index.html` for non-`/api` GETs.

- [ ] **Step 1: Write the failing env test**

```ts
it('rejects a short CRON_SECRET', () => {
  expect(() => loadEnv({ ...valid, CRON_SECRET: 'short' })).toThrow();
});
it('defaults PORT to 3000', () => {
  expect(loadEnv(valid).PORT).toBe(3000);
});
```

- [ ] **Step 2: Implement env, schema, client, app and index**

- [ ] **Step 3: Generate migrations**

  - Run `npm run db:generate` for the schema.
  - Run `npx drizzle-kit generate --custom --name seed_day_limits` and fill it with:

```sql
INSERT INTO day_limits (weekday, max_remote) VALUES (1,3),(2,5),(3,5),(4,5),(5,3) ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Verify boot against a local Postgres**

```bash
docker run -d --name hv-pg -e POSTGRES_PASSWORD=pg -p 5433:5432 postgres:16
```

Copy `.env.example` to `.env`. Set `DATABASE_URL=postgres://postgres:pg@localhost:5433/postgres` and use placeholder Slack values. Then run `npm run dev:server` and `curl -s localhost:3000/healthz`.

Expected: `{"ok":true}`, and `select * from day_limits` returns the 5 seeded rows.

If Docker is unavailable, stop and ask the user for a Neon branch URL.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add Postgres schema, migrations and Fastify boot with healthz"
```

---

### Task 4: People and week read API

**Files:**
- Create: `server/repository.ts`, `server/week-service.ts`, `server/routes/people.ts`, `server/routes/weeks.ts`
- Create: `tests/fakes/memory-repository.ts`
- Test: `tests/server/weeks-read.test.ts`

**Interfaces:**
- Consumes: `shared/*`, `buildApp`, `AppDeps`.
- Produces:
  - `interface Repository`:
    - `ping(): Promise<void>`
    - `listActivePeople(): Promise<PersonSummary[]>`, ordered by name.
    - `findActivePerson(id: number): Promise<PersonSummary | null>`
    - `getDayLimits(): Promise<Record<Weekday, number>>`
    - `listRemoteDays(from: IsoDate, to: IsoDate): Promise<Array<{ date: IsoDate; person: PersonSummary }>>`. Includes inactive people, so past weeks still show them.
    - `listPersonDates(personId: number, from: IsoDate, to: IsoDate): Promise<IsoDate[]>`
    - `replacePersonDates(personId: number, remove: IsoDate[], add: IsoDate[]): Promise<void>`
    - `isReminderSent(weekStart: IsoDate): Promise<boolean>`
    - `markReminderSent(weekStart: IsoDate): Promise<void>`
    - `withLock<T>(fn: (tx: Repository) => Promise<T>): Promise<T>`: a transaction that first runs `SELECT pg_advisory_xact_lock(482901)`.
  - `createPgRepository(db): Repository`
  - `createMemoryRepository(seed): Repository` (tests only)
  - `getWeekView(repo: Repository, today: IsoDate, weekStart: IsoDate, personId?: number): Promise<WeekView>`
  - `class HttpError extends Error { status: number; code: string }`, with codes `invalid-week` (400), `week-out-of-range` (403), `person-not-found` (404).
  - `GET /api/people` → `PersonSummary[]`
  - `GET /api/weeks/:weekStart?personId=` → `WeekView`

- [ ] **Step 1: Write the failing tests** (`buildApp` with the memory repository and a fixed clock of `2026-11-13T19:00:00Z`)

```ts
it('returns next week with limits and remote people', async () => {
  const res = await app.inject('/api/weeks/2026-11-16');
  expect(res.statusCode).toBe(200);
  const view = res.json();
  expect(view.days.map((d) => d.limit)).toEqual([3, 5, 5, 5, 3]);
  expect(view.editable).toBe(true);
});
it('rejects a non-Monday weekStart', async () => {
  expect((await app.inject('/api/weeks/2026-11-17')).statusCode).toBe(400);
});
it('rejects garbage weekStart', async () => {
  expect((await app.inject('/api/weeks/abc')).statusCode).toBe(400);
});
it('rejects weeks outside the view window', async () => {
  expect((await app.inject('/api/weeks/2026-11-23')).statusCode).toBe(403);
  expect((await app.inject('/api/weeks/2026-10-12')).statusCode).toBe(403);
});
it('past weeks are viewable but not editable', async () => {
  expect((await app.inject('/api/weeks/2026-10-19')).json().editable).toBe(false);
});
it('includes personDates across the rule context range', async () => {
  const view = (await app.inject('/api/weeks/2026-11-16?personId=1')).json();
  expect(view.personDates).toContain('2026-11-02');
});
it('404 for unknown person', async () => {
  expect((await app.inject('/api/weeks/2026-11-16?personId=999')).statusCode).toBe(404);
});
```

- [ ] **Step 2: Implement the repository, service and routes**

The routes map `HttpError` to `{ error: code }` with its status. `today = todayIn(clock())`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck`, then insert two people in the local DB and run `curl -s localhost:3000/api/weeks/<next Monday>`.
Expected: 5 days with limits `[3,5,5,5,3]`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): expose people and week view endpoints"
```

---

### Task 5: Save week, live events

**Files:**
- Create: `server/events.ts`, `server/routes/events.ts`
- Modify: `server/week-service.ts`, `server/routes/weeks.ts`
- Test: `tests/server/weeks-save.test.ts`, `tests/server/events.test.ts`

**Interfaces:**
- Consumes: `Repository.withLock`, `validateAdditions`, `ruleContextRange`, `isDateEditable`.
- Produces:
  - `interface EventBus { subscribe(listener: (e: WeekChanged) => void): () => void; publish(e: WeekChanged): void }`, where `type WeekChanged = { type: 'week-changed'; weekStart: IsoDate }`.
  - `createEventBus(): EventBus`
  - `saveWeek(repo, today, weekStart, personId, dates: IsoDate[]): Promise<{ ok: true } | { ok: false; violations: Violation[] }>`. Inside `repo.withLock`:
    - `saved` = the person's dates in the week.
    - `locked` = the saved dates that are not `isDateEditable`.
    - `final` = `locked ∪ { d ∈ dates | isDateEditable(d) }`.
    - `added` = `final − saved` and `removed` = `saved − final`.
    - Validate `added` against the person's dates in `ruleContextRange`, with `final` substituted for this week.
    - `othersCountByDate` excludes the person.
    - On success, call `replacePersonDates`.
  - `PUT /api/weeks/:weekStart/people/:personId`, body `{ dates: IsoDate[] }` (zod).
    - 400 `invalid-week` / `invalid-body`, or when a date is outside the week.
    - 403 `week-not-editable`.
    - 404 `person-not-found`.
    - 409 `{ error: 'rule-violation', violations }`.
    - 200 with the fresh `WeekView` for that person, then `events.publish`.
  - `GET /api/events`: SSE.
    - Headers: `content-type: text/event-stream`, `cache-control: no-cache`, `x-accel-buffering: no`.
    - Writes `event: week-changed\ndata: {"weekStart":"…"}\n\n`.
    - Sends `: ping\n\n` every 25 s.
    - Unsubscribes on `close`.

- [ ] **Step 1: Write the failing tests** (memory repository, clock `2026-11-13T19:00:00Z`, limits seeded)

```ts
it('saves two future days and publishes', async () => {
  const res = await put('2026-11-16', 1, ['2026-11-17', '2026-11-18']);
  expect(res.statusCode).toBe(200);
  expect(published).toEqual([{ type: 'week-changed', weekStart: '2026-11-16' }]);
});
it('rejects a full day with 409', async () => {
  seedRemote('2026-11-16', [2, 3, 4]);
  const res = await put('2026-11-16', 1, ['2026-11-16']);
  expect(res.statusCode).toBe(409);
  expect(res.json().violations[0].reason.kind).toBe('full');
});
it('keeps locked dates regardless of body', async () => {
  seedPerson1Dates(['2026-11-10', '2026-11-13']);
  await put('2026-11-09', 1, ['2026-11-12']);
  expect(await repo.listPersonDates(1, '2026-11-09', '2026-11-13')).toEqual(['2026-11-10', '2026-11-13']);
});
it('allows removing a day even when the day is over a lowered limit', async () => {
  seedRemote('2026-11-18', [1, 2, 3, 4, 5, 6]);
  setLimit(3, 3);
  expect((await put('2026-11-16', 1, [])).statusCode).toBe(200);
});
it('rejects a date outside the week', async () => {
  expect((await put('2026-11-16', 1, ['2026-11-23'])).statusCode).toBe(400);
});
it('rejects a past week', async () => {
  expect((await put('2026-11-02', 1, [])).statusCode).toBe(403);
});
```

`events.test.ts`: a subscriber receives a published event, and stops receiving after unsubscribe.

In the case `keeps locked dates regardless of body`, `2026-11-12` is past relative to `2026-11-13`, so it is ignored.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Verify, including the race**

Run: `npm run typecheck`.

Then, against the local DB, with Monday's limit at 3 and 2 people already on next Monday, fire two PUTs in parallel for two other people:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X PUT ... & curl -s -o /dev/null -w '%{http_code}\n' -X PUT ... ; wait
```

Expected: one `200` and one `409`.

Separately, `curl -N localhost:3000/api/events` prints `event: week-changed` after a PUT.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): save weekly selections under a lock and stream changes over SSE"
```

---

### Task 6: Slack weekly reminder route

**Files:**
- Create: `server/slack.ts`, `server/reminder.ts`, `server/routes/cron.ts`
- Test: `tests/server/reminder.test.ts`

**Interfaces:**
- Consumes: `Repository.withLock`, `isReminderSent`, `markReminderSent`, `formatWeekRange`, `weekWindow`.
- Produces:
  - `interface SlackPoster { post(text: string): Promise<void> }`
  - `createSlackPoster(token: string, channelId: string): SlackPoster`. Calls `chat.postMessage({ channel, text, unfurl_links: false })` and throws when `ok` is false.
  - `buildReminderText(weekStart: IsoDate, appUrl: string): string`
  - `sendWeeklyReminder(deps: { repo; slack; today: IsoDate; appUrl }): Promise<'sent' | 'already-sent'>`. Inside `withLock`: check `isReminderSent(next)`, post, then `markReminderSent(next)`. A Slack failure rolls back, so a retry can send.
  - `POST /api/cron/weekly-reminder`:
    - `Authorization: Bearer ${CRON_SECRET}` is compared with `crypto.timingSafeEqual`.
    - 401 on a missing or wrong header.
    - 200 `{ status }` on success, 502 `{ error: 'slack-failed' }` when Slack throws.

- [ ] **Step 1: Write the failing tests**

```ts
it('builds the reminder text', () => {
  expect(buildReminderText('2026-11-16', 'https://hv.onrender.com')).toBe(
    '<!here> Hora de preencher a escala de home office da semana de 16 a 20/nov 👉 <https://hv.onrender.com/?week=2026-11-16|abrir escala>',
  );
});
it('formats a cross-month week', () => {
  expect(buildReminderText('2026-11-30', 'https://x')).toContain('30/nov a 04/dez');
});
it('401 without the secret', async () => {
  expect((await app.inject({ method: 'POST', url: '/api/cron/weekly-reminder' })).statusCode).toBe(401);
});
it('sends once per week', async () => {
  await callCron(); await callCron();
  expect(slackPosts).toHaveLength(1);
});
it('does not mark as sent when Slack fails', async () => {
  slackFails = true;
  expect((await callCron()).statusCode).toBe(502);
  slackFails = false;
  await callCron();
  expect(slackPosts).toHaveLength(1);
});
```

- [ ] **Step 2: Implement**

- [ ] **Step 3: Verify**

Run: `npm run typecheck`, then:

- `curl -s -X POST localhost:3000/api/cron/weekly-reminder` → `401`.
- With the header and a fake `SLACK_USER_TOKEN` → `502` (the Slack auth fails), and the `reminders_sent` table stays empty.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(slack): add authenticated weekly reminder route with once-per-week guard"
```

---

### Task 7: Web app (functional)

**Files:**
- Create: `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/api.ts`, `web/src/useWeek.ts`, `web/src/usePerson.ts`, `web/src/day-state.ts`, `web/src/components/PersonPicker.tsx`, `web/src/components/WeekNav.tsx`, `web/src/components/DayCard.tsx`, `web/src/components/ConfirmBar.tsx`, `web/src/styles.css`
- Test: `tests/web/day-state.test.ts`, `tests/web/usePerson.test.ts`

**Interfaces:**
- Consumes: `WeekView`, `canAdd`, `blockReasonMessage`, `isDateEditable`. Import them with relative paths ending in `.js`; Vite resolves them to `.ts`. Also uses the API from Tasks 4 and 5.
- Produces:
  - `type DayUiState = { kind: 'locked' } | { kind: 'selected'; removable: boolean } | { kind: 'available' } | { kind: 'blocked'; reason: BlockReason; message: string }`
  - `dayState(day: DayView, view: WeekView, personId: number, selection: ReadonlySet<IsoDate>): DayUiState`
    - The effective `personDates` is `view.personDates` minus this week's dates, plus `selection`.
    - `othersRemoteCount` is `day.remote` excluding `personId`.
  - `freeParkingCards(day: DayView): PersonSummary[]`, which returns `day.remote.filter(p => p.hasParkingCard)`.
  - `resolveStoredPerson(storedId: string | null, people: PersonSummary[]): number | null`, which returns `null` when the id is missing, not numeric, or not in `people`.
  - `usePerson()`: stores the choice in `localStorage['home-verdes:personId']`, wrapped in try/catch.
  - `useWeek(weekStart, personId)`: fetches the view, subscribes to `EventSource('/api/events')`, and refetches on `week-changed` for its `weekStart`. On `onerror`, it closes the stream and polls every 10 s.

Behavior:
- **Week to open:** the `?week=` param, or the current week if the param is missing or out of the window (my call). Navigating with ← → updates `?week=` and is clamped to `minWeekStart`/`maxWeekStart`.
- **Without a chosen person:** the grid is read-only and a prompt asks the person to pick a name.
- **Each day card shows:**
  - the weekday and date;
  - `{n} / {limit} em home`, which can exceed the limit;
  - names with 🅿️ for card owners;
  - the parking box: `🅿️ {n} cartão livre` or `🅿️ {n} cartões livres`, plus the names, or `🅿️ nenhum cartão livre`;
  - the state, with the block message.
- **Clicking a day** toggles it in the local selection when the day is `available`, or when it is `selected` and removable.
- **Confirmar** is enabled only when the selection differs from the saved dates.
  - On 409, show each violation's `message` next to its day, refetch, and reset the selection to the saved dates.
  - On 200, show `Escala salva`.
- **When a refetch arrives with unsaved changes**, the local selection is kept and states are recomputed.

- [ ] **Step 1: Write the failing tests**

```ts
it('marks a full day as blocked with Lotado', () => {
  expect(dayState(fullMonday, view, 1, new Set()).kind).toBe('blocked');
});
it('blocks a third day once two are selected', () => {
  const s = dayState(wed, view, 1, new Set(['2026-11-17', '2026-11-19']));
  expect(s).toMatchObject({ kind: 'blocked', message: 'Você já tem 2 dias de home nesta semana' });
});
it('selected future day is removable', () => {
  expect(dayState(tue, viewWithPersonOnTue, 1, new Set(['2026-11-17']))).toEqual({ kind: 'selected', removable: true });
});
it('resolveStoredPerson resets unknown ids', () => {
  expect(resolveStoredPerson('7', [{ id: 1, name: 'Ana', hasParkingCard: false }])).toBeNull();
  expect(resolveStoredPerson('abc', [])).toBeNull();
});
```

- [ ] **Step 2: Implement the components and hooks**

Keep `styles.css` plain and functional. The visual pass is Task 8.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build`.

Then `npm start` with the local DB, and in the browser:

- choose a name;
- mark Tuesday and Wednesday, then confirm and see `Escala salva`;
- open a second tab as another person and see the first person's days appear live;
- check that Thursday shows the 2-day block message.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): add weekly schedule screen with live updates and rule feedback"
```

---

### Task 8: Visual pass with /impeccable

**Files:**
- Modify: `web/src/styles.css`, `web/src/components/*.tsx`

- [ ] **Step 1:** Invoke the `impeccable:impeccable` skill on the web app.

  - Context: an internal team tool, used from a Slack link, often on a phone.
  - Content to keep (from the validated mockup `.superpowers/brainstorm/*/content/escala-semana-v2.html`): the 5-day grid, the vacancy counter, names with 🅿️, the free-cards box, the block reason text, and the Confirm button.
  - Requirement: no horizontal scroll at 360px width. The days stack vertically on mobile.

- [ ] **Step 2:** Verify with `npm run typecheck && npm run build`, then check the screen at 360px and at desktop width.

- [ ] **Step 3: Commit**

```bash
git add web
git commit -m "style(web): refine schedule screen layout and visual hierarchy"
```

---

### Task 9: Deploy config and README

**Files:**
- Create: `render.yaml`, `README.md`

- [ ] **Step 1: Write `render.yaml`**

  - A web service on the `free` plan, with `runtime: node`.
  - `buildCommand: npm ci && npm run build`
  - `startCommand: npm start`
  - `healthCheckPath: /healthz`
  - The env vars from Global Constraints, declared with `sync: false`.

- [ ] **Step 2: Write `README.md`** (pt-BR). Sections:

  1. Rodar localmente (Docker Postgres + `.env`).
  2. Neon: criar o projeto, copiar a connection string *pooled* para o `DATABASE_URL`. As migrações rodam no boot.
  3. Cadastrar pessoas:

     ```sql
     INSERT INTO people (name, has_parking_card) VALUES ('Ana', true), ('Bruno', false);
     ```

     Desativar alguém com `UPDATE people SET active = false WHERE name = '…'`.
  4. Mudar limites:

     ```sql
     UPDATE day_limits SET max_remote = 4 WHERE weekday = 3;
     ```

     O efeito é imediato.
  5. Render: conectar o repositório e preencher as variáveis de ambiente.
  6. Slack: reaproveitar o `SLACK_USER_TOKEN` do linear-code-review (escopo `chat:write`). O dono do token precisa estar no canal. Como pegar o `SLACK_CHANNEL_ID`.
  7. cron-job.org, fuso `America/Sao_Paulo`:
     - Job 1: `GET {APP_URL}/healthz` às sextas 15:55.
     - Job 2: `POST {APP_URL}/api/cron/weekly-reminder` às sextas 16:00, com o header `Authorization: Bearer <CRON_SECRET>` e timeout de 60 s, se o plano permitir.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: exits 0, and the README commands match the scripts in `package.json`.

- [ ] **Step 4: Commit**

```bash
git add render.yaml README.md
git commit -m "docs: add Render blueprint and setup guide for Neon, Slack and cron-job.org"
```
