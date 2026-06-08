import { ReactNode } from 'react';

interface FaqProps {
  q: string;
  children: ReactNode;
}

/**
 * Flat Q/A entry — no bubbles, no accent backgrounds. Question is the
 * h-text, answer is normal prose. Reads like a written FAQ list.
 */
export default function Faq({ q, children }: FaqProps) {
  return (
    <section
      className="py-5"
      style={{ borderBottom: '1px solid var(--line)' }}
    >
      <h3
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--ink)',
          letterSpacing: '-0.005em',
          margin: 0,
        }}
      >
        {q}
      </h3>
      <div
        className="mt-2 text-[14px]"
        style={{ color: 'var(--muted)', lineHeight: 1.65 }}
      >
        {children}
      </div>
    </section>
  );
}
