import type { PersonSummary } from '../../shared/types.js';

export const PERSON_STORAGE_KEY = 'home-verdes:personId';

export function resolveStoredPerson(storedId: string | null, people: readonly PersonSummary[]): number | null {
  if (storedId === null || !/^\d+$/.test(storedId)) return null;
  const id = Number(storedId);
  return people.some((person) => person.id === id) ? id : null;
}

export function readStoredPerson(): string | null {
  try {
    return window.localStorage.getItem(PERSON_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredPerson(id: number | null): void {
  try {
    if (id === null) window.localStorage.removeItem(PERSON_STORAGE_KEY);
    else window.localStorage.setItem(PERSON_STORAGE_KEY, String(id));
  } catch {
    return;
  }
}
