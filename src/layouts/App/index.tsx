'use client';

import { Fragment, ReactNode, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { ConfirmProvider } from '@/components/ui/Confirm';
import { ChoiceProvider } from '@/components/entity/ChoiceContext';
import type { ChoiceMeta } from '@/lib/definitions/choices';
import Logo from '@/components/ui/Logo';
import Nav from './Nav';
import SidebarRecents from './SidebarRecents';
import TopSearch from './TopSearch';
import UserMenu from './UserMenu';

export interface AppUser {
  name: string | null;
  email: string | null;
  role: string;
}

export interface RegisterItem { name: string; href: string; icon?: string }

function SidebarInner({
  pathname,
  isAdmin,
  register,
  typeIcons,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  register: RegisterItem[];
  typeIcons: Record<string, string>;
  onNavigate?: () => void;
}) {
  return (
    <div
      className="flex grow flex-col overflow-y-auto"
      style={{ background: 'var(--bg)', borderRight: '1px solid var(--line)' }}
    >
      <Link
        href="/"
        onClick={onNavigate}
        className="flex h-14 shrink-0 items-center gap-x-2.5 px-5"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <Logo />
        <span className="flex-1" />
        <span className="coord" style={{ fontSize: 9 }}>
          Ops
        </span>
      </Link>
      <Nav
        pathname={pathname}
        isAdmin={isAdmin}
        register={register}
        onNavigate={onNavigate}
        recentsSlot={<SidebarRecents typeIcons={typeIcons} onNavigate={onNavigate} />}
      />
    </div>
  );
}

export default function AppShell({
  user,
  isAdmin,
  choiceMeta,
  register = [],
  typeIcons = {},
  children,
}: {
  user: AppUser;
  isAdmin: boolean;
  choiceMeta: ChoiceMeta;
  register?: RegisterItem[];
  typeIcons?: Record<string, string>;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);

  return (
    <ChoiceProvider value={choiceMeta}>
      <div>
      {/* Mobile drawer */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>
          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarInner pathname={pathname} isAdmin={isAdmin} register={register} typeIcons={typeIcons} onNavigate={() => setOpen(false)} />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-10 lg:flex lg:w-72 lg:flex-col">
        <SidebarInner pathname={pathname} isAdmin={isAdmin} register={register} typeIcons={typeIcons} />
      </div>

      <div className="lg:pl-72">
        {/* Top nav */}
        <div
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-x-4 px-4 sm:px-6 lg:px-8"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}
        >
          <button
            type="button"
            className="-m-2.5 p-2.5 lg:hidden"
            style={{ color: 'var(--muted)' }}
            onClick={() => setOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-5 w-5" aria-hidden="true" />
          </button>

          <TopSearch />

          <span className="flex-1" aria-hidden />

          <UserMenu user={user} />
        </div>

        <main className="py-10">
          <div className="relative px-4 sm:px-6 lg:px-8">
            <ConfirmProvider>{children}</ConfirmProvider>
          </div>
        </main>
      </div>
      </div>
    </ChoiceProvider>
  );
}
