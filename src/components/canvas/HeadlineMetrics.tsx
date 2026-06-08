export interface Metric {
  label: string;
  value: string;
  note?: string;
}

interface HeadlineMetricsProps {
  metrics: Metric[];
}

/**
 * Big numbers across in a hairline grid. Borders only — no background
 * fills. Container carries top + left; cells carry right + bottom
 * internal lines.
 */
export default function HeadlineMetrics({ metrics }: HeadlineMetricsProps) {
  return (
    <section
      className="my-12 grid grid-cols-1 sm:grid-cols-3"
      style={{
        borderTop: '1px solid var(--line)',
        borderLeft: '1px solid var(--line)',
      }}
    >
      {metrics.map((m) => (
        <div
          key={m.label}
          className="p-5"
          style={{
            background: 'transparent',
            borderRight: '1px solid var(--line)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <p
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.12em',
              color: 'var(--muted-2)',
              textTransform: 'uppercase',
            }}
          >
            {m.label}
          </p>
          <p
            className="mono"
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              marginTop: 6,
              lineHeight: 1.1,
            }}
          >
            {m.value}
          </p>
          {m.note && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {m.note}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
