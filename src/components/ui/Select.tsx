'use client';

import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/20/solid';

export interface SelectOption {
  value: string;
  label: string;
  /** Render a hairline separator row immediately above this option. */
  dividerBefore?: boolean;
}

/**
 * On-brand custom dropdown (replaces native <select>). Hairline trigger,
 * dark panel, accent check on the selected option. `mono` renders the value
 * as a mono-uppercase tag (statuses/keys); otherwise normal text (names).
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  mono = false,
  fullWidth = false,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  fullWidth?: boolean;
  ariaLabel?: string;
}) {
  const selected = options.find((o) => o.value === value);
  const monoStyle = mono
    ? { fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' as const }
    : { fontSize: 14 };

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className="relative" style={{ width: fullWidth ? '100%' : undefined }}>
        <Listbox.Button
          aria-label={ariaLabel}
          className={mono ? 'mono' : undefined}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            margin: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            boxSizing: 'border-box',
            height: 'var(--control-h)',
            width: fullWidth ? '100%' : undefined,
            minWidth: 120,
            padding: '0 10px',
            background: 'var(--bg-alt)',
            border: '1px solid var(--line-strong)',
            color: selected ? 'var(--ink)' : 'var(--muted-2)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            ...monoStyle,
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronUpDownIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--muted-2)' }} aria-hidden />
        </Listbox.Button>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-120"
          enterFrom="opacity-0 -translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options
            anchor={{ to: 'bottom start', gap: 4 }}
            className="z-[80] focus:outline-none"
            style={{
              width: 'var(--button-width)',
              maxHeight: 280,
              overflowY: 'auto',
              background: 'var(--bg-elev)',
              border: '1px solid var(--line-strong)',
              padding: 0,
              listStyle: 'none',
            }}
          >
            {options.map((opt) => (
              <Fragment key={opt.value}>
                {opt.dividerBefore && (
                  <li aria-hidden style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                )}
                <Listbox.Option value={opt.value} as={Fragment}>
                  {({ active, selected: isSel }) => (
                    <li
                      className={mono ? 'mono' : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                        color: isSel ? 'var(--accent)' : 'var(--ink)',
                        ...monoStyle,
                      }}
                    >
                      <CheckIcon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: 'var(--accent)', visibility: isSel ? 'visible' : 'hidden' }}
                        aria-hidden
                      />
                      <span style={{ flex: 1 }}>{opt.label}</span>
                    </li>
                  )}
                </Listbox.Option>
              </Fragment>
            ))}
            {options.length === 0 && (
              <li style={{ padding: '8px 10px', fontSize: 13, color: 'var(--muted-2)' }}>No options</li>
            )}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}
