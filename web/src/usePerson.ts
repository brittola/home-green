import { useEffect, useState } from 'react';
import type { PersonSummary } from '../../shared/types.js';
import { readStoredPerson, resolveStoredPerson, writeStoredPerson } from './person.js';

export function usePerson(people: readonly PersonSummary[] | null): [number | null, (id: number | null) => void] {
  const [personId, setPersonId] = useState<number | null>(null);

  useEffect(() => {
    if (!people) return;
    const resolved = resolveStoredPerson(readStoredPerson(), people);
    if (resolved === null) writeStoredPerson(null);
    setPersonId(resolved);
  }, [people]);

  const choose = (id: number | null) => {
    writeStoredPerson(id);
    setPersonId(id);
  };

  return [personId, choose];
}
