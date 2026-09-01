'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import {
  subscribeRecents,
  getRecentsSnapshot,
  getRecentsServerSnapshot,
  clearRecents,
} from '@/lib/recents';
import { routeFor } from '@/lib/nodes/routes';

/**
 * The rail's "recently visited" strip — the `.tstrip` grammar (a `.glabel`
 * caption, plain text rows, a mono accent "Clear"). Text-only, like the rest
 * of the rail. The localStorage-backed store is unchanged by this restyle.
 */
export default function SidebarRecents() {
  const recents = useSyncExternalStore(subscribeRecents, getRecentsSnapshot, getRecentsServerSnapshot);
  if (recents.length === 0) return null;

  return (
    <div className="tstrip">
      <span className="glabel">Recents</span>
      {recents.map((r) => (
        <p key={`${r.type}:${r.id}`} className="truncate">
          <Link href={`${routeFor(r.type)}/${r.id}`}>{r.title}</Link>
        </p>
      ))}
      <button
        type="button"
        onClick={() => clearRecents()}
        className="mono-micro"
        style={{ color: 'var(--accent)', marginTop: 10 }}
      >
        Clear
      </button>
    </div>
  );
}
