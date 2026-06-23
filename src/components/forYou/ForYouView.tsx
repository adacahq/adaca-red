'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cog6ToothIcon } from '@heroicons/react/20/solid';
import DataTable, { type Column } from '@/components/ui/DataTable';
import FieldValue from '@/components/fields/FieldValue';
import { sortValueFor } from '@/components/entity/RegisterTable';
import EmptyState from '@/components/ui/EmptyState';
import { routeFor } from '@/lib/nodes/routes';
import { saveForYouConfig } from '@/lib/forYou/actions';
import type { ForYouConfig as Config, ForYouItem } from '@/lib/forYou/types';
import type { FieldDef } from '@/lib/supabase/types';
import ForYouConfig, { type ColumnOption } from './ForYouConfig';

export interface TypeMeta {
  label: string;
  fields: FieldDef[];
}

const EMPTY = <span style={{ color: 'var(--muted-2)' }}>–</span>;

/** Available columns across the For-You types: Type, Title, then the union of
 *  every other field key (label from the first type that declares it). */
function buildColumns(typeMeta: Record<string, TypeMeta>): ColumnOption[] {
  const map = new Map<string, string>();
  map.set('__type', 'Type');
  for (const m of Object.values(typeMeta)) {
    const t = m.fields.find((f) => f.key === 'title');
    if (t && !map.has('title')) map.set('title', t.label);
  }
  for (const m of Object.values(typeMeta)) {
    for (const f of m.fields) {
      if (f.key === 'title' || map.has(f.key)) continue;
      map.set(f.key, f.label);
    }
  }
  return [...map.entries()].map(([key, label]) => ({ key, label }));
}

export default function ForYouView({
  items,
  typeMeta,
  initialConfig,
}: {
  items: ForYouItem[];
  typeMeta: Record<string, TypeMeta>;
  initialConfig: Config;
}) {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [configOpen, setConfigOpen] = useState(false);

  const typeKeys = Object.keys(typeMeta);
  const available = buildColumns(typeMeta);
  const labelOf = Object.fromEntries(available.map((c) => [c.key, c.label]));
  const fieldOf = (typeKey: string, key: string) => typeMeta[typeKey]?.fields.find((f) => f.key === key);

  // No type has a "For You" field yet — guide the admin instead of an empty grid.
  if (typeKeys.length === 0) {
    return (
      <EmptyState
        eyebrow="For You"
        title="No For-You fields yet"
        description="Add a user (or multi-user) field to a type in Admin → Definitions and tick “for you”. Items where you’re that person will appear here."
      />
    );
  }

  const includedTypes = config.types ?? typeKeys;
  const visible = items.filter((i) => includedTypes.includes(i.typeKey));
  const availableKeys = available.map((c) => c.key);
  const displayed = config.columns ? config.columns.filter((k) => availableKeys.includes(k)) : availableKeys;

  const cols: Column<ForYouItem>[] = displayed.map((key): Column<ForYouItem> => {
    if (key === '__type') {
      return {
        key,
        header: 'Type',
        mono: true,
        cell: (r) => typeMeta[r.typeKey]?.label ?? r.typeKey,
        sortValue: (r) => typeMeta[r.typeKey]?.label ?? r.typeKey,
      };
    }
    if (key === 'title') {
      return {
        key,
        header: labelOf['title'] ?? 'Title',
        cell: (r) => (
          <Link href={`${routeFor(r.typeKey)}/${r.id}`} className="text-link" style={{ fontWeight: 500 }}>
            {(r.data.title as string) || 'Untitled'}
          </Link>
        ),
        sortValue: (r) => String((r.data.title as string) ?? '').toLowerCase(),
      };
    }
    return {
      key,
      header: labelOf[key] ?? key,
      cell: (r) => {
        const f = fieldOf(r.typeKey, key);
        return f ? <FieldValue field={f} value={r.data[key]} /> : EMPTY;
      },
      sortValue: (r) => {
        const f = fieldOf(r.typeKey, key);
        return f ? sortValueFor(f, r.data[key]) : '';
      },
    };
  });

  function save(next: Config) {
    setConfig(next);
    void saveForYouConfig(next);
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfigOpen(true)}>
          <Cog6ToothIcon className="h-4 w-4" aria-hidden /> Configure
        </button>
      </div>

      <DataTable
        columns={cols}
        rows={visible}
        getRowKey={(r) => `${r.typeKey}:${r.id}`}
        empty="Nothing is assigned to you yet."
      />

      <ForYouConfig
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        typeOptions={typeKeys.map((k) => ({ key: k, label: typeMeta[k].label }))}
        columnOptions={available}
        config={config}
        onSave={save}
      />
    </div>
  );
}
