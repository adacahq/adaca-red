export interface Metric {
  label: string;
  value: string;
  note?: string;
}

interface HeadlineMetricsProps {
  metrics: Metric[];
  /**
   * `stats` — the hairline strip (`.stats`/`.stat`), which auto-fits however
   * many measures it is given. `slates` — the floating figures
   * (`.slates`/`.slate`), which give a `note` line room to breathe and don't
   * leave empty cells when there are fewer than three metrics. Default 'stats'.
   */
  variant?: 'stats' | 'slates';
}

/** Big numbers, canvas idiom: `.stats` for a clean fixed grid of measures,
 *  `.slates` when a note line (e.g. "42% covered") needs room. */
export default function HeadlineMetrics({ metrics, variant = 'stats' }: HeadlineMetricsProps) {
  if (variant === 'slates') {
    return (
      <div className="slates">
        {metrics.map((m) => (
          <div key={m.label} className="slate">
            <b>{m.value}</b>
            <span>{m.label}</span>
            {m.note && <span className="ssub">{m.note}</span>}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stats">
      {metrics.map((m) => (
        <div key={m.label} className="stat">
          <b>{m.value}</b>
          <span>{m.label}</span>
          {m.note && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{m.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}
