'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { XMarkIcon } from '@heroicons/react/20/solid';
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
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid var(--line)' }}>
        {linked.map((l) => (
          <li
            key={l.edgeId}
            className="flex items-center gap-3 py-2.5"
            style={{ borderBottom: '1px solid var(--line)' }}
          >
            <Link href={`${targetBasePath}/${l.targetId}`} className="text-link" style={{ flex: 1 }}>
              {l.targetTitle}
            </Link>
            <button type="button" className="muted-link" title="Unlink" disabled={pending} onClick={() => remove(l.edgeId)}>
              <XMarkIcon className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
        {linked.length === 0 && (
          <li className="py-2.5 text-[13px]" style={{ color: 'var(--muted-2)' }}>
            Nothing linked yet.
          </li>
        )}
      </ul>

      {options.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
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
