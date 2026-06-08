'use client';

import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, Bars2Icon } from '@heroicons/react/20/solid';
import type { FieldDef } from '@/lib/supabase/types';
import { fetchExportRows, type ExportRow } from '@/lib/nodes/export';
import { formatDate } from '@/lib/format';
import { getChoices } from '@/lib/definitions/choices';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';

type DataType = FieldDef['data_type'];

interface Col {
  key: string;
  label: string;
  dataType: DataType;
  source: 'data' | 'meta';
  options?: FieldDef['options'];
  selected: boolean;
}

interface FilterState {
  text?: string; // contains / enum value / numEnum value / bool value
  min?: string;
  max?: string;
  from?: string;
  to?: string;
}
type Filters = Record<string, FilterState>;

type FilterKind = 'text' | 'enum' | 'numEnum' | 'number' | 'bool' | 'date';

// ── pure helpers (module scope) ──────────────────────────────
function buildCols(fields: FieldDef[]): Col[] {
  const fieldCols: Col[] = fields.map((f) => ({
    key: f.key,
    label: f.label,
    dataType: f.data_type,
    source: 'data',
    options: f.options,
    selected: true,
  }));
  const meta: Col[] = [
    { key: 'created_at', label: 'Created', dataType: 'date', source: 'meta', selected: false },
    { key: 'updated_at', label: 'Updated', dataType: 'date', source: 'meta', selected: false },
    { key: 'id', label: 'ID', dataType: 'text', source: 'meta', selected: false },
  ];
  return [...fieldCols, ...meta];
}

function filterKind(c: Col): FilterKind {
  switch (c.dataType) {
    case 'enum':
      return 'enum';
    case 'boolean':
      return 'bool';
    case 'date':
      return 'date';
    case 'number':
      return c.options?.labels?.length ? 'numEnum' : 'number';
    default:
      return 'text';
  }
}

function isPlainNumber(c: Col): boolean {
  return c.dataType === 'number' && !c.options?.labels?.length;
}

function rawValue(c: Col, row: ExportRow): unknown {
  if (c.source === 'meta') {
    if (c.key === 'id') return row.id;
    if (c.key === 'created_at') return row.created_at;
    if (c.key === 'updated_at') return row.updated_at;
  }
  return row.data[c.key];
}

function displayValue(c: Col, row: ExportRow): string {
  const v = rawValue(c, row);
  if (v === null || v === undefined || v === '') return '';
  if (c.dataType === 'date' || (c.source === 'meta' && c.key !== 'id')) return formatDate(v);
  if (c.dataType === 'boolean') return v ? 'Yes' : 'No';
  if (c.dataType === 'number' && c.options?.labels?.length) {
    const min = c.options.min ?? 0;
    const label = c.options.labels[Number(v) - min];
    return label ?? String(v);
  }
  if (c.dataType === 'enum') {
    return getChoices(c).find((x) => x.key === String(v))?.label ?? String(v);
  }
  return String(v);
}

function numericValue(c: Col, row: ExportRow): number | null {
  const v = rawValue(c, row);
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowPasses(cols: Col[], filters: Filters, row: ExportRow): boolean {
  for (const c of cols) {
    const f = filters[c.key];
    if (!f) continue;
    const kind = filterKind(c);
    const raw = rawValue(c, row);
    if (kind === 'text') {
      const q = (f.text ?? '').trim().toLowerCase();
      if (q && !String(raw ?? '').toLowerCase().includes(q)) return false;
    } else if (kind === 'enum' || kind === 'numEnum') {
      const val = f.text ?? '';
      if (val && String(raw ?? '') !== val) return false;
    } else if (kind === 'bool') {
      if (f.text === 'true' && !raw) return false;
      if (f.text === 'false' && raw) return false;
    } else if (kind === 'number') {
      const n = Number(raw);
      const hasN = raw !== '' && raw !== null && raw !== undefined && Number.isFinite(n);
      if (f.min) {
        if (!hasN || n < Number(f.min)) return false;
      }
      if (f.max) {
        if (!hasN || n > Number(f.max)) return false;
      }
    } else if (kind === 'date') {
      const d = String(raw ?? '').slice(0, 10);
      if (f.from && (!d || d < f.from)) return false;
      if (f.to && (!d || d > f.to)) return false;
    }
  }
  return true;
}

function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(cols: Col[], rows: ExportRow[]): string {
  const header = cols.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => csvCell(displayValue(c, r))).join(',')).join('\r\n');
  return body ? `${header}\r\n${body}` : header;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// The browser build returns a chainable { toBlob, toFile } rather than writing
