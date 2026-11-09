const CHIP_WIDTHS = [
  [72, 96],
  [88],
  [64, 80, 70],
  [],
  [92, 60],
] as const;

export function WeekSkeleton() {
  return (
    <div className="week-skeleton" aria-busy="true" aria-label="Carregando a escala">
      <div className="week-nav">
        <span className="sk sk-icon" />
        <div className="week-title">
          <span className="sk sk-line" style={{ width: 90, height: 10 }} />
          <span className="sk sk-line" style={{ width: 130, height: 18, marginTop: 6 }} />
        </div>
        <span className="sk sk-icon" />
      </div>
      <div className="week-grid">
        {CHIP_WIDTHS.map((chips, i) => (
          <div key={i} className="day day-skeleton">
            <span className="sk sk-line" style={{ width: '55%', height: 16 }} />
            <span className="sk sk-line" style={{ width: '100%', height: 6 }} />
            <span className="sk sk-line" style={{ width: '45%', height: 12 }} />
            <span className="day-people">
              {chips.length === 0 ? (
                <span className="sk sk-line" style={{ width: '40%', height: 12 }} />
              ) : (
                chips.map((width, j) => <span key={j} className="sk sk-chip" style={{ width }} />)
              )}
            </span>
            <span className="sk sk-block" />
          </div>
        ))}
      </div>
    </div>
  );
}
