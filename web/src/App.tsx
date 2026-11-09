import { useCallback, useEffect, useMemo, useState } from 'react';
import { isIsoDate, isoWeekday, todayIn } from '../../shared/dates.js';
import type { IsoDate, PersonSummary, WeekView } from '../../shared/types.js';
import { isWeekViewable, weekWindow } from '../../shared/window.js';
import { getPeople, saveWeek } from './api.js';
import { ConfirmBar } from './components/ConfirmBar.js';
import { DayCard } from './components/DayCard.js';
import { PersonPicker } from './components/PersonPicker.js';
import { WeekNav } from './components/WeekNav.js';
import { dayState, savedWeekDates } from './day-state.js';
import { usePerson } from './usePerson.js';
import { useWeek } from './useWeek.js';

function initialWeek(): IsoDate {
  const today = todayIn(new Date());
  const param = new URLSearchParams(window.location.search).get('week');
  if (param && isIsoDate(param) && isoWeekday(param) === 1 && isWeekViewable(param, today)) return param;
  return weekWindow(today).currentWeekStart;
}

function sameDates(a: ReadonlySet<IsoDate>, b: readonly IsoDate[]): boolean {
  return a.size === b.length && b.every((date) => a.has(date));
}

export function App() {
  const [people, setPeople] = useState<PersonSummary[] | null>(null);
  const [peopleError, setPeopleError] = useState(false);
  const [personId, setPersonId] = usePerson(people);
  const [weekStart, setWeekStart] = useState<IsoDate>(initialWeek);
  const { view, error, reload, setView } = useWeek(weekStart, personId);
  const [selection, setSelection] = useState<Set<IsoDate>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);
  const [violations, setViolations] = useState<Record<IsoDate, string>>({});

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .catch(() => setPeopleError(true));
  }, []);

  const resetFrom = useCallback((next: WeekView | null) => {
    setSelection(new Set(next ? savedWeekDates(next) : []));
    setDirty(false);
  }, []);

  useEffect(() => {
    if (!dirty) resetFrom(view);
  }, [view, dirty, resetFrom]);

  useEffect(() => {
    setDirty(false);
    setMessage(null);
    setViolations({});
  }, [weekStart, personId]);

  const navigate = (next: IsoDate) => {
    const url = new URL(window.location.href);
    url.searchParams.set('week', next);
    window.history.replaceState(null, '', url);
    setWeekStart(next);
  };

  const me = useMemo(() => people?.find((person) => person.id === personId) ?? null, [people, personId]);

  const toggle = (date: IsoDate) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      if (view) setDirty(!sameDates(next, savedWeekDates(view)));
      return next;
    });
    setMessage(null);
    setViolations({});
  };

  const confirm = async () => {
    if (personId === null || !view) return;
    setSaving(true);
    setMessage(null);
    try {
      const outcome = await saveWeek(weekStart, personId, [...selection].sort());
      if (outcome.ok) {
        setView(outcome.view);
        resetFrom(outcome.view);
        setViolations({});
        setMessage({ text: 'Escala salva.', tone: 'success' });
      } else {
        setViolations(Object.fromEntries(outcome.violations.map((v) => [v.date, v.message])));
        setMessage({ text: 'Não deu para salvar. Veja os dias destacados.', tone: 'error' });
        resetFrom(await reload());
      }
    } catch {
      setMessage({ text: 'Erro ao salvar. Tente de novo.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            HV
          </span>
          <div>
            <h1>Home Verdes</h1>
            <p className="brand-sub">Escala de home office do time</p>
          </div>
        </div>
        {people ? <PersonPicker people={people} personId={personId} onChange={setPersonId} /> : null}
      </header>

      {peopleError ? <p className="notice notice-error">Não foi possível carregar o time. Recarregue a página.</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      {view ? (
        <>
          <WeekNav
            weekStart={view.weekStart}
            currentWeekStart={view.currentWeekStart}
            minWeekStart={view.minWeekStart}
            maxWeekStart={view.maxWeekStart}
            editable={view.editable}
            onNavigate={navigate}
          />
          {personId === null && view.editable ? (
            <p className="notice notice-info">Escolha seu nome no topo para marcar seus dias.</p>
          ) : null}
          <section className="week-grid">
            {view.days.map((day) => (
              <DayCard
                key={day.date}
                day={day}
                me={me}
                selected={selection.has(day.date)}
                isToday={day.date === view.today}
                state={personId === null ? null : dayState(day, view, personId, selection)}
                violation={violations[day.date]}
                onToggle={() => toggle(day.date)}
              />
            ))}
          </section>
          {personId !== null && view.editable ? (
            <ConfirmBar
              dirty={dirty}
              saving={saving}
              message={message?.text ?? null}
              messageTone={message?.tone ?? null}
              onConfirm={confirm}
              onReset={() => resetFrom(view)}
            />
          ) : null}
        </>
      ) : !error ? (
        <div className="loading" aria-busy="true">
          <p className="notice">Carregando a escala. Se o servidor estiver dormindo, pode levar até um minuto.</p>
          <div className="week-grid">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="day skeleton" />
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
