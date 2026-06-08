'use client';

import { useSyncExternalStore } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/20/solid';

type Theme = 'light' | 'dark';

// The theme lives on <html data-theme>, applied before paint by the root
// layout's inline script. We read it via useSyncExternalStore (no
// set-state-in-effect) and notify subscribers with a custom event so every
// toggle instance stays in sync.
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

export default function ThemeToggle() {
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
    <button
      type="button"
      onClick={toggle}
      className="muted-link inline-flex items-center"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle colour theme"
    >
      {theme === 'dark' ? <SunIcon className="h-4 w-4" aria-hidden /> : <MoonIcon className="h-4 w-4" aria-hidden />}
    </button>
  );
}
