import { describe, expect, it } from 'vitest';
import { createEventBus, type WeekChanged } from '../../server/events.js';

describe('event bus', () => {
  it('delivers events until unsubscribed', () => {
    const bus = createEventBus();
    const received: WeekChanged[] = [];
    const unsubscribe = bus.subscribe((event) => received.push(event));

    bus.publish({ type: 'week-changed', weekStart: '2026-11-16' });
    unsubscribe();
    bus.publish({ type: 'week-changed', weekStart: '2026-11-23' });

    expect(received).toEqual([{ type: 'week-changed', weekStart: '2026-11-16' }]);
  });
});
