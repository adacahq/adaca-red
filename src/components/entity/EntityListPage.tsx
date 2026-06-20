import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/20/solid';
import { createClient } from '@/lib/supabase/server';
import { getDefinition, filterableFields, fieldsOf, nodeConfig } from '@/lib/definitions/server';
import { listNodes } from '@/lib/nodes/queries';
import { iconFor } from '@/lib/views/icons';
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

  return (
    <div className="">
      <div className="mb-2 flex items-center gap-3">
        <span
          className="mono"
          style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-2)', textTransform: 'uppercase' }}
        >
          Register
        </span>
        <span className="divider" style={{ flex: 1 }} aria-hidden />
        <ExportButton typeKey={typeKey} entityLabel={def.label} fields={fieldsOf(def)} />
        <Link href={`${basePath}/new`} className="btn btn-primary btn-sm">
          <PlusIcon className="h-4 w-4" aria-hidden /> New
        </Link>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
        {title}
      </h1>

      <div className="mt-6">
        <FilterBar fields={cols} />
        <Register
          rows={rows}
          columns={cols}
          basePath={basePath}
          entityLabel={def.label}
          icon={iconFor(nodeConfig(def).icon)}
        />
      </div>
    </div>
  );
}
