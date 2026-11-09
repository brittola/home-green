import type { IsoDate } from '../shared/types.js';

export interface WeekChanged {
  type: 'week-changed';
  weekStart: IsoDate;
}

export interface EventBus {
  subscribe(listener: (event: WeekChanged) => void): () => void;
  publish(event: WeekChanged): void;
}

export function createEventBus(): EventBus {
  const listeners = new Set<(event: WeekChanged) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(event) {
      for (const listener of listeners) listener(event);
    },
  };
}
