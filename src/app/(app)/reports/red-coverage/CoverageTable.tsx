'use client';

import Link from 'next/link';
import DataTable, { type Column } from '@/components/ui/DataTable';

export interface CoverageRow {
  id: string;
  title: string;
  count: number;
  coverage: number;
}

export default function CoverageTable({ rows }: { rows: CoverageRow[] }) {
  const cols: Column<CoverageRow>[] = [
    {
      key: 'title',
      header: 'Risk',
      cell: (r) => (
        <Link href={`/risks/${r.id}`} className="text-link" style={{ fontWeight: 500 }}>
          {r.title}
        </Link>
      ),
      sortValue: (r) => r.title.toLowerCase(),
    },
    {
      key: 'count',
      header: 'Mitigations',
      cell: (r) => <span style={{ color: 'var(--muted)' }}>{r.count}</span>,
      sortValue: (r) => r.count,
    },
    {
      key: 'coverage',
      header: 'Coverage',
      cell: (r) => (
        <span
          className="mono"
          style={{ fontSize: 12, color: r.coverage < 33 ? 'var(--red-ink)' : r.coverage < 66 ? 'var(--amber-ink)' : 'var(--green-ink)' }}
        >
          {r.coverage}%
        </span>
      ),
      sortValue: (r) => r.coverage,
    },
  ];
  return <DataTable columns={cols} rows={rows} getRowKey={(r) => r.id} empty="No risks yet." />;
}
