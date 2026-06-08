'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { RocketLaunchIcon, ShieldExclamationIcon, FireIcon } from '@heroicons/react/24/outline';
import {
  subscribeRecents,
  getRecentsSnapshot,
  getRecentsServerSnapshot,
  clearRecents,
  type RecentType,
} from '@/lib/recents';

const META: Record<RecentType, { base: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  initiative: { base: '/initiatives', icon: RocketLaunchIcon },
  risk: { base: '/risks', icon: ShieldExclamationIcon },
  incident: { base: '/incidents', icon: FireIcon },
};

export default function SidebarRecents({ onNavigate }: { onNavigate?: () => void }) {
  const recents = useSyncExternalStore(subscribeRecents, getRecentsSnapshot, getRecentsServerSnapshot);

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 px-4 pb-1.5 pt-1">
        <span
          className="mono"
          style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--muted-2)' }}
        >
          Recents
        </span>
        <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        {recents.length > 0 && (
          <button
            type="button"
            onClick={() => clearRecents()}
            className="mono nav-section-link"
            style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-2)' }}
            title="Clear recents"
          >
            Clear
          </button>
        )}
      </div>

      {recents.length === 0 ? (
        <p className="px-4 py-1" style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>
          Nothing visited yet.
        </p>
      ) : (
        <ul role="list" className="flex flex-col gap-0.5">
          {recents.map((r) => {
            const Icon = META[r.type].icon;
            return (
              <li key={`${r.type}:${r.id}`}>
                <Link
                  href={`${META[r.type].base}/${r.id}`}
                  onClick={onNavigate}
                  className="nav-link group flex items-center gap-x-2.5 py-[7px]"
                  style={{ paddingLeft: 18, paddingRight: 10, color: 'var(--muted)' }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--muted-2)' }} aria-hidden />
                  <span
                    style={{
                      fontSize: 12.5,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
