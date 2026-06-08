'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import RichText from '@/components/rich-text/RichText';
import { WIDGETS, WIDGET_BY_TYPE } from '@/lib/dashboard/widgets';
import { getChoices } from '@/lib/definitions/choices';
import type { FieldDef } from '@/lib/supabase/types';
import type {
  Filter,
  Measure,
  MeasureKind,
  Source,
  SourceMeta,
  WidgetConfig,
  WidgetInstance,
  WidgetType,
} from '@/lib/dashboard/types';

export interface WidgetDraft {
  type: WidgetType;
  title?: string;
  config: WidgetConfig;
}

const MEASURE_OPTS = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

function categorical(fields: FieldDef[]): FieldDef[] {
  return fields.filter(
    (f) => f.data_type === 'enum' || f.data_type === 'boolean' || (f.data_type === 'number' && !!f.options?.labels?.length),
  );
}
function numericFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => f.data_type === 'number');
}
function dateFields(fields: FieldDef[]): { value: string; label: string }[] {
  return [
    { value: 'created_at', label: 'Created' },
    { value: 'updated_at', label: 'Updated' },
    ...fields.filter((f) => f.data_type === 'date').map((f) => ({ value: f.key, label: f.label })),
  ];
}
function enumFields(fields: FieldDef[]): FieldDef[] {
  return fields.filter((f) => f.data_type === 'enum');
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
      <span className="field-label" style={{ margin: 0, width: 110, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function WidgetBuilder({
  open,
  onClose,
  sources,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  sources: SourceMeta[];
  initial: WidgetInstance | null;
  onSubmit: (draft: WidgetDraft) => void;
}) {
  const editing = !!initial;
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
  const [type, setType] = useState<WidgetType | null>(initial?.type ?? null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [config, setConfig] = useState<WidgetConfig>(initial?.config ?? {});

  // The builder stays mounted across opens, so re-seed its state each time it
  // opens (React "adjust state when a prop changes" — set during render, guarded).
  // Editing an existing widget jumps straight to step 2; adding starts at step 1.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(initial ? 2 : 1);
      setType(initial?.type ?? null);
      setTitle(initial?.title ?? '');
      setConfig(initial?.config ?? {});
    }
  }

  function close() {
    onClose();
  }

  function defaultsFor(t: WidgetType): WidgetConfig {
    const src = sources[0]?.key;
    const cat = src ? categorical(sources[0].fields)[0]?.key : undefined;
    switch (t) {
      case 'kpi':
        return { source: src, filters: [], measure: { kind: 'count' } };
      case 'table':
        return { source: src, filters: [], columns: ['title'], limit: 25 };
      case 'donut':
      case 'bar':
        return { source: src, filters: [], measure: { kind: 'count' }, groupBy: cat };
      case 'stacked-bar':
        return { source: src, filters: [], measure: { kind: 'count' }, groupBy: cat, series: cat };
      case 'line':
        return { source: src, filters: [], measure: { kind: 'count' }, timeField: 'created_at', bucket: 'month' };
      case 'risk-matrix':
        return { filters: [] };
      case 'note':
        return { markdown: '' };
      default:
        return {};
    }
  }

  function pickType(t: WidgetType) {
    setType(t);
    setConfig(defaultsFor(t));
    setStep(2);
  }

  function patch(p: Partial<WidgetConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }

  const srcKey: Source = type === 'risk-matrix' ? 'risk' : (config.source ?? sources[0]?.key);
  const srcMeta = sources.find((s) => s.key === srcKey);
  const fields = srcMeta?.fields ?? [];

  function setFilter(field: string, value: string) {
    setConfig((c) => {
      const others = (c.filters ?? []).filter((f) => f.field !== field);
      const next: Filter[] = value ? [...others, { field, op: 'eq', value }] : others;
      return { ...c, filters: next };
    });
  }
  const filterValue = (field: string) => config.filters?.find((f) => f.field === field)?.value ?? '';

  function toggleColumn(key: string) {
    setConfig((c) => {
      const cols = c.columns ?? [];
      return { ...c, columns: cols.includes(key) ? cols.filter((k) => k !== key) : [...cols, key] };
    });
  }

  function canSubmit(): boolean {
    if (!type) return false;
    const m = config.measure;
    const measureOk = !m || m.kind === 'count' || !!m.field;
    switch (type) {
      case 'kpi':
        return !!config.source && measureOk;
      case 'table':
        return !!config.source;
      case 'donut':
      case 'bar':
        return !!config.source && !!config.groupBy && measureOk;
      case 'stacked-bar':
        return !!config.source && !!config.groupBy && !!config.series && measureOk;
      case 'line':
        return !!config.source && !!config.timeField && measureOk;
      case 'risk-matrix':
      case 'note':
        return true;
      default:
        return false;
    }
  }

  function submit() {
    if (!type || !canSubmit()) return;
    onSubmit({ type, title: title.trim() || undefined, config });
    close();
  }

  const measure = config.measure ?? { kind: 'count' as MeasureKind };
  const showSource = type ? WIDGET_BY_TYPE[type].needsSource : false;

  const measureControls = (
    <>
      <FieldRow label="Measure">
        <div className="flex items-center gap-2">
          <Select
            value={measure.kind}
            onChange={(v) => patch({ measure: { kind: v as MeasureKind, field: v === 'count' ? undefined : measure.field } })}
            options={MEASURE_OPTS}
            ariaLabel="Measure"
          />
          {measure.kind !== 'count' && (
            <Select
              value={measure.field ?? ''}
              onChange={(v) => patch({ measure: { kind: measure.kind, field: v } as Measure })}
              options={numericFields(fields).map((f) => ({ value: f.key, label: f.label }))}
              placeholder="Field…"
              ariaLabel="Measure field"
            />
          )}
        </div>
      </FieldRow>
    </>
  );

  const filterControls = enumFields(fields).length > 0 && (
    <div className="mt-3">
      <p className="field-label">Filters</p>
      {enumFields(fields).map((f) => (
        <FieldRow key={f.key} label={f.label}>
          <Select
            value={filterValue(f.key)}
            onChange={(v) => setFilter(f.key, v)}
            options={[{ value: '', label: 'Any' }, ...getChoices(f).map((c) => ({ value: c.key, label: c.label }))]}
            ariaLabel={`Filter ${f.label}`}
          />
        </FieldRow>
      ))}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? 'Configure widget' : 'Add widget'}
      maxWidth={620}
      footer={
        <div className="flex items-center gap-3">
          {step === 2 && !editing && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>Back</button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
          {step === 2 && (
            <button type="button" className="btn btn-primary btn-sm" disabled={!canSubmit()} onClick={submit}>
              {editing ? 'Save' : 'Add to dashboard'}
            </button>
          )}
        </div>
      }
    >
      {step === 1 && (
        <>
          <p className="text-[13px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
            Choose how to present the data.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WIDGETS.map((w) => {
              const Icon = w.icon;
              return (
                <button
                  key={w.type}
                  type="button"
                  onClick={() => pickType(w.type)}
                  className="index-card flex items-start gap-3 p-3 text-left"
                  style={{ border: '1px solid var(--line)' }}
                >
                  <span style={{ color: 'var(--accent)', marginTop: 1 }}><Icon className="h-5 w-5" aria-hidden /></span>
                  <span style={{ flex: 1 }}>
                    <span className="block" style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{w.title}</span>
                    <span className="block" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{w.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {step === 2 && type && (
        <div>
          <FieldRow label="Title">
            <input
              className="field-input"
              placeholder={WIDGET_BY_TYPE[type].title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FieldRow>

          {showSource && (
            <FieldRow label="Source">
              <Select
                value={config.source ?? ''}
                onChange={(v) => setConfig({ ...defaultsForKeep(type, v as Source) })}
                options={sources.map((s) => ({ value: s.key, label: s.label }))}
                ariaLabel="Source"
              />
            </FieldRow>
          )}

          {type === 'kpi' && measureControls}

          {(type === 'donut' || type === 'bar' || type === 'stacked-bar') && (
            <>
              <FieldRow label="Group by">
                <Select
                  value={config.groupBy ?? ''}
                  onChange={(v) => patch({ groupBy: v })}
                  options={categorical(fields).map((f) => ({ value: f.key, label: f.label }))}
                  placeholder="Category…"
                  ariaLabel="Group by"
                />
              </FieldRow>
              {type === 'stacked-bar' && (
                <FieldRow label="Series">
                  <Select
                    value={config.series ?? ''}
                    onChange={(v) => patch({ series: v })}
                    options={categorical(fields).map((f) => ({ value: f.key, label: f.label }))}
                    placeholder="Split by…"
                    ariaLabel="Series"
                  />
                </FieldRow>
              )}
              {measureControls}
            </>
          )}

          {type === 'line' && (
            <>
              <FieldRow label="Time field">
                <Select
                  value={config.timeField ?? 'created_at'}
                  onChange={(v) => patch({ timeField: v })}
                  options={dateFields(fields)}
                  ariaLabel="Time field"
                />
              </FieldRow>
              <FieldRow label="Bucket">
                <Select
                  value={config.bucket ?? 'month'}
                  onChange={(v) => patch({ bucket: v as 'day' | 'week' | 'month' })}
                  options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
                  ariaLabel="Bucket"
                />
              </FieldRow>
              <FieldRow label="Split by">
                <Select
                  value={config.series ?? ''}
                  onChange={(v) => patch({ series: v || undefined })}
                  options={[{ value: '', label: 'None' }, ...categorical(fields).map((f) => ({ value: f.key, label: f.label }))]}
                  ariaLabel="Split by"
                />
              </FieldRow>
              {measureControls}
            </>
          )}

          {type === 'table' && (
            <div className="mt-3">
              <p className="field-label">Columns</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 py-1">
                {[{ key: 'title', label: 'Title' }, ...fields.filter((f) => f.key !== 'title').map((f) => ({ key: f.key, label: f.label }))].map((f) => (
                  <label key={f.key} className="flex items-center gap-2" style={{ fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={(config.columns ?? []).includes(f.key)}
                      onChange={() => toggleColumn(f.key)}
                      style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <FieldRow label="Sort by">
                <div className="flex items-center gap-2">
                  <Select
                    value={config.sort?.field ?? ''}
                    onChange={(v) => patch({ sort: v ? { field: v, dir: config.sort?.dir ?? 'asc' } : undefined })}
                    options={[{ value: '', label: 'Default' }, { value: 'created_at', label: 'Created' }, { value: 'updated_at', label: 'Updated' }, ...fields.map((f) => ({ value: f.key, label: f.label }))]}
                    ariaLabel="Sort field"
                  />
                  {config.sort?.field && (
                    <Select
                      value={config.sort?.dir ?? 'asc'}
                      onChange={(v) => patch({ sort: { field: config.sort!.field, dir: v as 'asc' | 'desc' } })}
                      options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]}
                      ariaLabel="Sort direction"
                    />
                  )}
                </div>
              </FieldRow>
              <FieldRow label="Row limit">
                <input
                  className="field-input"
                  type="number"
                  style={{ width: 110 }}
                  value={config.limit ?? 25}
                  onChange={(e) => patch({ limit: Math.max(1, Number(e.target.value) || 25) })}
                />
              </FieldRow>
            </div>
          )}

          {type === 'note' && (
            <div className="mt-2">
              <p className="field-label">Content</p>
              <RichText value={config.markdown ?? ''} onChange={(md) => patch({ markdown: md })} />
            </div>
          )}

          {type !== 'note' && filterControls}
        </div>
      )}
    </Modal>
  );

  // Keeps title/measure sensible when the source changes (resets field-bound config).
  function defaultsForKeep(t: WidgetType, source: Source): WidgetConfig {
    const meta = sources.find((s) => s.key === source);
    const cat = meta ? categorical(meta.fields)[0]?.key : undefined;
    const base: WidgetConfig = { source, filters: [] };
    if (t === 'kpi') return { ...base, measure: { kind: 'count' } };
    if (t === 'table') return { ...base, columns: ['title'], limit: config.limit ?? 25 };
    if (t === 'donut' || t === 'bar') return { ...base, measure: { kind: 'count' }, groupBy: cat };
    if (t === 'stacked-bar') return { ...base, measure: { kind: 'count' }, groupBy: cat, series: cat };
    if (t === 'line') return { ...base, measure: { kind: 'count' }, timeField: 'created_at', bucket: 'month' };
    return base;
  }
}
