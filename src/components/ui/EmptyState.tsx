import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/20/solid';
import type { ComponentType, SVGProps } from 'react';

export interface EmptyStateAction {
  label: string;
  href: string;
}

/**
 * On-brand empty state: a hairline panel over the dot-grid, a framed icon, an
 * eyebrow, a headline, a line of guidance, and an optional primary action.
 * Used wherever a list or panel has nothing to show yet.
 */
export default function EmptyState({
  icon: Icon,
  eyebrow = 'Empty',
  title,
  description,
  action,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  return (
    <div
      className="canvas-grid relative my-4 flex flex-col items-center justify-center text-center"
      style={{
        border: '1px solid var(--line)',
        padding: '56px 24px',
        background: 'var(--bg-alt)',
      }}
    >
      {Icon && (
        <span
          aria-hidden
          className="mb-5 inline-flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            border: '1px solid var(--line-strong)',
            color: 'var(--accent)',
            background: 'var(--bg)',
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}

      <span
        className="mono"
        style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-2)' }}
      >
        {eyebrow}
      </span>

      <h3
        className="mt-2"
        style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}
      >
        {title}
      </h3>

      {description && (
        <p
          className="mt-2"
          style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 420 }}
        >
          {description}
        </p>
      )}

      {action && (
        <Link href={action.href} className="btn btn-primary btn-sm mt-6">
          <PlusIcon className="h-4 w-4" aria-hidden /> {action.label}
        </Link>
      )}
    </div>
  );
}
