'use client';

import { useSyncExternalStore } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

// Follow the app theme (data-theme on <html>) so toast surfaces match light/dark.
function subscribe(cb: () => void) {
  window.addEventListener('themechange', cb);
  return () => window.removeEventListener('themechange', cb);
}
function getSnapshot(): 'light' | 'dark' {
  return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
}
function getServerSnapshot(): 'light' | 'dark' {
  return 'dark';
}

/**
 * On-brand sonner toaster: ultra-dark hairline surface, square corners, no
 * shadow, mono-ish messaging, orange accent for success / crit for error, and a
 * persistent close button. Colours come from CSS tokens (see globals.css) so it
 * tracks the theme. Mounted once in the root layout.
 */
export default function Toaster() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      closeButton
      gap={10}
      offset={20}
      toastOptions={{
        style: {
          background: 'var(--bg-elev)',
          border: '1px solid var(--line-strong)',
          borderRadius: 0,
          boxShadow: 'none',
          color: 'var(--ink)',
          fontSize: '13px',
          fontFamily: 'inherit',
        },
      }}
    />
  );
}
