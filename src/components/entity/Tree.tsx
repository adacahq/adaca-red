'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';
import { saveNode, deleteNode } from '@/lib/nodes/actions';
import { useConfirm } from '@/components/ui/Confirm';
import Select from '@/components/ui/Select';
import Chip from './Chips';
import NodeEditModal, { type ParentOption } from './NodeEditModal';

export interface ChildType {
  key: string;
  label: string;
  defaults: Record<string, unknown>;
}

/** Expand/collapse caret — one glyph, rotated per state (was heroicons'
 *  ChevronRight/ChevronDown). */
function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden
      style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.3s var(--ease)' }}
    >
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function Tree({
  rootId,
  nodes,
  typeLabels,
  fieldsByType,
  childTypesByParent,
  revalidatePath,
}: {
  rootId: string;
  nodes: NodeRow[];
  typeLabels: Record<string, string>;
  fieldsByType: Record<string, FieldDef[]>;
  childTypesByParent: Record<string, ChildType[]>;
  revalidatePath: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<NodeRow | null>(null);
  const [pending, startTransition] = useTransition();

  const byParent = useMemo(() => {
    const m: Record<string, NodeRow[]> = {};
    for (const n of nodes) {
      const p = n.parent_id ?? '';
      (m[p] ??= []).push(n);
    }
    return m;
  }, [nodes]);

  // Adaptive re-parenting: a node's valid new parents are existing nodes in this
  // tree whose type can contain it (per `allowedParents`, inverted into
  // `childTypesByParent`), minus itself and its own descendants (no cycles).
  const allowedParentTypesFor = (typeKey: string): string[] =>
    Object.keys(childTypesByParent).filter((p) =>
      (childTypesByParent[p] ?? []).some((ct) => ct.key === typeKey),
    );

  function descendantsOf(id: string): Set<string> {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const c of byParent[cur] ?? []) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
    return out;
  }

  function parentOptionsFor(node: NodeRow): ParentOption[] {
    const allowed = allowedParentTypesFor(node.type_key);
    const banned = descendantsOf(node.id);
    banned.add(node.id);
    return nodes
      .filter((n) => allowed.includes(n.type_key) && !banned.has(n.id))
      .map((n) => ({
        value: n.id,
        label:
          n.id === rootId
            ? 'Top level'
            : `${((n.data ?? {}) as { title?: string }).title ?? 'Untitled'} · ${typeLabels[n.type_key] ?? n.type_key}`,
        position: byParent[n.id]?.length ?? 0,
      }))
      .sort((a, b) => (a.value === rootId ? -1 : b.value === rootId ? 1 : a.label.localeCompare(b.label)));
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function addChild(parentId: string, type: ChildType, title: string) {
    startTransition(async () => {
      await saveNode({
        type: type.key,
        parent: parentId,
        data: { ...type.defaults, title },
        position: byParent[parentId]?.length ?? 0, // append after existing siblings
        changeNote: 'created',
        revalidate: revalidatePath,
      });
      setAddingFor(null);
      setExpanded((s) => new Set(s).add(parentId));
      router.refresh();
    });
  }

  async function remove(node: NodeRow) {
    const title = ((node.data ?? {}) as { title?: string }).title ?? 'this item';
    const ok = await confirm({
      title: 'Delete',
      body: `Delete “${title}” and everything nested under it? This can’t be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteNode(node.id, revalidatePath);
      router.refresh();
    });
  }

  function renderRow(node: NodeRow, depth: number) {
    const children = byParent[node.id] ?? [];
    const data = (node.data ?? {}) as Record<string, unknown>;
    const isOpen = expanded.has(node.id);
    const addable = childTypesByParent[node.type_key] ?? [];
    const status = typeof data.status === 'string' ? data.status : undefined;
    const typeLabel = typeLabels[node.type_key] ?? node.type_key;
    const extraIndent = depth > 1 ? { paddingLeft: 26 + (depth - 1) * 20 } : undefined;

    return (
      <div key={node.id}>
        <div className={`ms group${depth > 0 ? ' sub' : ''}`} style={extraIndent}>
          {/* `.id` is a 58px column — a caret plus a label truncates the label
              to nothing ("Risk group" → "Ris…"). The caret alone keeps the
              indent honest; the type belongs under the title, which is where
              `.ms .nm small` already puts a node's meta line. */}
          <span className="id">
            <button
              type="button"
              onClick={() => toggle(node.id)}
              style={{ visibility: children.length ? 'visible' : 'hidden', color: 'inherit', display: 'inline-flex' }}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              <Caret open={isOpen} />
            </button>
          </span>
          <span className="nm">
            <button type="button" onClick={() => setEditNode(node)} className="text-left" style={{ color: 'inherit' }}>
              {(data.title as string) || 'Untitled'}
            </button>
            <small>{typeLabel}</small>
          </span>
          <span className="flex items-center gap-3 justify-end">
            {status && <Chip value={status} />}
            <span className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" className="muted-link mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }} onClick={() => setEditNode(node)} disabled={pending}>
                Edit
              </button>
              {addable.length > 0 && (
                <button type="button" className="muted-link" onClick={() => setAddingFor(addingFor === node.id ? null : node.id)} disabled={pending} aria-label="Add child">
                  +
                </button>
              )}
              <button type="button" className="muted-link" onClick={() => remove(node)} disabled={pending} aria-label="Delete">
                ✕
              </button>
            </span>
          </span>
        </div>

        {addingFor === node.id && (
          <AddRow depth={depth + 1} types={addable} onAdd={(t, title) => addChild(node.id, t, title)} />
        )}

        {isOpen && children.map((c) => renderRow(c, depth + 1))}
      </div>
    );
  }

  const topChildren = byParent[rootId] ?? [];
  const rootType = nodes.find((n) => n.id === rootId)?.type_key ?? '';
  const rootAddable = childTypesByParent[rootType] ?? [];

  return (
    <div className="mstones">
      {topChildren.map((c) => renderRow(c, 0))}
      {topChildren.length === 0 && (
        <p className="py-4 text-[13px]" style={{ color: 'var(--muted)' }}>No items yet.</p>
      )}
      {rootAddable.length > 0 && (
        <div className="pt-4">
          {addingFor === rootId ? (
            <AddRow depth={0} types={rootAddable} onAdd={(t, title) => addChild(rootId, t, title)} />
          ) : (
            <button type="button" className="btn btn-ghost sm" onClick={() => setAddingFor(rootId)} disabled={pending}>
              + Add item
            </button>
          )}
        </div>
      )}

      {editNode && (
        <NodeEditModal
          open={!!editNode}
          onClose={() => setEditNode(null)}
          node={editNode}
          fields={fieldsByType[editNode.type_key] ?? []}
          typeLabel={typeLabels[editNode.type_key] ?? editNode.type_key}
          parentOptions={parentOptionsFor(editNode)}
          revalidatePath={revalidatePath}
        />
      )}
    </div>
  );
}

function AddRow({
  depth,
  types,
  onAdd,
}: {
  depth: number;
  types: ChildType[];
  onAdd: (t: ChildType, title: string) => void;
}) {
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? '');
  const [title, setTitle] = useState('');
  const t = types.find((x) => x.key === typeKey) ?? types[0];
  return (
    <div className="flex items-center gap-2 py-2" style={{ paddingLeft: depth * 20 }}>
      <Select
        mono
        value={typeKey}
        onChange={setTypeKey}
        options={types.map((x) => ({ value: x.key, label: x.label }))}
        ariaLabel="Child type"
      />
      <input
        autoFocus
        className="field-input"
        placeholder="Title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && title.trim() && t) onAdd(t, title.trim());
        }}
        style={{ flex: 1 }}
      />
      <button
        type="button"
        className="btn btn-primary sm"
        disabled={!title.trim() || !t}
        onClick={() => t && onAdd(t, title.trim())}
      >
        Add
      </button>
    </div>
  );
}
