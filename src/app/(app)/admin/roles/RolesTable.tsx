'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';

interface RoleRow {
  id: string;
  key: string;
  label: string;
  config: unknown;
}

export default function RolesTable({ roles }: { roles: RoleRow[] }) {
  const cols: Column<RoleRow>[] = [
    { key: 'key', header: 'Key', mono: true, cellStyle: { color: 'var(--ink)' }, cell: (r) => r.key, sortValue: (r) => r.key },
    { key: 'label', header: 'Label', cellStyle: { color: 'var(--ink)' }, cell: (r) => r.label, sortValue: (r) => r.label.toLowerCase() },
    {
      key: 'config',
      header: 'Config',
      mono: true,
      cellStyle: { color: 'var(--muted-2)', fontSize: 12 },
      cell: (r) => JSON.stringify(r.config),
    },
  ];
  return <DataTable columns={cols} rows={roles} getRowKey={(r) => r.id} empty="No roles yet." />;
}
