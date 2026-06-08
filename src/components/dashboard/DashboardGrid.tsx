'use client';

import 'react-grid-layout/css/styles.css';

import { useRef, useState } from 'react';
import GridLayout, { useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { PlusIcon, PencilSquareIcon, CheckIcon } from '@heroicons/react/20/solid';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import WidgetView from './WidgetView';
import WidgetBuilder, { type WidgetDraft } from './WidgetBuilder';
import { WIDGET_BY_TYPE } from '@/lib/dashboard/widgets';
import { saveDashboard } from '@/lib/dashboard/actions';
import type { SourceMeta, WidgetInstance } from '@/lib/dashboard/types';

function genId(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += chars[b % 36];
  return s;
}

export default function DashboardGrid({
  initialLayout,
  sources,
}: {
  initialLayout: WidgetInstance[];
  sources: SourceMeta[];
}) {
  const [items, setItems] = useState<WidgetInstance[]>(initialLayout);
  const [editing, setEditing] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderInitial, setBuilderInitial] = useState<WidgetInstance | null>(null);
  const { width, containerRef, mounted } = useContainerWidth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function saveNow(next: WidgetInstance[]) {
    if (timer.current) clearTimeout(timer.current);
    void saveDashboard(next);
  }
  function saveSoon(next: WidgetInstance[]) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveDashboard(next), 700);
  }

  const layout: Layout = items.map((it) => ({
    i: it.id,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
    minW: WIDGET_BY_TYPE[it.type].minSize.w,
    minH: WIDGET_BY_TYPE[it.type].minSize.h,
  }));

  function onLayoutChange(next: Layout) {
    setItems((prev) => {
      const byId = new Map(next.map((li) => [li.i, li]));
      const merged = prev.map((it) => {
        const p = byId.get(it.id);
        return p ? { ...it, x: p.x, y: p.y, w: p.w, h: p.h } : it;
      });
      if (editing) saveSoon(merged);
      return merged;
    });
  }

  function openAdd() {
    setBuilderInitial(null);
    setBuilderOpen(true);
    setEditing(true);
  }
  function openEdit(it: WidgetInstance) {
    setBuilderInitial(it);
    setBuilderOpen(true);
  }
  function remove(id: string) {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    saveNow(next);
  }
  function duplicate(it: WidgetInstance) {
    const y = items.reduce((m, x) => Math.max(m, x.y + x.h), 0);
    const copy: WidgetInstance = {
      ...it,
      id: genId(),
      x: 0,
      y,
      title: it.title ? `${it.title} (copy)` : undefined,
      config: JSON.parse(JSON.stringify(it.config)) as WidgetInstance['config'],
    };
    const next = [...items, copy];
    setItems(next);
    saveNow(next);
  }
  function submit(draft: WidgetDraft) {
    if (builderInitial) {
      const next = items.map((it) =>
        it.id === builderInitial.id ? { ...it, type: draft.type, title: draft.title, config: draft.config } : it,
      );
      setItems(next);
      saveNow(next);
    } else {
      const meta = WIDGET_BY_TYPE[draft.type];
      const y = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      const inst: WidgetInstance = {
        id: genId(),
        type: draft.type,
        title: draft.title,
        x: 0,
        y,
        w: meta.defaultSize.w,
        h: meta.defaultSize.h,
        config: draft.config,
      };
      const next = [...items, inst];
      setItems(next);
      saveNow(next);
    }
  }
  function toggleEditing() {
    setEditing((e) => {
      const nextEditing = !e;
      if (!nextEditing) saveNow(items); // flush on Done
      return nextEditing;
    });
  }

  return (
    <div>
      <div className="mt-6 mb-3 flex items-center gap-2">
        <span style={{ flex: 1 }} />
        {editing ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={openAdd}>
              <PlusIcon className="h-4 w-4" aria-hidden /> Add widget
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={toggleEditing}>
              <CheckIcon className="h-4 w-4" aria-hidden /> Done
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={toggleEditing}>
            <PencilSquareIcon className="h-4 w-4" aria-hidden /> Customise
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="canvas-grid flex flex-col items-center justify-center text-center"
          style={{ border: '1px solid var(--line)', padding: '64px 24px', background: 'var(--bg-alt)' }}
        >
          <span
            aria-hidden
            className="mb-5 inline-flex items-center justify-center"
            style={{ width: 44, height: 44, border: '1px solid var(--line-strong)', color: 'var(--accent)', background: 'var(--bg)' }}
          >
            <Squares2X2Icon className="h-5 w-5" />
          </span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted-2)' }}>
            Dashboard
          </span>
          <h3 className="mt-2" style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>Your dashboard is empty</h3>
          <p className="mt-2" style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 420 }}>
            Build your own view: add KPIs, charts, tables and notes from the operations data.
          </p>
          <button type="button" className="btn btn-primary btn-sm mt-6" onClick={openAdd}>
            <PlusIcon className="h-4 w-4" aria-hidden /> Add your first widget
          </button>
        </div>
      ) : (
        <div ref={containerRef}>
          {mounted && (
            <GridLayout
              width={width}
              layout={layout}
              gridConfig={{ cols: 12, rowHeight: 96, margin: [14, 14] as const }}
              dragConfig={{ enabled: editing, handle: '.widget-drag', cancel: 'button, a, input, textarea, select' }}
              resizeConfig={{ enabled: editing, handles: ['se'] as const }}
              onLayoutChange={onLayoutChange}
            >
              {items.map((it) => (
                <div key={it.id}>
                  <WidgetView
                    instance={it}
                    editing={editing}
                    onEdit={() => openEdit(it)}
                    onDuplicate={() => duplicate(it)}
                    onRemove={() => remove(it.id)}
                  />
                </div>
              ))}
            </GridLayout>
          )}
        </div>
      )}

      <WidgetBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        sources={sources}
        initial={builderInitial}
        onSubmit={submit}
      />
    </div>
  );
}
