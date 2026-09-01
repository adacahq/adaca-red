import Link from 'next/link';
import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getDefinition, filterableFields, fieldsOf, nodeConfig } from '@/lib/definitions/server';
import { listNodes } from '@/lib/nodes/queries';
import { iconFor, NodeTypeIcon } from '@/lib/views/icons';
import FilterBar from './FilterBar';
import Register from './Register';
import ExportButton from './ExportButton';

type SP = Record<string, string | string[] | undefined>;

function flatten(sp: SP): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) out[k] = val;
  }
  return out;
}

export default async function EntityListPage({
  typeKey,
  basePath,
  title,
  searchParams,
}: {
  typeKey: string;
  basePath: string;
  title: string;
  searchParams: SP;
}) {
  const supabase = await createClient();
  const def = await getDefinition(supabase, typeKey);
  if (!def) return <p style={{ color: 'var(--muted)' }}>Unknown type: {typeKey}</p>;

  const filters = flatten(searchParams);
  const rows = await listNodes(supabase, typeKey, filters);
  const cols = filterableFields(def);
  const count = rows.length;
  const word = count === 1 ? def.label.toLowerCase() : title.toLowerCase();
  const iconName = nodeConfig(def).icon;

  return (
    <div>
      <p className="eyebrow rv">Register</p>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h1 className="view-title rv flex items-center gap-3" style={{ '--i': 1 } as CSSProperties}>
          {/* The register list-header icon (spec exception): a static component
              (NodeTypeIcon) so resolving it doesn't read as "creating a
              component during render" (react-hooks/static-components). */}
          <NodeTypeIcon name={iconName} aria-hidden style={{ width: 30, height: 30, color: 'var(--accent)', flexShrink: 0 }} />
          {title}
        </h1>
        <span className="rv flex items-center gap-3" style={{ '--i': 2 } as CSSProperties}>
          <ExportButton typeKey={typeKey} entityLabel={def.label} fields={fieldsOf(def)} />
          <Link href={`${basePath}/new`} className="btn btn-primary sm">
            New {def.label}
          </Link>
        </span>
      </div>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        {count} {word} on record. Filter by any tracked field, or open one for the full detail.
      </p>

      <div className="mt-10">
        <FilterBar fields={cols} />
        <Register rows={rows} columns={cols} basePath={basePath} entityLabel={def.label} icon={iconFor(iconName)} />
      </div>
    </div>
  );
}
