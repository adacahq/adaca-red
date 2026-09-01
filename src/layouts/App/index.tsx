'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConfirmProvider } from '@/components/ui/Confirm';
import { ChoiceProvider } from '@/components/entity/ChoiceContext';
import { UsersProvider, type UserMeta } from '@/components/fields/UsersContext';
import type { ChoiceMeta } from '@/lib/definitions/choices';
import { navGroups, type RegisterItem } from '@/lib/nav';
import Logo from '@/components/ui/Logo';
import Nav from './Nav';
import Topbar from './Topbar';

export interface AppUser {
  name: string | null;
  email: string | null;
  role: string;
}

/**
 * The authenticated shell: `Topbar` (position readout, search, identity)
 * across the top, the `.sb` rail down the left (a fixed drawer below 900px
 * — no Headless UI, the CSS already implements the slide + scrim), and one
 * `.wrap` for every screen underneath.
 *
 * The drawer's open state is keyed to the pathname rather than tracked with
 * an effect: `open` is only true while `openedAt` still equals the current
 * pathname, so navigating away closes it for free.
 */
export default function AppShell({
  user,
  choiceMeta,
  userMeta = {},
  register = [],
  children,
}: {
  user: AppUser;
  choiceMeta: ChoiceMeta;
  userMeta?: UserMeta;
  register?: RegisterItem[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  const groups = navGroups(register);

  return (
    <ChoiceProvider value={choiceMeta}>
      <UsersProvider value={userMeta}>
        <Topbar user={user} groups={groups} pathname={pathname} onMenu={() => setOpenedAt(pathname)} />
        {open ? <div className="scrim" onClick={() => setOpenedAt(null)} aria-hidden /> : null}
        <aside className={open ? 'sb open' : 'sb'}>
          <Link href="/" className="brand">
            <Logo variant="white" />
            <span>Ops</span>
          </Link>
          <Nav groups={groups} role={user.role} />
        </aside>
        <main className="page min-h-svh">
          <div className="wrap">
            <ConfirmProvider>{children}</ConfirmProvider>
          </div>
        </main>
      </UsersProvider>
    </ChoiceProvider>
  );
}
