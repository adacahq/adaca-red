'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { sectionOn, viewOn, visibleViews } from '@/lib/nav';
import type { NavGroup, NavSection } from '@/lib/nav';
import SidebarRecents from './SidebarRecents';

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

/**
 * The rail's group/section tree (`nav.ts`). Every section with more than
 * one visible view wears a chevron; the active section opens by default
 * (and can be tucked away), while a closed section's chevron peeks at what
 * sits beneath it without leaving the current screen. No icons — the rail
 * is text-only.
 */
export default function Nav({ groups, role }: { groups: NavGroup[]; role: string }) {
  const pathname = usePathname() ?? '/';
  // The chevron toggles know where they were opened; navigating away resets
  // them, so every screen starts from the default state (active section
  // open, the rest closed).
  const [flips, setFlips] = useState<{ keys: string[]; at: string } | null>(null);
  const flipped = flips && flips.at === pathname ? flips.keys : [];

  /** A chevron click flips its section away from the default state. */
  function flip(key: string) {
    const keys = flipped.includes(key)
      ? flipped.filter((k) => k !== key)
      : [...flipped, key];
    setFlips({ keys, at: pathname });
  }

  function sectionItem(s: NavSection) {
    const views = visibleViews(s, role);
    if (!views.length) return null;
    const on = sectionOn(s, pathname);
    const multi = views.length > 1;
    const expanded = multi && on !== flipped.includes(s.key);
    return (
      <div className={multi ? 'sect chv' : 'sect'} key={s.key}>
        <Link href={views[0].href} className={on ? 'nv on' : 'nv'}>
          <span>{s.label}</span>
        </Link>
        {multi ? (
          <button
            type="button"
            className="chev"
            onClick={() => flip(s.key)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} ${s.label} views`}
          >
            <Chevron />
          </button>
        ) : null}
        {multi ? (
          <div className={expanded ? 'views x' : 'views'} inert={!expanded}>
            <div>
              {views.map((v) => (
                <Link
                  key={v.href}
                  href={v.href}
                  className={on && viewOn(v, pathname) ? 'sv on' : 'sv'}
                >
                  <span>{v.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function groupItem(g: NavGroup) {
    const sections = g.sections.map((s) => sectionItem(s)).filter(Boolean);
    if (sections.length === 0) return null;
    return (
      <div className={g.footer ? 'grp mt-auto' : 'grp'} key={g.key}>
        {g.label ? <span className="glabel">{g.label}</span> : null}
        {sections}
      </div>
    );
  }

  // The footer group (Admin) renders last inside the flex column so its
  // `mt-auto` pins it to the bottom of the rail; Recents sits above it,
  // right after the main groups.
  const mainGroups = groups.filter((g) => !g.footer);
  const footerGroups = groups.filter((g) => g.footer);

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col">
      {mainGroups.map((g) => groupItem(g))}
      <SidebarRecents />
      {footerGroups.map((g) => groupItem(g))}
    </nav>
  );
}
