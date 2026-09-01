'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtDateTime } from '@/lib/format';
import { retryAndPump } from '@/lib/workflows/actions';

export interface FailedRun {
  id: string;
  created_at: string;
  title: string;
  error: string;
}

/** Failed submissions with a one-click retry (resumes from the failed step). */
export default function FailedRuns({ failed }: { failed: FailedRun[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (failed.length === 0) return null;

  function retry(id: string) {
    setBusy(id);
    startTransition(async () => {
      try {
        const result = await retryAndPump(id);
        if (result.status === 'done') toast.success('Run completed');
        else toast.error('Run still failing', { description: result.error });
      } catch (err) {
        toast.error('Retry failed', { description: err instanceof Error ? err.message : undefined });
      } finally {
        setBusy(null);
        router.refresh();
      }
    });
  }

  const cols: Column<FailedRun>[] = [
    {
      key: 'title',
      header: 'Submission',
      cell: (f) => (
        <div>
          <div style={{ color: 'var(--fg)' }}>{f.title}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            {fmtDateTime(f.created_at)} · {f.error}
          </div>
        </div>
      ),
      sortValue: (f) => f.created_at,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (f) => (
        <Button variant="ghost" size="sm" onClick={() => retry(f.id)} disabled={busy !== null}>
          {busy === f.id && <span className="spinner" aria-hidden />}
          {busy === f.id ? 'Retrying… (this can take minutes)' : 'Retry'}
        </Button>
      ),
    },
  ];

  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-3">
        <span className="zone-label" style={{ color: 'var(--crit)' }}>Failed runs</span>
        <span className="flex-1 divider" aria-hidden />
      </div>
      <DataTable columns={cols} rows={failed} getRowKey={(f) => f.id} empty="No failed runs." />
    </section>
  );
}
