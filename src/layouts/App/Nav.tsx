'use client';

import Link from 'next/link';
import type { ComponentType, SVGProps } from 'react';
import { HomeIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { iconFor } from '@/lib/views/icons';
import type { RegisterItem } from './index';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
interface Leaf { name: string; href: string }

const REPORTS: Leaf[] = [
  { name: 'Risk matrix', href: '/reports/risk-matrix' },
  { name: 'RED coverage', href: '/reports/red-coverage' },
  { name: 'Portfolio', href: '/reports/portfolio' },
  { name: 'Incident analytics', href: '/reports/incidents' },
];
const ADMIN: Leaf[] = [
  { name: 'Users', href: '/admin/users' },
  { name: 'Roles', href: '/admin/roles' },
  { name: 'Definitions', href: '/admin/definitions' },
];

function startsWith(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function SectionLabel({ children, href }: { children: React.ReactNode; href?: string }) {
  const style = {
    fontSize: 9,
    fontWeight: 500 as const,
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: 'var(--muted-2)',
  };
  return (
    <div className="flex items-center gap-2 px-4 pb-1.5 pt-1">
      {href ? (
        <Link href={href} className="mono nav-section-link" style={style}>
          {children}
        </Link>
      ) : (
        <span className="mono" style={style}>{children}</span>
      )}
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

function IconItem({ name, href, Icon, active, onNavigate }: { name: string; href: string; Icon: Icon; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-active={active || undefined}
      className="nav-link group relative flex items-center gap-x-3 py-[9px]"
      style={{ paddingLeft: 16, paddingRight: 10, color: active ? 'var(--ink)' : 'var(--muted)' }}
    >
      <span
        aria-hidden
        className="nav-link-bar"
        style={{
          position: 'absolute',
          left: 0,
          top: 6,
          bottom: 6,
          width: 2,
          background: active ? 'var(--accent)' : 'transparent',
          transition: 'background 0.15s ease',
        }}
      />
      <Icon className="h-4 w-4 shrink-0" style={{ color: active ? 'var(--accent)' : undefined }} aria-hidden />
      <span style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: active ? 500 : 400, flex: 1 }}>
        {name}
      </span>
    </Link>
  );
}

function SubItem({ item, active, onNavigate }: { item: Leaf; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-active={active || undefined}
      className="nav-link group relative flex items-center gap-x-2.5 py-[7px]"
      style={{ paddingLeft: 18, paddingRight: 10, color: active ? 'var(--ink)' : 'var(--muted)' }}
    >
      <span
        aria-hidden
        style={{
          width: 4,
          height: 4,
          flexShrink: 0,
          borderRadius: '9999px',
          background: active ? 'var(--accent)' : 'var(--muted-2)',
          transition: 'background 0.15s ease',
        }}
      />
      <span style={{ fontSize: 12.5, fontWeight: active ? 500 : 400, flex: 1 }}>{item.name}</span>
    </Link>
  );
}

export default function Nav({
  pathname,
  isAdmin,
  register = [],
  onNavigate,
  recentsSlot,
}: {
  pathname: string;
  isAdmin: boolean;
  register?: RegisterItem[];
  onNavigate?: () => void;
  recentsSlot?: React.ReactNode;
}) {
  return (
    <nav className="flex flex-1 flex-col px-2 pb-6 pt-3">
      <ul role="list" className="flex flex-col gap-0.5">
        <li>
          <IconItem name="Dashboard" href="/" Icon={HomeIcon} active={pathname === '/'} onNavigate={onNavigate} />
        </li>
      </ul>

      {register.length > 0 && (
        <div className="mt-5">
          <SectionLabel>Register</SectionLabel>
          <ul role="list" className="flex flex-col gap-0.5">
            {register.map((item) => (
              <li key={item.href}>
                <IconItem name={item.name} href={item.href} Icon={iconFor(item.icon)} active={startsWith(pathname, item.href)} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <SectionLabel href="/reports">Reports</SectionLabel>
        <ul role="list" className="flex flex-col gap-0.5">
          {REPORTS.map((item) => (
            <li key={item.href}>
              <SubItem item={item} active={startsWith(pathname, item.href)} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      </div>

      {recentsSlot}

      {isAdmin && (
        <div className="mt-auto pt-6">
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <Cog6ToothIcon className="h-3 w-3" aria-hidden /> Admin
            </span>
          </SectionLabel>
          <ul role="list" className="flex flex-col gap-0.5">
            {ADMIN.map((item) => (
              <li key={item.href}>
                <SubItem item={item} active={startsWith(pathname, item.href)} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
