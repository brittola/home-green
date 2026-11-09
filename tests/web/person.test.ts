import { describe, expect, it } from 'vitest';
import { resolveStoredPerson } from '../../web/src/person.js';

const people = [{ id: 1, name: 'Ana', hasParkingCard: false }];

describe('resolveStoredPerson', () => {
  it('keeps a known id', () => {
    expect(resolveStoredPerson('1', people)).toBe(1);
  });

  it('resets unknown, inactive or malformed ids', () => {
    expect(resolveStoredPerson('7', people)).toBeNull();
    expect(resolveStoredPerson('abc', [])).toBeNull();
    expect(resolveStoredPerson(null, people)).toBeNull();
    expect(resolveStoredPerson('1.5', people)).toBeNull();
  });
});
