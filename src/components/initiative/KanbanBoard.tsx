'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/20/solid';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';
import { saveNode, reorderNodes } from '@/lib/nodes/actions';
import Select from '@/components/ui/Select';
import Chip from '@/components/entity/Chips';
import NodeEditModal from '@/components/entity/NodeEditModal';

const ALL = '__all__';

interface Task {
  id: string;
  title: string;
  status: string;
  parentId: string;
  data: Record<string, unknown>;
}
interface Container { id: string; label: string; dividerBefore?: boolean }

export default function KanbanBoard({
  initiativeId,
  containers,
  tasks,
  statuses,
  taskFields,
  revalidatePath,
}: {
  initiativeId: string;
  containers: Container[];
  tasks: Task[];
  statuses: string[];
  taskFields: FieldDef[];
  revalidatePath: string;
}) {
  const router = useRouter();
  const [container, setContainer] = useState(containers[0]?.id ?? ALL);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Manual order of all task ids; persisted to `position` (also drives the Tasks list).
  const [order, setOrder] = useState<string[]>(() => tasks.map((t) => t.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ col: string; index: number } | null>(null);
  const [edit, setEdit] = useState<Task | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [, startTransition] = useTransition();

  // Re-sync to server order whenever the task set or its order changes (e.g. after
  // a save + refresh). Render-phase adjustment, guarded — no effect needed.
  const propIds = tasks.map((t) => t.id).join(',');
  const [syncedIds, setSyncedIds] = useState(propIds);
  if (propIds !== syncedIds) {
    setSyncedIds(propIds);
    setOrder(tasks.map((t) => t.id));
    setOverrides({});
  }

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const orderIdx = new Map(order.map((id, i) => [id, i]));
  const oi = (id: string) => orderIdx.get(id) ?? 0;

  const addParent = container === ALL ? initiativeId : container;
  const labelByContainer = Object.fromEntries(containers.map((c) => [c.id, c.label]));
  const containerTag = (t: Task) =>
    container === ALL && t.parentId !== initiativeId ? labelByContainer[t.parentId] : null;

  const displayStatus = (t: Task) => overrides[t.id] ?? t.status;
  const inContainer = container === ALL ? tasks : tasks.filter((t) => t.parentId === container);
  const bucketOf = (t: Task) => (statuses.includes(displayStatus(t)) ? displayStatus(t) : '');
  const hasNoStatus = inContainer.some((t) => !statuses.includes(displayStatus(t)));
  const columns = hasNoStatus ? ['', ...statuses] : statuses;
  const cardsIn = (col: string) =>
    inContainer.filter((t) => bucketOf(t) === col).sort((a, b) => oi(a.id) - oi(b.id));

  function handleDrop(col: string, index: number) {
    const t = dragId ? byId.get(dragId) : null;
    setDragId(null);
    setDragOver(null);
    if (!t) return;

    const changedStatus = col !== '' && displayStatus(t) !== col;
    const colIds = cardsIn(col).filter((x) => x.id !== t.id).map((x) => x.id);
    const clamped = Math.max(0, Math.min(index, colIds.length));

    // Where to slot the dragged id within the global order.
    const without = order.filter((id) => id !== t.id);
    let insertAt: number;
    if (colIds.length === 0) {
      const siblings = inContainer.filter((x) => x.id !== t.id).sort((a, b) => oi(a.id) - oi(b.id));
      const last = siblings[siblings.length - 1]?.id;
      insertAt = last ? without.indexOf(last) + 1 : without.length;
    } else if (clamped >= colIds.length) {
      insertAt = without.indexOf(colIds[colIds.length - 1]) + 1;
    } else {
      insertAt = without.indexOf(colIds[clamped]);
    }
    const newOrder = [...without.slice(0, insertAt), t.id, ...without.slice(insertAt)];

    setOrder(newOrder);
    if (changedStatus) setOverrides((o) => ({ ...o, [t.id]: col }));

    startTransition(async () => {
      if (changedStatus) {
        await saveNode({
          id: t.id,
          type: 'task',
          parent: t.parentId,
          data: { ...t.data, status: col },
          changeNote: 'moved',
          revalidate: revalidatePath,
        });
      }
      await reorderNodes(newOrder, revalidatePath); // runs last → authoritative positions
      router.refresh();
    });
  }

  function quickAdd(status: string) {
    const title = addTitle.trim();
    if (!title) return;
    startTransition(async () => {
      await saveNode({
        type: 'task',
        parent: addParent,
        data: { title, status: status || statuses[0] },
        position: tasks.length, // append
        changeNote: 'created',
        revalidate: revalidatePath,
      });
      setAdding(null);
      setAddTitle('');
      router.refresh();
    });
  }

  function Indicator() {
    return (
      <div
        aria-hidden
        style={{ height: 1, background: 'color-mix(in srgb, var(--accent) 55%, transparent)', margin: '2px 0' }}
      />
    );
  }

  return (
    <div className="my-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="field-label" style={{ margin: 0 }}>Container</span>
        <Select
          value={container}
          onChange={(v) => setContainer(v)}
          options={containers.map((c) => ({ value: c.id, label: c.label, dividerBefore: c.dividerBefore }))}
          ariaLabel="Board container"
        />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2" style={{ alignItems: 'flex-start' }}>
        {columns.map((col) => {
          const cards = cardsIn(col);
          const isOver = dragOver?.col === col;
          return (
            <div
              key={col || 'none'}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setDragOver({ col, index: cards.filter((c) => c.id !== dragId).length });
              }}
              onDrop={() => handleDrop(col, dragOver?.col === col ? dragOver.index : cards.length)}
              style={{
                width: 248,
                flexShrink: 0,
                background: isOver ? 'var(--bg-elev)' : 'var(--bg-alt)',
                border: `1px solid ${isOver ? 'color-mix(in srgb, var(--accent) 28%, var(--line))' : 'var(--line)'}`,
                transition: 'background .15s ease, border-color .15s ease',
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
                {col ? <Chip value={col} /> : <span className="mono" style={{ fontSize: 10, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>No status</span>}
                <span style={{ flex: 1 }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>{cards.length}</span>
              </div>

              <div className="p-2 flex flex-col" style={{ minHeight: 60, gap: 8 }}>
                {(() => {
                  // Index used for the insertion indicator counts only non-dragged cards.
                  let visibleIdx = -1;
                  return cards.map((t) => {
                    const isDragged = dragId === t.id;
                    if (!isDragged) visibleIdx += 1;
                    const here = visibleIdx;
                    return (
                      <div key={t.id}>
                        {isOver && dragOver?.index === here && !isDragged && <Indicator />}
                        <div
                          draggable
                          onDragStart={() => setDragId(t.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOver(null);
                          }}
                          onDragOver={(e) => {
                            if (!dragId || isDragged) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const r = e.currentTarget.getBoundingClientRect();
                            const before = e.clientY < r.top + r.height / 2;
                            setDragOver({ col, index: before ? here : here + 1 });
                          }}
                          onClick={() => setEdit(t)}
                          className="index-card"
                          style={{
                            border: '1px solid var(--line)',
                            background: 'var(--bg)',
                            padding: '10px 11px',
                            cursor: 'grab',
                            opacity: isDragged ? 0.4 : 1,
                          }}
                        >
                          <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: 0, lineHeight: 1.4 }}>{t.title}</p>
                          {containerTag(t) && (
                            <span
                              className="mono mt-1.5 inline-block"
                              style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-2)', border: '1px solid var(--line)', padding: '1px 5px' }}
                            >
                              {containerTag(t)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}

                {isOver && dragOver?.index === cards.filter((c) => c.id !== dragId).length && <Indicator />}

                {adding === col ? (
                  <input
                    autoFocus
                    className="field-input"
                    placeholder="Task title…"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') quickAdd(col);
                      if (e.key === 'Escape') {
                        setAdding(null);
                        setAddTitle('');
                      }
                    }}
                    onBlur={() => {
                      if (!addTitle.trim()) setAdding(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="muted-link mono flex items-center gap-1"
                    style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 2px' }}
                    onClick={() => {
                      setAdding(col);
                      setAddTitle('');
                    }}
                  >
                    <PlusIcon className="h-3.5 w-3.5" aria-hidden /> Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {edit && (
        <NodeEditModal
          open={!!edit}
          onClose={() => setEdit(null)}
          node={{ id: edit.id, type_key: 'task', parent_id: edit.parentId, data: edit.data } as unknown as NodeRow}
          fields={taskFields}
          typeLabel="Task"
          revalidatePath={revalidatePath}
        />
      )}
    </div>
  );
}
