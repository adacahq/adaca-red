'use client';

import Link from 'next/link';
import DataTable, { type Column } from '@/components/ui/DataTable';

export interface PortfolioRow {
  id: string;
  title: string;
  status: string;
  covers: number;
  avg: number;
}

export default function PortfolioTable({ rows }: { rows: PortfolioRow[] }) {
  const cols: Column<PortfolioRow>[] = [
    {
      key: 'title',
      header: 'Initiative',
      cell: (r) => (
        <Link href={`/initiatives/${r.id}`} className="text-link" style={{ fontWeight: 500 }}>
          {r.title}
        </Link>
      ),
      sortValue: (r) => r.title.toLowerCase(),
    },
    {
      key: 'status',
      header: 'Status',
      mono: true,
      cellStyle: { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' },
      cell: (r) => r.status,
      sortValue: (r) => r.status,
    },
    {
      key: 'covers',
      header: 'Risks covered',
      cell: (r) => <span style={{ color: 'var(--muted)' }}>{r.covers}</span>,
      sortValue: (r) => r.covers,
    },
    {
      key: 'avg',
      header: 'Avg RED',
      mono: true,
      cellStyle: { color: 'var(--ink)' },
      cell: (r) => `${r.avg}/12`,
      sortValue: (r) => r.avg,
    },
  ];
  return <DataTable columns={cols} rows={rows} getRowKey={(r) => r.id} empty="No initiatives yet." />;
}
