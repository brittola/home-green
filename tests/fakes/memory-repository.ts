import type { IsoDate, PersonSummary, Weekday } from '../../shared/types.js';
import type { Repository } from '../../server/repository.js';

export interface MemoryPerson extends PersonSummary {
  active: boolean;
}

export interface MemoryState {
  people: MemoryPerson[];
  limits: Record<Weekday, number>;
  remote: Array<{ personId: number; date: IsoDate }>;
  reminders: IsoDate[];
}

export function defaultState(): MemoryState {
  return {
    people: [
      { id: 1, name: 'Ana', hasParkingCard: true, active: true },
      { id: 2, name: 'Bruno', hasParkingCard: false, active: true },
      { id: 3, name: 'Carla', hasParkingCard: true, active: true },
      { id: 4, name: 'Diego', hasParkingCard: false, active: true },
      { id: 5, name: 'Eva', hasParkingCard: false, active: true },
      { id: 6, name: 'Felipe', hasParkingCard: false, active: true },
      { id: 7, name: 'Gui', hasParkingCard: false, active: false },
    ],
    limits: { 1: 3, 2: 5, 3: 5, 4: 5, 5: 3 },
    remote: [],
    reminders: [],
  };
}

function summary(person: MemoryPerson): PersonSummary {
  return { id: person.id, name: person.name, hasParkingCard: person.hasParkingCard };
}

export function createMemoryRepository(state: MemoryState = defaultState()): Repository & { state: MemoryState } {
  const repo: Repository & { state: MemoryState } = {
    state,
    async ping() {},
    async listActivePeople() {
      return state.people
        .filter((p) => p.active)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(summary);
    },
    async findActivePerson(id) {
      const person = state.people.find((p) => p.id === id && p.active);
      return person ? summary(person) : null;
    },
    async getDayLimits() {
      return { ...state.limits };
    },
    async listRemoteDays(from, to) {
      return state.remote
        .filter((r) => r.date >= from && r.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => {
          const person = state.people.find((p) => p.id === r.personId);
          if (!person) throw new Error(`Unknown person ${r.personId}`);
          return { date: r.date, person: summary(person) };
        });
    },
    async listPersonDates(personId, from, to) {
      return state.remote
        .filter((r) => r.personId === personId && r.date >= from && r.date <= to)
        .map((r) => r.date)
        .sort();
    },
    async replacePersonDates(personId, remove, add) {
      state.remote = state.remote.filter((r) => !(r.personId === personId && remove.includes(r.date)));
      for (const date of add) {
        if (!state.remote.some((r) => r.personId === personId && r.date === date)) state.remote.push({ personId, date });
      }
    },
    async isReminderSent(weekStart) {
      return state.reminders.includes(weekStart);
    },
    async markReminderSent(weekStart) {
      if (!state.reminders.includes(weekStart)) state.reminders.push(weekStart);
    },
    async withLock(fn) {
      const snapshot = structuredClone({ remote: state.remote, reminders: state.reminders });
      try {
        return await fn(repo);
      } catch (error) {
        state.remote = snapshot.remote;
        state.reminders = snapshot.reminders;
        throw error;
      }
    },
  };
  return repo;
}
