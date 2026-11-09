import type { DayView, PersonSummary } from '../../../shared/types.js';
import { freeParkingCards, type DayUiState } from '../day-state.js';

const WEEKDAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'] as const;
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

interface Props {
  day: DayView;
  state: DayUiState | null;
  me: PersonSummary | null;
  selected: boolean;
  isToday: boolean;
  violation?: string;
  onToggle: () => void;
}

function status(state: DayUiState | null): { tone: string; icon: string; text: string } | null {
  if (!state) return null;
  switch (state.kind) {
    case 'selected':
      return state.removable
        ? { tone: 'selected', icon: '✓', text: 'Seu dia de home · toque para desmarcar' }
        : { tone: 'selected', icon: '✓', text: 'Seu dia de home' };
    case 'available':
      return { tone: 'available', icon: '+', text: 'Marcar home' };
    case 'blocked':
      return { tone: 'blocked', icon: '🔒', text: state.message };
    case 'locked':
      return null;
  }
}

export function DayCard({ day, state, me, selected, isToday, violation, onToggle }: Props) {
  const others = day.remote.filter((person) => person.id !== me?.id);
  const people = selected && me ? [...others, me] : others;
  const count = people.length;
  const cards = freeParkingCards({ ...day, remote: people });
  const clickable = state?.kind === 'available' || (state?.kind === 'selected' && state.removable);
  const kind = state?.kind ?? 'readonly';
  const full = count >= day.limit;
  const info = status(state);
  const segments = Array.from({ length: Math.max(day.limit, count) }, (_, i) => i < count);
  const dayNumber = day.date.slice(8, 10);
  const month = MONTH_ABBR[Number(day.date.slice(5, 7)) - 1];

  return (
    <button
      type="button"
      className={`day day-${kind}${full ? ' is-full' : ''}${isToday ? ' is-today' : ''}`}
      disabled={!clickable}
      aria-pressed={state ? selected : undefined}
      onClick={onToggle}
    >
      <span className="day-head">
        <span className="day-weekday">{WEEKDAY_NAMES[day.weekday - 1]}</span>
        <span className="day-date">
          {dayNumber} {month}
        </span>
        {isToday ? <span className="day-today">hoje</span> : null}
      </span>

      <span className="day-capacity">
        <span className="meter" aria-hidden="true">
          {segments.map((filled, i) => (
            <span key={i} className={`meter-seg${filled ? ' is-filled' : ''}${i >= day.limit ? ' is-over' : ''}`} />
          ))}
        </span>
        <span className="day-count">
          <strong>{count}</strong> / {day.limit} em home{full ? ' · lotado' : ''}
        </span>
      </span>

      {people.length > 0 ? (
        <span className="day-people">
          {people.map((person) => (
            <span key={person.id} className={person.id === me?.id ? 'chip is-me' : 'chip'}>
              {person.name}
              {person.hasParkingCard ? <span aria-label="tem cartão de estacionamento"> 🅿️</span> : null}
            </span>
          ))}
        </span>
      ) : (
        <span className="day-empty">Ninguém em home</span>
      )}

      <span className={cards.length > 0 ? 'parking is-free' : 'parking'}>
        {cards.length === 0 ? (
          '🅿️ nenhum cartão livre'
        ) : (
          <>
            🅿️ <strong>{cards.length}</strong> {cards.length === 1 ? 'cartão livre' : 'cartões livres'}:{' '}
            {cards.map((p) => p.name).join(', ')}
          </>
        )}
      </span>

      {violation ? (
        <span className="day-status tone-error">
          <span aria-hidden="true">!</span> {violation}
        </span>
      ) : info ? (
        <span className={`day-status tone-${info.tone}`}>
          <span aria-hidden="true">{info.icon}</span> {info.text}
        </span>
      ) : null}
    </button>
  );
}
