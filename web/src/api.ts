import type { Violation } from '../../shared/rules.js';
import type { IsoDate, PersonSummary, WeekView } from '../../shared/types.js';

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new ApiError(res.status, body.error ?? 'request-failed'), { body });
  return body as T;
}

export function getPeople(): Promise<PersonSummary[]> {
  return request('/api/people');
}

export function getWeek(weekStart: IsoDate, personId: number | null): Promise<WeekView> {
  const query = personId === null ? '' : `?personId=${personId}`;
  return request(`/api/weeks/${weekStart}${query}`);
}

export type SaveOutcome = { ok: true; view: WeekView } | { ok: false; violations: Violation[] };

export async function saveWeek(weekStart: IsoDate, personId: number, dates: IsoDate[]): Promise<SaveOutcome> {
  try {
    const view = await request<WeekView>(`/api/weeks/${weekStart}/people/${personId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dates }),
    });
    return { ok: true, view };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const body = (error as ApiError & { body: { violations?: Violation[] } }).body;
      return { ok: false, violations: body.violations ?? [] };
    }
    throw error;
  }
}

export function eventsUrl(): string {
  return `${API_URL}/api/events`;
}