// to disk directly (that's the Node build). toFile() downloads in the browser.
// write-excel-file v4: the per-sheet option is `columns` (not `schema`), and each
// column has a `header` plus a `cell(object)` returning a Cell ({ type, value } | value | null).
type XlsxCell = { type: NumberConstructor | StringConstructor; value: number | string } | null;
type XlsxColumn = { header?: string; width?: number; cell: (row: ExportRow) => XlsxCell };
type XlsxWriter = (
  rows: ExportRow[],
  sheetOptions: { columns: XlsxColumn[] },
) => { toFile: (fileName: string) => Promise<void>; toBlob: () => Promise<Blob> };

function xlsxCell(c: Col, row: ExportRow): XlsxCell {
  if (isPlainNumber(c)) {
    const n = numericValue(c, row);
    return n === null ? null : { type: Number, value: n };
  }
  const s = displayValue(c, row);
  return s ? { type: String, value: s } : null;
}

// ── filter control ───────────────────────────────────────────
function FilterControl({
  col,
  value,
  onChange,
}: {
  col: Col;
  value: FilterState | undefined;
  onChange: (patch: FilterState) => void;
}) {
  const kind = filterKind(col);
  const small = { fontSize: 13, padding: '6px 9px' } as const;

  if (kind === 'enum') {
    const opts = [{ value: '', label: 'Any' }, ...getChoices(col).map((c) => ({ value: c.key, label: c.label }))];
    return <Select value={value?.text ?? ''} onChange={(v) => onChange({ text: v })} options={opts} ariaLabel={`Filter ${col.label}`} />;
  }
  if (kind === 'numEnum') {
    const min = col.options?.min ?? 0;
    const opts = [
      { value: '', label: 'Any' },
      ...(col.options?.labels ?? []).map((l, i) => ({ value: String(min + i), label: l })),
    ];
    return <Select value={value?.text ?? ''} onChange={(v) => onChange({ text: v })} options={opts} ariaLabel={`Filter ${col.label}`} />;
  }
  if (kind === 'bool') {
    const opts = [
      { value: '', label: 'Any' },
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
    ];
    return <Select value={value?.text ?? ''} onChange={(v) => onChange({ text: v })} options={opts} ariaLabel={`Filter ${col.label}`} />;
  }
  if (kind === 'number') {
    return (
      <div className="flex items-center gap-2">
        <input className="field-input" type="number" style={{ ...small, width: 90 }} placeholder="Min" value={value?.min ?? ''} onChange={(e) => onChange({ min: e.target.value })} />
        <span style={{ color: 'var(--muted-2)' }}>–</span>
        <input className="field-input" type="number" style={{ ...small, width: 90 }} placeholder="Max" value={value?.max ?? ''} onChange={(e) => onChange({ max: e.target.value })} />
      </div>
    );
  }
  if (kind === 'date') {
    return (
      <div className="flex items-center gap-2">
        <DatePicker value={value?.from ?? ''} onChange={(v) => onChange({ from: v })} ariaLabel={`${col.label} from`} />
        <span style={{ color: 'var(--muted-2)' }}>–</span>
        <DatePicker value={value?.to ?? ''} onChange={(v) => onChange({ to: v })} ariaLabel={`${col.label} to`} />
      </div>
    );
  }
  return (
    <input
      className="field-input"
      style={{ ...small, maxWidth: 280 }}
      placeholder="Contains…"
      value={value?.text ?? ''}
      onChange={(e) => onChange({ text: e.target.value })}
    />
  );
}

