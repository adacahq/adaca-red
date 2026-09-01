'use client';

import { useEffect, useRef, useState } from 'react';
import { activeGroupAndSection } from '@/lib/nav';
import type { NavGroup } from '@/lib/nav';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { signOut } from '@/lib/auth/actions';
import TopSearch from './TopSearch';
import type { AppUser } from './index';

function Chevron() {
  return (
    <svg viewBox="0 0 10 6" aria-hidden>
      <path
        d="M1 1l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email?.split('@')[0] ?? '?').trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/**
 * The topbar: a static readout of where you are on the left (read from
 * `nav.ts`, so it and the rail can never drift), search in the middle, and
 * identity on the right. On mobile it also carries the drawer's menu button
 * — it is the one bar across every viewport.
 */
export default function Topbar({
  user,
  groups,
  pathname,
  onMenu,
}: {
  user: AppUser;
  groups: NavGroup[];
  pathname: string;
  onMenu: () => void;
}) {
  // The identity panel knows where it was opened; navigating away closes it.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!barRef.current?.contains(e.target as Node)) setOpenedAt(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenedAt(null);
    }
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hit = activeGroupAndSection(groups, pathname, user.role);
  // The unlabelled main group (Dashboard / For You) shows only the section
  // label — its sections are self-explanatory on their own. Every other
  // group also names the current view, however many views its section has
  // (a Register section has exactly one, but still needs naming: "Register"
  // alone doesn't say whether you're looking at Risks or Incidents).
  const viewLabel = hit && hit.group.label ? hit.view?.label ?? null : null;

  const displayName = user.name ?? user.email ?? '';

  return (
    <header className="tb" ref={barRef}>
      <div className="tbl">
        <button type="button" className="tbmenu" onClick={onMenu} aria-label="Open navigation">
          Menu
        </button>
        {hit ? (
          <span className="tbswitch static">
            <span className="tbsect">{hit.group.label ?? hit.section.label}</span>
            {viewLabel ? <b>{viewLabel}</b> : null}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 justify-center px-4">
        <TopSearch />
      </div>
      <div className="tbdrop">
        <button
          type="button"
          className="tbuser"
          onClick={() => setOpenedAt(open ? null : pathname)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="tbavatar" aria-hidden>
            {initials(user.name, user.email)}
          </span>
          <span className="tbid">
            <b title={displayName}>{displayName}</b>
            {user.role}
          </span>
          <Chevron />
        </button>
        {open ? (
          <div className="tbpanel right">
            <div className="tbwho">
              <b>{displayName}</b>
              {user.role}
            </div>
            <ThemeToggle />
            <span className="tbsep" aria-hidden />
            <form action={signOut}>
              <button type="submit" className="tbrow menu-row--danger">
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
