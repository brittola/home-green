import type { PersonSummary } from '../../../shared/types.js';

interface Props {
  people: readonly PersonSummary[];
  personId: number | null;
  onChange: (id: number | null) => void;
}

export function PersonPicker({ people, personId, onChange }: Props) {
  return (
    <label className="person-picker">
      <span>Você é</span>
      <select
        value={personId ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      >
        <option value="">Escolha seu nome</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </select>
    </label>
  );
}
