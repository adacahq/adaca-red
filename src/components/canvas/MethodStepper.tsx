import { ReactNode } from 'react';

export interface Step {
  label: string;
  description?: ReactNode;
  /** Optional small annotation rendered above the number (e.g. "Day 1") */
  annotation?: string;
}

interface MethodStepperProps {
  steps: Step[];
  /** Optional eyebrow above the stepper */
  title?: string;
}

/**
 * Horizontal numbered stepper. Each step is a column with a mono number,
 * label, and optional description. Connected by a hairline rule. Wraps
 * to a vertical stack on narrow screens.
 */
export default function MethodStepper({ steps, title }: MethodStepperProps) {
  return (
    <section className="my-12">
      {title && (
        <p
          className="mono mb-4"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </p>
      )}
      <div
        className="grid gap-x-px gap-y-4"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          background: 'var(--line)',
          border: '1px solid var(--line)',
        }}
      >
        {steps.map((step, i) => {
          const idx = String(i + 1).padStart(2, '0');
          return (
            <div
              key={`${step.label}-${i}`}
              className="relative p-4 flex flex-col gap-2"
              style={{ background: 'var(--bg)' }}
            >
              {step.annotation && (
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: '0.14em',
                    color: 'var(--muted-2)',
                    textTransform: 'uppercase',
                  }}
                >
                  {step.annotation}
                </span>
              )}
              <div className="flex items-baseline gap-2">
                <span
                  className="mono"
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    color: 'var(--accent)',
                    lineHeight: 1,
                  }}
                >
                  {idx}
                </span>
                <span
                  aria-hidden
                  className="hidden sm:inline-block"
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'var(--line)',
                    marginLeft: 4,
                    transform: 'translateY(-3px)',
                  }}
                />
              </div>
              <p
                className="mono"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  color: 'var(--ink)',
                  textTransform: 'uppercase',
                  margin: 0,
                }}
              >
                {step.label}
              </p>
              {step.description && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                  }}
                >
                  {step.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
