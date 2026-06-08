'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
} from '@heroicons/react/20/solid';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';
import { saveNode, deleteNode } from '@/lib/nodes/actions';
import { useConfirm } from '@/components/ui/Confirm';
import Select from '@/components/ui/Select';
import Chip from './Chips';
import NodeEditModal from './NodeEditModal';

export interface ChildType {
  key: string;
  label: string;
  defaults: Record<string, unknown>;
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

    return (
      <div key={node.id}>
        <div
          className="group flex items-center gap-2 py-2"
          style={{ paddingLeft: depth * 20, borderBottom: '1px solid var(--line)' }}
        >
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className="shrink-0"
            style={{ width: 16, color: 'var(--muted-2)', visibility: children.length ? 'visible' : 'hidden' }}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
          </button>
          <span
            className="mono"
            style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-2)', minWidth: 56 }}
          >
            {typeLabels[node.type_key] ?? node.type_key}
          </span>
          <button
            type="button"
            onClick={() => setEditNode(node)}
            className="text-left"
            style={{ fontSize: 14, color: 'var(--ink)', flex: 1 }}
          >
            {(data.title as string) || 'Untitled'}
          </button>
          {typeof data.status === 'string' && <Chip value={data.status} />}
          <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" className="muted-link" title="Edit" onClick={() => setEditNode(node)} disabled={pending}>
              <PencilSquareIcon className="h-4 w-4" />
            </button>
            {addable.length > 0 && (
              <button
                type="button"
                className="muted-link"
                title="Add child"
                onClick={() => setAddingFor(addingFor === node.id ? null : node.id)}
                disabled={pending}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            )}
            <button type="button" className="muted-link" title="Delete" onClick={() => remove(node)} disabled={pending}>
              <TrashIcon className="h-4 w-4" />
            </button>
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
    <div className="my-4" style={{ borderTop: '1px solid var(--line)' }}>
      {topChildren.map((c) => renderRow(c, 0))}
      {topChildren.length === 0 && (
        <p className="py-3 text-[13px]" style={{ color: 'var(--muted-2)' }}>No items yet.</p>
      )}
      {rootAddable.length > 0 && (
        <div className="pt-3">
          {addingFor === rootId ? (
            <AddRow depth={0} types={rootAddable} onAdd={(t, title) => addChild(rootId, t, title)} />
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingFor(rootId)} disabled={pending}>
              <PlusIcon className="h-4 w-4" /> Add item
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
        className="btn btn-primary btn-sm"
        disabled={!title.trim() || !t}
        onClick={() => t && onAdd(t, title.trim())}
      >
        Add
      </button>
    </div>
  );
}
