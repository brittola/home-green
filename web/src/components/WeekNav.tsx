import { addDays, formatWeekRange } from '../../../shared/dates.js';
import type { IsoDate } from '../../../shared/types.js';

interface Props {
  weekStart: IsoDate;
  currentWeekStart: IsoDate;
  minWeekStart: IsoDate;
  maxWeekStart: IsoDate;
  editable: boolean;
  disabled?: boolean;
  onNavigate: (weekStart: IsoDate) => void;
}

function relativeLabel(weekStart: IsoDate, currentWeekStart: IsoDate): string {
  if (weekStart === currentWeekStart) return 'Esta semana';
  if (weekStart === addDays(currentWeekStart, 7)) return 'Próxima semana';
  const weeksAgo = Math.round((Date.parse(currentWeekStart) - Date.parse(weekStart)) / (7 * 86_400_000));
  return weeksAgo === 1 ? 'Semana passada' : `${weeksAgo} semanas atrás`;
}

export function WeekNav({
  weekStart,
  currentWeekStart,
  minWeekStart,
  maxWeekStart,
  editable,
  disabled = false,
  onNavigate,
}: Props) {
  const previous = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  return (
    <nav className="week-nav" aria-label="Navegação entre semanas">
      <button
        type="button"
        className="icon-button"
        aria-label="Semana anterior"
        disabled={disabled || previous < minWeekStart}
        onClick={() => onNavigate(previous)}
      >
        ‹
      </button>
      <div className="week-title">
        <span className="week-relative">{relativeLabel(weekStart, currentWeekStart)}</span>
        <h2>{formatWeekRange(weekStart)}</h2>
      </div>
      <button
        type="button"
        className="icon-button"
        aria-label="Próxima semana"
        disabled={disabled || next > maxWeekStart}
        onClick={() => onNavigate(next)}
      >
        ›
      </button>
      <span className={editable ? 'badge is-editable' : 'badge'}>{editable ? 'editável' : 'somente visualização'}</span>
    </nav>
  );
}
