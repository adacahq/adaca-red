import { ReactNode } from 'react';

export interface ProfileFact {
  label: string;
  value: string;
}

export interface Signal {
  text: ReactNode;
}

interface ProfilePanelProps {
  facts: ProfileFact[];
  signals: Signal[];
  /** Eyebrow over the left (facts) column. Default "Profile". */
  factsTitle?: string;
  /** Eyebrow over the right (signals) column. Default "Positive signals". */
  signalsTitle?: string;
}

/**
 * Two-column panel. Left: a mono label/value definition list. Right: a
 * list of accent-dotted signal lines. Single hairline frame, no fills.
 * Generalised from the Adaca One ICP profile.
 */
export default function ProfilePanel({
  facts,
  signals,
  factsTitle = 'Profile',
  signalsTitle = 'Positive signals',
}: ProfilePanelProps) {
  return (
    <section
      className="my-12 grid grid-cols-1 md:grid-cols-2"
      style={{ border: '1px solid var(--line)' }}
    >
      {/* Facts column */}
      <div className="p-6" style={{ borderBottom: '1px solid var(--line)' }}>
        <p
          className="mono mb-4"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: 'var(--muted-2)',
            textTransform: 'uppercase',
          }}
        >
          {factsTitle}
        </p>
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 gap-x-4">
          {facts.map((f) => (
            <div key={f.label} className="contents">
              <dt
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  paddingTop: 2,
                }}
              >
                {f.label}
              </dt>
              <dd style={{ fontSize: 14, color: 'var(--ink)' }}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Signals column */}
      <div
        className="p-6"
        style={{ borderTop: 'none', borderLeft: '1px solid var(--line)' }}
      >
        <p
          className="mono mb-4"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: 'var(--accent)',
            textTransform: 'uppercase',
          }}
        >
          {signalsTitle}
        </p>
        <ul className="flex flex-col gap-3">
          {signals.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  marginTop: 7,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.55 }}>
                {s.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
