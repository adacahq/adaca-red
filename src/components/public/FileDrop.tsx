'use client';

import { useRef, useState, type DragEvent } from 'react';
import type { UploadKind } from '@/lib/supabase/types';

const ACCEPT_EXT: Record<UploadKind, string> = {
  pdf: '.pdf',
  docx: '.docx',
  pptx: '.pptx',
  xlsx: '.xlsx',
};

/** Generic multi-file picker for public forms: click or drag, hairline chrome. */
export default function FileDrop({
  accept,
  maxFiles,
  maxBytesPerFile,
  maxTotalBytes,
  files,
  onChange,
  guidance,
}: {
  accept: UploadKind[];
  maxFiles: number;
  maxBytesPerFile: number;
  maxTotalBytes: number;
  files: File[];
  onChange: (files: File[]) => void;
  guidance?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const acceptAttr = accept.map((a) => ACCEPT_EXT[a]).join(',');

  function add(incoming: FileList | File[]) {
    setWarning(null);
    const next = [...files];
    let total = files.reduce((sum, f) => sum + f.size, 0);
    for (const f of Array.from(incoming)) {
      if (next.length >= maxFiles) {
        setWarning(`At most ${maxFiles} files.`);
        break;
      }
      const ext = f.name.toLowerCase().split('.').pop() ?? '';
      if (!accept.includes(ext as UploadKind)) {
        setWarning(`${f.name}: only ${accept.join(' / ').toUpperCase()} files.`);
        continue;
      }
      if (f.size > maxBytesPerFile) {
        setWarning(`${f.name} is over ${Math.round(maxBytesPerFile / 1024 / 1024)} MB.`);
        continue;
      }
      if (total + f.size > maxTotalBytes) {
        setWarning(
          `${f.name} would take the total over ${Math.round(maxTotalBytes / 1024 / 1024)} MB. Remove a file first.`,
        );
        continue;
      }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
      total += f.size;
    }
    onChange(next);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className="empty cursor-pointer"
        style={
          dragging
            ? { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)' }
            : undefined
        }
      >
        <p style={{ color: 'var(--fg)' }}>
          Drop files here or <span style={{ color: 'var(--accent)' }}>browse</span>
        </p>
        <p className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.06em', marginTop: 2 }}>
          {accept.join(' / ').toUpperCase()} · up to {maxFiles} files · 10 MB each ·{' '}
          {Math.round(maxTotalBytes / 1024 / 1024)} MB total
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptAttr}
        className="hidden"
        onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }}
      />
      {guidance && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{guidance}</p>
      )}
      {warning && (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--warn)' }}>{warning}</p>
      )}
      {files.length > 0 && (
        <ul className="mt-3 flex flex-col" style={{ borderTop: '1px solid var(--line)' }}>
          {files.map((f) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-2 py-2"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <span className="text-[13px] truncate" style={{ color: 'var(--fg)' }}>{f.name}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                {(f.size / 1024 / 1024).toFixed(1)} MB
              </span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="muted-link"
                title={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((x) => x !== f))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
