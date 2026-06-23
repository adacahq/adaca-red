import type { ComponentType, SVGProps } from 'react';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';
import EmptyState from '@/components/ui/EmptyState';
import RegisterTable from './RegisterTable';

/** A hairline register table (sortable columns). Empty → on-brand empty state. */
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

  return <RegisterTable rows={rows} columns={columns} basePath={basePath} />;
}
