'use client';

import { Fragment, useState } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/20/solid';

/** ISO yyyy-mm-dd helpers (local, no timezone surprises). */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function display(s: string): string {
  const d = parseISO(s);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * On-brand calendar date picker (replaces native <input type=date>). Themed
 * via tokens so it follows dark/light automatically. Stores yyyy-mm-dd.
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
  const selected = parseISO(value);
  const today = new Date();
  const [view, setView] = useState<Date>(selected ?? new Date(today.getFullYear(), today.getMonth(), 1));

  // Build a 6-week grid starting Monday.
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon=0
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
  const days = Array.from({ length: 42 }, (_, i) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );

  return (
    <Popover className="relative" style={{ display: 'inline-block' }}>
      {() => (
        <>
          <Popover.Button
            aria-label={ariaLabel}
            className="mono"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxSizing: 'border-box',
              height: 'var(--control-h)',
              minWidth: 160,
              padding: '0 10px',
              fontSize: 12,
              letterSpacing: '0.02em',
              background: 'var(--bg-alt)',
              border: '1px solid var(--line-strong)',
              color: value ? 'var(--ink)' : 'var(--muted-2)',
              cursor: 'pointer',
            }}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-2)' }} aria-hidden />
            <span style={{ flex: 1, textAlign: 'left' }}>{value ? display(value) : placeholder}</span>
            {value && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear date"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }}
                style={{ color: 'var(--muted-2)', display: 'inline-flex' }}
              >
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
              </span>
            )}
          </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-120"
            enterFrom="opacity-0 -translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Popover.Panel
              anchor={{ to: 'bottom start', gap: 4 }}
              className="z-[80]"
              style={{
                width: 252,
                background: 'var(--bg-elev)',
                border: '1px solid var(--line-strong)',
                padding: 12,
              }}
            >
              {({ close }) => (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      className="muted-link"
                      onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                      aria-label="Previous month"
                    >
                      <ChevronLeftIcon className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink)' }}>
                      {MONTHS[view.getMonth()]} {view.getFullYear()}
                    </span>
                    <button
                      type="button"
                      className="muted-link"
                      onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                      aria-label="Next month"
                    >
                      <ChevronRightIcon className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAYS.map((w, i) => (
                      <span key={i} className="mono text-center" style={{ fontSize: 9, color: 'var(--muted-2)' }}>
                        {w}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-0.5">
                    {days.map((d) => {
                      const iso = toISO(d);
                      const inMonth = d.getMonth() === view.getMonth();
                      const isSel = value === iso;
                      const isToday = toISO(today) === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => {
                            onChange(iso);
                            close();
                          }}
                          className="mono"
                          style={{
                            fontSize: 12,
                            height: 28,
                            background: isSel ? 'var(--accent)' : 'transparent',
                            color: isSel ? 'var(--accent-ink)' : inMonth ? 'var(--ink)' : 'var(--muted-2)',
                            border: isToday && !isSel ? '1px solid var(--line-strong)' : '1px solid transparent',
                            cursor: 'pointer',
                          }}
                        >
                          {d.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex justify-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                    <button
                      type="button"
                      className="mono"
                      style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}
                      onClick={() => {
                        onChange(toISO(today));
                        close();
                      }}
                    >
                      Today
                    </button>
                  </div>
                </>
              )}
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}
