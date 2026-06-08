import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';
import FieldValue from '@/components/fields/FieldValue';
import EmptyState from '@/components/ui/EmptyState';

/** A hairline register table. First column is the title (links to detail). */
export default function Register({
  rows,
  columns,
  basePath,
  entityLabel,
  icon,
}: {
  rows: NodeRow[];
  columns: FieldDef[];
  basePath: string;
  entityLabel?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  // Title is rendered as the linked first column; other columns follow.
  const rest = columns.filter((c) => c.key !== 'title');

  if (rows.length === 0) {
    const label = entityLabel ?? 'record';
    return (
      <EmptyState
        icon={icon}
        eyebrow="Register"
        title={`No ${label.toLowerCase()}s yet`}
        description={`Nothing has been logged here. Create the first ${label.toLowerCase()} to get started.`}
        action={{ label: `New ${label}`, href: `${basePath}/new` }}
      />
    );
  }

  return (
    <table className="w-full text-[14px] my-4" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['Title', ...rest.map((c) => c.label)].map((h) => (
            <th
              key={h}
              className="mono text-left"
              style={{
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
                padding: '10px 14px',
                background: 'var(--bg-alt)',
                borderBottom: '1px solid var(--line)',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const data = (row.data ?? {}) as Record<string, unknown>;
          return (
            <tr key={row.id}>
              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                <Link
                  href={`${basePath}/${row.id}`}
                  className="text-link"
                  style={{ fontWeight: 500 }}
                >
                  {(data.title as string) || 'Untitled'}
                </Link>
              </td>
              {rest.map((c) => (
                <td
                  key={c.key}
                  style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}
                >
                  <FieldValue field={c} value={data[c.key]} />
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
