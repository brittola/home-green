import type { DayView, PersonSummary } from '../../../shared/types.js';
import { freeParkingCards, type DayUiState } from '../day-state.js';

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'] as const;

interface Props {
  day: DayView;
  state: DayUiState | null;
  me: PersonSummary | null;
  selected: boolean;
  violation?: string;
  onToggle: () => void;
}

function stateText(state: DayUiState | null): string | null {
  if (!state) return null;
  switch (state.kind) {
    case 'selected':
      return state.removable ? 'Selecionado · clique para desmarcar' : 'Selecionado';
    case 'available':
      return 'Clique para marcar';
    case 'blocked':
      return state.message;
    case 'locked':
      return null;
  }
}

export function DayCard({ day, state, me, selected, violation, onToggle }: Props) {
  const others = day.remote.filter((person) => person.id !== me?.id);
  const names = selected && me ? [...others, me] : others;
  const count = names.length;
  const cards = freeParkingCards({ ...day, remote: names });
  const clickable = state?.kind === 'available' || (state?.kind === 'selected' && state.removable);
  const kind = state?.kind ?? 'readonly';
  const full = count >= day.limit;

  return (
    <button
      type="button"
      className={`day-card day-${kind}${full ? ' day-full' : ''}`}
      disabled={!clickable}
      aria-pressed={selected}
      onClick={onToggle}
    >
      <span className="day-title">
        {WEEKDAY_LABELS[day.weekday - 1]} {day.date.slice(8, 10)}
      </span>
      <span className="day-count">
        {count} / {day.limit} em home
      </span>
      <span className="day-names">
        {names.map((person) => (
          <span key={person.id} className={person.id === me?.id ? 'day-name is-me' : 'day-name'}>
            {person.name}
            {person.hasParkingCard ? ' 🅿️' : ''}
          </span>
        ))}
      </span>
      <span className={cards.length > 0 ? 'parking parking-free' : 'parking'}>
        {cards.length === 0
          ? '🅿️ nenhum cartão livre'
          : `🅿️ ${cards.length} ${cards.length === 1 ? 'cartão livre' : 'cartões livres'}: ${cards.map((p) => p.name).join(', ')}`}
      </span>
      {violation ? <span className="day-violation">{violation}</span> : null}
      {stateText(state) ? <span className="day-state">{stateText(state)}</span> : null}
    </button>
  );
}
