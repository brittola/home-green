import { addDays, formatWeekRange } from '../../../shared/dates.js';
import type { IsoDate } from '../../../shared/types.js';

interface Props {
  weekStart: IsoDate;
  minWeekStart: IsoDate;
  maxWeekStart: IsoDate;
  editable: boolean;
  onNavigate: (weekStart: IsoDate) => void;
}

export function WeekNav({ weekStart, minWeekStart, maxWeekStart, editable, onNavigate }: Props) {
  const previous = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  return (
    <div className="week-nav">
      <button
        type="button"
        aria-label="Semana anterior"
        disabled={previous < minWeekStart}
        onClick={() => onNavigate(previous)}
      >
        ←
      </button>
      <h2>Semana {formatWeekRange(weekStart)}</h2>
      <button type="button" aria-label="Próxima semana" disabled={next > maxWeekStart} onClick={() => onNavigate(next)}>
        →
      </button>
      <span className={editable ? 'badge badge-editable' : 'badge badge-readonly'}>
        {editable ? 'editável' : 'somente visualização'}
      </span>
    </div>
  );
}
