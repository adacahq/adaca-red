'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
      {sorted.length > 0 ? (
        <div className="dive">
          {sorted.map((e, i) => (
            <div key={e.id} className={i === 0 ? 'dstop now' : 'dstop'}>
              <div className="flex items-center gap-3">
                <span className="dd">{formatDate(e.at)}</span>
                <button type="button" className="muted-link" title="Delete" aria-label="Delete entry" disabled={pending} onClick={() => remove(e.id)}>
                  ✕
                </button>
              </div>
              <RichTextView value={e.note ?? ''} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No timeline entries yet.</p>
      )}

      <div className="mt-6 flex flex-col gap-2" style={{ maxWidth: 560 }}>
        <div className="flex items-center gap-2">
          <DatePicker value={at} onChange={setAt} ariaLabel="Entry time" />
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>Markdown supported</span>
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
