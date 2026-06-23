'use client';

import Link from 'next/link';
import FieldValue from '@/components/fields/FieldValue';
import { getChoices } from '@/lib/definitions/choices';
import DataTable, { type Column } from '@/components/ui/DataTable';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';

/** Type-aware sort key: numbers numeric, dates chronological, enums in their
 *  declared choice order (not alphabetical), everything else case-insensitive. */
export function sortValueFor(field: FieldDef, value: unknown): string | number {
  if (value === null || value === undefined || value === '') return '';
  switch (field.data_type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value ? 1 : 0;
    case 'date': {
      const t = Date.parse(String(value));
      return Number.isNaN(t) ? String(value) : t;
    }
    case 'enum': {
      const i = getChoices(field).findIndex((c) => c.key === String(value));
      return i === -1 ? String(value) : i;
    }
    default:
      return String(value).toLowerCase();
  }
}

/** Client, sortable register table built from a node type's filterable fields. */
export default function RegisterTable({
  rows,
  columns,
  basePath,
}: {
  rows: NodeRow[];
  columns: FieldDef[];
  basePath: string;
}) {
  const data = (row: NodeRow) => (row.data ?? {}) as Record<string, unknown>;
  const rest = columns.filter((c) => c.key !== 'title');

  const cols: Column<NodeRow>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (row) => (
        <Link href={`${basePath}/${row.id}`} className="text-link" style={{ fontWeight: 500 }}>
          {(data(row).title as string) || 'Untitled'}
        </Link>
      ),
      sortValue: (row) => String((data(row).title as string) ?? '').toLowerCase(),
    },
    ...rest.map((c): Column<NodeRow> => ({
      key: c.key,
      header: c.label,
      cell: (row) => <FieldValue field={c} value={data(row)[c.key]} />,
      sortValue: (row) => sortValueFor(c, data(row)[c.key]),
    })),
  ];

  return <DataTable columns={cols} rows={rows} getRowKey={(r) => r.id} className="my-4" />;
}
