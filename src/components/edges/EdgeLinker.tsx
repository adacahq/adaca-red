'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveEdge, deleteEdge } from '@/lib/nodes/actions';
import Select from '@/components/ui/Select';

interface Linked { edgeId: string; targetId: string; targetTitle: string }
interface Option { id: string; title: string }

export default function EdgeLinker({
  nodeId,
  edgeType,
  direction,
  targetBasePath,
  linked,
  options,
  revalidatePath,
  addLabel = 'Link',
}: {
  nodeId: string;
  edgeType: string;
  direction: 'from' | 'to';
  targetBasePath: string;
  linked: Linked[];
  options: Option[];
  revalidatePath: string;
  addLabel?: string;
}) {
  const [sel, setSel] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    if (!sel) return;
    const from = direction === 'from' ? nodeId : sel;
    const to = direction === 'from' ? sel : nodeId;
    startTransition(async () => {
      await saveEdge({ type: edgeType, from, to, data: {}, changeNote: 'linked', revalidate: revalidatePath });
      setSel('');
      router.refresh();
    });
  }

  function remove(edgeId: string) {
    startTransition(async () => {
      await deleteEdge(edgeId, revalidatePath);
      router.refresh();
    });
  }

  return (
    <div className="my-4">
      {linked.length > 0 ? (
        <div className="mstones">
          {linked.map((l, i) => (
            <div key={l.edgeId} className="ms">
              <span className="id">{String(i + 1).padStart(2, '0')}</span>
              <Link href={`${targetBasePath}/${l.targetId}`} className="nm">
                {l.targetTitle}
              </Link>
              <button
                type="button"
                className="muted-link"
                title="Unlink"
                aria-label={`Unlink ${l.targetTitle}`}
                disabled={pending}
                onClick={() => remove(l.edgeId)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-[13px]" style={{ color: 'var(--muted)' }}>Nothing linked yet.</p>
      )}

      {options.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <Select
            ariaLabel="Link target"
            placeholder="Select…"
            value={sel}
            onChange={setSel}
            options={options.map((o) => ({ value: o.id, label: o.title }))}
          />
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending || !sel} onClick={add}>
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}
