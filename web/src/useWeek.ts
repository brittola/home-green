import { useCallback, useEffect, useRef, useState } from 'react';
import type { IsoDate, WeekView } from '../../shared/types.js';
import { eventsUrl, getWeek } from './api.js';

const POLL_INTERVAL_MS = 10_000;

export interface WeekState {
  view: WeekView | null;
  error: string | null;
  reload: () => Promise<WeekView | null>;
  setView: (view: WeekView) => void;
}

export function useWeek(weekStart: IsoDate, personId: number | null): WeekState {
  const [view, setView] = useState<WeekView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const next = await getWeek(weekStart, personId);
      if (id !== requestId.current) return null;
      setView(next);
      setError(null);
      return next;
    } catch {
      if (id === requestId.current) setError('Não foi possível carregar a escala. Tentando de novo…');
      return null;
    }
  }, [weekStart, personId]);

  useEffect(() => {
    setView(null);
    void reload();
  }, [reload]);

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null;
    const source = new EventSource(eventsUrl());
    source.addEventListener('week-changed', (event) => {
      const data = JSON.parse((event as MessageEvent<string>).data) as { weekStart: IsoDate };
      if (data.weekStart === weekStart) void reload();
    });
    source.onerror = () => {
      source.close();
      if (!poll) poll = setInterval(() => void reload(), POLL_INTERVAL_MS);
    };
    return () => {
      source.close();
      if (poll) clearInterval(poll);
    };
  }, [weekStart, reload]);

  return { view, error, reload, setView };
}
