import { ReactNode } from 'react';

interface CalloutProps {
  tone?: 'note' | 'warn';
  title?: string;
  children: ReactNode;
}

/**
 * Short framing note. Flat — left bar + eyebrow label, no bubbles.
 */
export default function Callout({ tone = 'note', title, children }: CalloutProps) {
  const color = tone === 'warn' ? 'var(--amber)' : 'var(--accent)';
  const tint = tone === 'warn' ? 'var(--amber)' : 'var(--accent)';

  return (
    <aside
      className="my-6 pl-4 py-2"
      style={{ borderLeft: `2px solid ${color}` }}
    >
      {title && (
        <p
          className="mono mb-1"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tint,
          }}
        >
          {title}
        </p>
      )}
      <div
        className="text-[14px]"
        style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}
      >
        {children}
      </div>
    </aside>
  );
}
