'use client';

import { Fragment, useSyncExternalStore } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/20/solid';
import { signOut } from '@/lib/auth/actions';
import type { AppUser } from './index';

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email?.split('@')[0] ?? '?').trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

type Theme = 'light' | 'dark';
function subscribe(cb: () => void) {
  window.addEventListener('themechange', cb);
  return () => window.removeEventListener('themechange', cb);
}
function getSnapshot(): Theme {
  return (document.documentElement.getAttribute('data-theme') as Theme) || 'dark';
}
function getServerSnapshot(): Theme {
  return 'dark';
}

/** A menu row that flips the theme without closing the menu. */
function ThemeRow() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event('themechange'));
  }
  return (
    <button type="button" onClick={toggle} className="menu-row">
      {theme === 'dark' ? <SunIcon className="h-4 w-4" aria-hidden /> : <MoonIcon className="h-4 w-4" aria-hidden />}
      <span style={{ flex: 1 }}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}

export default function UserMenu({ user }: { user: AppUser }) {
  return (
    <Menu as="div" className="relative">
      <Menu.Button
        className="inline-flex items-center justify-center transition-opacity hover:opacity-90"
        aria-label="Account menu"
        style={{
          width: 32,
          height: 32,
          borderRadius: '9999px',
          background: 'var(--accent-tint)',
          border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
          color: 'var(--accent)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        {initials(user.name, user.email)}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-120"
        enterFrom="opacity-0 -translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-100"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Menu.Items
          anchor={{ to: 'bottom end', gap: 8 }}
          className="z-[90] focus:outline-none"
          style={{ width: 248, background: 'var(--bg-elev)', border: '1px solid var(--line-strong)' }}
        >
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <p style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.3 }}>
              {user.name ?? user.email}
            </p>
            {user.name && user.email && (
              <p className="mt-0.5" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{user.email}</p>
            )}
            <span
              className="mono mt-2 inline-block"
              style={{
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                background: 'var(--accent-tint)',
                border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                padding: '3px 8px',
              }}
            >
              {user.role}
            </span>
          </div>

          <div style={{ padding: 4, borderBottom: '1px solid var(--line)' }}>
            <ThemeRow />
          </div>

          <div style={{ padding: 4 }}>
            <form action={signOut}>
              <button type="submit" className="menu-row menu-row--danger">
                <ArrowRightOnRectangleIcon className="h-4 w-4" aria-hidden />
                <span style={{ flex: 1 }}>Sign out</span>
              </button>
            </form>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
