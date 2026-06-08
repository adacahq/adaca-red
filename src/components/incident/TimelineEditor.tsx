'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '@heroicons/react/20/solid';
import { saveNode, deleteNode } from '@/lib/nodes/actions';
import { formatDate } from '@/lib/format';
import RichTextView from '@/components/rich-text/RichTextView';
import RichText from '@/components/rich-text/RichText';
import DatePicker from '@/components/ui/DatePicker';

interface Entry { id: string; at: string | null; note: string | null }

export default function TimelineEditor({
  incidentId,
  entries,
  revalidatePath,
}: {
  incidentId: string;
  entries: Entry[];
  revalidatePath: string;
}) {
  const [at, setAt] = useState('');
  const [note, setNote] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const sorted = [...entries].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  function add() {
    if (!note.trim()) return;
    startTransition(async () => {
      await saveNode({
        type: 'incident_update',
        parent: incidentId,
        data: { at: at || null, note: note.trim() },
        changeNote: 'timeline entry',
        revalidate: revalidatePath,
      });
      setAt('');
      setNote('');
      setEditorKey((k) => k + 1); // remount the editor so it clears
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteNode(id, revalidatePath);
      router.refresh();
    });
  }

  return (
    <div className="my-4">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderLeft: '2px solid var(--line)' }}>
        {sorted.map((e) => (
          <li key={e.id} className="relative pl-5 pb-5">
            <span
              aria-hidden
              style={{ position: 'absolute', left: -5, top: 4, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}
            />
            <div className="flex items-center gap-3">
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(e.at)}</span>
              <button type="button" className="muted-link" title="Delete" disabled={pending} onClick={() => remove(e.id)}>
                <TrashIcon className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <RichTextView value={e.note ?? ''} />
          </li>
        ))}
        {sorted.length === 0 && (
          <li className="pl-5 pb-2 text-[13px]" style={{ color: 'var(--muted-2)' }}>
            No timeline entries yet.
          </li>
        )}
      </ul>

      <div className="mt-2 flex flex-col gap-2" style={{ maxWidth: 560 }}>
        <div className="flex items-center gap-2">
          <DatePicker value={at} onChange={setAt} ariaLabel="Entry time" />
          <span className="text-[12px]" style={{ color: 'var(--muted-2)' }}>Markdown supported</span>
        </div>
        <RichText key={editorKey} value="" onChange={setNote} />
        <div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending || !note.trim()} onClick={add}>
            Add entry
          </button>
        </div>
      </div>
    </div>
  );
}