// ── main component ───────────────────────────────────────────
export default function ExportButton({
  typeKey,
  entityLabel,
  fields,
}: {
  typeKey: string;
  entityLabel: string;
  fields: FieldDef[];
}) {
  const [open, setOpen] = useState(false);
  const [cols, setCols] = useState<Col[]>(() => buildCols(fields));
  const [filters, setFilters] = useState<Filters>({});
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const [rows, setRows] = useState<ExportRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const filtered = useMemo(
    () => (rows ? rows.filter((r) => rowPasses(cols, filters, r)) : []),
    [rows, cols, filters],
  );
  const selectedCols = cols.filter((c) => c.selected);

  function openModal() {
    setOpen(true);
    if (rows === null && !loading) {
      setLoading(true);
      fetchExportRows(typeKey)
        .then(setRows)
        .finally(() => setLoading(false));
    }
  }

  function toggle(key: string) {
    setCols((cs) => cs.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c)));
  }
  function reorder(fromKey: string | null, toKey: string) {
    if (!fromKey || fromKey === toKey) return;
    setCols((cs) => {
      const from = cs.findIndex((c) => c.key === fromKey);
      const to = cs.findIndex((c) => c.key === toKey);
      if (from < 0 || to < 0) return cs;
      const next = [...cs];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  function setFilter(key: string, patch: FilterState) {
    setFilters((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
  }

  async function doExport() {
    if (!rows || selectedCols.length === 0) return;
    setExporting(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const base = `${entityLabel.toLowerCase()}-export-${date}`;
      if (format === 'csv') {
        download(new Blob(['﻿', toCsv(selectedCols, filtered)], { type: 'text/csv;charset=utf-8;' }), `${base}.csv`);
      } else {
        const mod = await import('write-excel-file/browser');
        const writeXlsxFile = mod.default as unknown as XlsxWriter;
        const columns: XlsxColumn[] = selectedCols.map((c) => ({
          header: c.label,
          width: 26,
          cell: (row: ExportRow) => xlsxCell(c, row),
        }));
        await writeXlsxFile(filtered, { columns }).toFile(`${base}.xlsx`);
      }
      setOpen(false);
    } finally {
      setExporting(false);
    }
  }

  const canExport = !!rows && selectedCols.length > 0 && filtered.length > 0 && !exporting;

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={openModal}>
        <ArrowDownTrayIcon className="h-4 w-4" aria-hidden /> Export
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Export ${entityLabel.toLowerCase()}s`}
        maxWidth={640}
        footer={
          <div className="flex flex-wrap items-center gap-3">
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted-2)' }}>
              {selectedCols.length} column{selectedCols.length === 1 ? '' : 's'} · {filtered.length} row{filtered.length === 1 ? '' : 's'}
            </span>
            <span style={{ flex: 1 }} />
            <div style={{ width: 110 }}>
              <Select
                mono
                fullWidth
                value={format}
                onChange={(v) => setFormat(v as 'csv' | 'xlsx')}
                options={[
                  { value: 'xlsx', label: 'XLSX' },
                  { value: 'csv', label: 'CSV' },
                ]}
                ariaLabel="File format"
              />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!canExport} onClick={doExport}>
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        }
      >
        <p className="text-[13px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Tick the columns to include, reorder them, and filter rows. Order here is the order in the file.
        </p>

        {loading ? (
          <p className="mt-6 text-[13px]" style={{ color: 'var(--muted-2)' }}>Loading data…</p>
        ) : (
          <div className="mt-4" style={{ maxHeight: '52vh', overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
            {cols.map((col) => (
              <div
                key={col.key}
                onDragOver={(e) => {
                  if (!dragKey) return;
                  e.preventDefault();
                  if (overKey !== col.key) setOverKey(col.key);
                }}
                onDrop={() => {
                  reorder(dragKey, col.key);
                  setDragKey(null);
                  setOverKey(null);
                }}
                style={{
                  borderBottom: '1px solid var(--line)',
                  borderTop: overKey === col.key && dragKey !== col.key ? '2px solid var(--accent)' : '2px solid transparent',
                  padding: '9px 2px',
                  background: dragKey === col.key ? 'var(--bg-elev)' : 'transparent',
                  opacity: dragKey === col.key ? 0.5 : 1,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    draggable
                    onDragStart={() => setDragKey(col.key)}
                    onDragEnd={() => {
                      setDragKey(null);
                      setOverKey(null);
                    }}
                    title="Drag to reorder"
                    aria-label={`Reorder ${col.label}`}
                    className="shrink-0"
                    style={{ cursor: 'grab', color: 'var(--muted-2)', display: 'inline-flex', padding: '2px' }}
                  >
                    <Bars2Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <input
                    type="checkbox"
                    checked={col.selected}
                    onChange={() => toggle(col.key)}
                    aria-label={`Include ${col.label}`}
                    style={{ accentColor: 'var(--accent)', width: 15, height: 15 }}
                  />
                  <span style={{ flex: 1, fontSize: 13.5, color: col.selected ? 'var(--ink)' : 'var(--muted)' }}>
                    {col.label}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-2)' }}
                  >
                    {col.dataType}
                  </span>
                </div>
                <div className="mt-2" style={{ paddingLeft: 28 }}>
                  <FilterControl col={col} value={filters[col.key]} onChange={(patch) => setFilter(col.key, patch)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
