'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/20/solid';
import RedScore from './RedScore';
import MitigationModal from './MitigationModal';

interface EdgeView { id: string; riskId: string; riskTitle: string; data: unknown }
interface RiskOption { id: string; title: string }

export default function MitigationManager({
  initiativeId,
  edges,
  riskOptions,
  revalidatePath,
}: {
  initiativeId: string;
  edges: EdgeView[];
  riskOptions: RiskOption[];
  revalidatePath: string;
}) {
  const [modal, setModal] = useState<{ edge?: EdgeView } | null>(null);

  return (
    <div className="my-4">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid var(--line)' }}>
        {edges.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
            <Link href={`/risks/${e.riskId}`} className="text-link" style={{ flex: 1, fontWeight: 500 }}>
              {e.riskTitle}
            </Link>
            <RedScore data={e.data} />
            <button
              type="button"
              className="muted-link mono"
              style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
              onClick={() => setModal({ edge: e })}
            >
              Edit
            </button>
          </li>
        ))}
        {edges.length === 0 && (
          <li className="py-3 text-[13px]" style={{ color: 'var(--muted-2)' }}>
            This initiative doesn&rsquo;t mitigate any risks yet.
          </li>
        )}
      </ul>

      {riskOptions.length > 0 && (
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setModal({})}>
          <PlusIcon className="h-4 w-4" /> Mitigate a risk
        </button>
      )}

      {modal && (
        <MitigationModal
          open
          onClose={() => setModal(null)}
          fixed={{ role: 'initiative', id: initiativeId }}
          options={riskOptions}
          edge={modal.edge ? { id: modal.edge.id, otherId: modal.edge.riskId, data: modal.edge.data } : null}
          revalidatePath={revalidatePath}
        />
      )}
    </div>
  );
}
