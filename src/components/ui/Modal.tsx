'use client';

import { Fragment, ReactNode } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';

/**
 * On-brand modal: dark scrim, hairline panel, registration mark, mono header.
 * No rounded corners; one orchestrated rise+fade on open.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[60]">
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0" style={{ background: 'rgba(5,7,11,0.72)', backdropFilter: 'blur(2px)' }} />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
            <Transition.Child
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <Dialog.Panel
                className="relative w-full"
                style={{
                  maxWidth,
                  marginTop: '7vh',
                  background: 'var(--bg-alt)',
                  border: '1px solid var(--line)',
                }}
              >
                <span className="mark" style={{ top: 0, left: 0 }} aria-hidden />
                <div
                  className="flex items-center gap-3 px-6 py-4"
                  style={{ borderBottom: '1px solid var(--line)' }}
                >
                  <Dialog.Title
                    className="mono"
                    style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)' }}
                  >
                    {title}
                  </Dialog.Title>
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={onClose} className="muted-link" aria-label="Close">
                    <XMarkIcon className="h-5 w-5" aria-hidden />
                  </button>
                </div>

                <div className="px-6 py-5">{children}</div>

                {footer && (
                  <div
                    className="flex items-center justify-end gap-3 px-6 py-4"
                    style={{ borderTop: '1px solid var(--line)' }}
                  >
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
