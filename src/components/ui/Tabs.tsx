'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

/** In-page tabs that switch server-rendered content; active tab synced to ?tab=. */
export function Tabs({ tabs }: { tabs: TabDef[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlTab = params?.get('tab');
  const [active, setActive] = useState<string>(
    tabs.find((t) => t.key === urlTab)?.key ?? tabs[0]?.key ?? '',
  );

  function select(key: string) {
    setActive(key);
    const next = new URLSearchParams(params?.toString());
    next.set('tab', key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="tabs mt-6" role="tablist">
        {tabs.map((t) => {
          const on = t.key === (current?.key ?? '');
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(t.key)}
              className={on ? 'active' : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="tab-panel">
        {current?.content}
      </div>
    </div>
  );
}

/** Route-based tabs (navigate between pages); active by pathname prefix. */
export function TabLinks({
  tabs,
  className = 'mb-8',
}: {
  tabs: { href: string; label: string }[];
  className?: string;
}) {
  const pathname = usePathname() ?? '';
  return (
    <div className={`tabs ${className}`}>
      {tabs.map((t) => {
        const on = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={on ? 'active' : undefined}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
