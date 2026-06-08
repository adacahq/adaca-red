'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/20/solid';
import RedScore from './RedScore';
import MitigationModal from './MitigationModal';

interface EdgeView { id: string; initiativeId: string; initiativeTitle: string; data: unknown }
interface Option { id: string; title: string }

export default function RiskMitigationsList({
  riskId,
  edges,
  initiativeOptions,
  revalidatePath,
}: {
  riskId: string;
  edges: EdgeView[];
  initiativeOptions: Option[];
  revalidatePath: string;
}) {
  const [modal, setModal] = useState<{ edge?: EdgeView } | null>(null);

  return (
    <>
      <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', borderTop: '1px solid var(--line)' }}>
        {edges.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--line)' }}>
            <Link href={`/initiatives/${e.initiativeId}`} className="text-link" style={{ flex: 1, fontWeight: 500 }}>
              {e.initiativeTitle}
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
            No initiative is mitigating this risk yet.
          </li>
        )}
      </ul>

      {initiativeOptions.length > 0 && (
        <button type="button" className="btn btn-ghost btn-sm mt-4" onClick={() => setModal({})}>
          <PlusIcon className="h-4 w-4" /> Add a mitigating initiative
        </button>
      )}

      {modal && (
        <MitigationModal
          open
          onClose={() => setModal(null)}
          fixed={{ role: 'risk', id: riskId }}
          options={initiativeOptions}
          edge={modal.edge ? { id: modal.edge.id, otherId: modal.edge.initiativeId, data: modal.edge.data } : null}
          revalidatePath={revalidatePath}
        />
      )}
    </>
  );
}
