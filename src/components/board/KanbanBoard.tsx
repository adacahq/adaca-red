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

interface Item {
  id: string;
  title: string;
  /** Value of the groupBy field (the column the card sits in). */
  group: string;
  parentId: string;
  data: Record<string, unknown>;
}
interface Container { id: string; label: string; dividerBefore?: boolean }

/**
 * Generic Kanban: groups a child node type's nodes into columns by an enum
 * field (`groupBy`), draggable between columns (writes the field) and reorderable
 * (writes `position`). Nothing here is bound to a specific node type — the type,
 * the grouping field and the column set all arrive as props.
 */
export default function KanbanBoard({
  rootId,
  childType,
  typeLabel,
  groupBy,
  containers,
  items,
  columns: groups,
  fields,
  revalidatePath,
}: {
  rootId: string;
  childType: string;
  typeLabel: string;
  groupBy: string;
  containers: Container[];
  items: Item[];
  columns: string[];
  fields: FieldDef[];
  revalidatePath: string;
}) {
  const router = useRouter();
  const [container, setContainer] = useState(containers[0]?.id ?? ALL);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  // Manual order of all item ids; persisted to `position`.
  const [order, setOrder] = useState<string[]>(() => items.map((t) => t.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ col: string; index: number } | null>(null);
  const [edit, setEdit] = useState<Item | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [, startTransition] = useTransition();

  // Re-sync to server order whenever the item set or its order changes.
  const propIds = items.map((t) => t.id).join(',');
  const [syncedIds, setSyncedIds] = useState(propIds);
  if (propIds !== syncedIds) {
    setSyncedIds(propIds);
    setOrder(items.map((t) => t.id));
    setOverrides({});
  }

  const byId = new Map(items.map((t) => [t.id, t]));
  const orderIdx = new Map(order.map((id, i) => [id, i]));
  const oi = (id: string) => orderIdx.get(id) ?? 0;

  const addParent = container === ALL ? rootId : container;
  const labelByContainer = Object.fromEntries(containers.map((c) => [c.id, c.label]));
  const containerTag = (t: Item) =>
    container === ALL && t.parentId !== rootId ? labelByContainer[t.parentId] : null;

  const displayGroup = (t: Item) => overrides[t.id] ?? t.group;
  const inContainer = container === ALL ? items : items.filter((t) => t.parentId === container);
  const bucketOf = (t: Item) => (groups.includes(displayGroup(t)) ? displayGroup(t) : '');
  const hasNoGroup = inContainer.some((t) => !groups.includes(displayGroup(t)));
  const columns = hasNoGroup ? ['', ...groups] : groups;
  const cardsIn = (col: string) =>
    inContainer.filter((t) => bucketOf(t) === col).sort((a, b) => oi(a.id) - oi(b.id));

  function handleDrop(col: string, index: number) {
    const t = dragId ? byId.get(dragId) : null;
    setDragId(null);
    setDragOver(null);
    if (!t) return;

    const changedGroup = col !== '' && displayGroup(t) !== col;
    const colIds = cardsIn(col).filter((x) => x.id !== t.id).map((x) => x.id);
    const clamped = Math.max(0, Math.min(index, colIds.length));

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
    if (changedGroup) setOverrides((o) => ({ ...o, [t.id]: col }));

    startTransition(async () => {
      if (changedGroup) {
        await saveNode({
          id: t.id,
          type: childType,
          parent: t.parentId,
          data: { ...t.data, [groupBy]: col },
          changeNote: 'moved',
          revalidate: revalidatePath,
        });
      }
      await reorderNodes(newOrder, revalidatePath); // runs last → authoritative positions
      router.refresh();
    });
  }

  function quickAdd(group: string) {
    const title = addTitle.trim();
    if (!title) return;
    startTransition(async () => {
      await saveNode({
        type: childType,
        parent: addParent,
        data: { title, [groupBy]: group || groups[0] },
        position: items.length, // append
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
      {containers.length > 1 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="field-label" style={{ margin: 0 }}>Container</span>
          <Select
            value={container}
            onChange={(v) => setContainer(v)}
            options={containers.map((c) => ({ value: c.id, label: c.label, dividerBefore: c.dividerBefore }))}
            ariaLabel="Board container"
          />
        </div>
      )}

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
                    placeholder={`${typeLabel} title…`}
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
          node={{ id: edit.id, type_key: childType, parent_id: edit.parentId, data: edit.data } as unknown as NodeRow}
          fields={fields}
          typeLabel={typeLabel}
          revalidatePath={revalidatePath}
        />
      )}
    </div>
  );
}
