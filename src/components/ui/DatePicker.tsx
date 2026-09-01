'use client';

import type { CSSProperties } from 'react';

const WRAP_STYLE: CSSProperties = { display: 'inline-block', width: 'auto', minWidth: 160 };

/**
 * On-brand date input: a native <input type="date"> in the `.field` grammar
 * (globals.css flips `color-scheme` per theme so the native picker matches
 * dark/light). The native control already emits/accepts ISO yyyy-mm-dd, so
 * the value contract is unchanged.
 */
export default function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="field" style={WRAP_STYLE}>
      <input
        type="date"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
