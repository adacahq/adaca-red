'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '@heroicons/react/20/solid';
import { deleteNode } from '@/lib/nodes/actions';
import { useConfirm } from '@/components/ui/Confirm';

export default function DeleteNodeButton({
  id,
  redirectTo,
  label = 'Delete',
}: {
  id: string;
  redirectTo: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const confirm = useConfirm();

  async function onClick() {
    const ok = await confirm({
      title: 'Delete',
      body: 'Delete this and everything nested under it? This can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    startTransition(async () => {
      await deleteNode(id, redirectTo);
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={onClick}>
      {pending ? <span className="spinner" aria-hidden /> : <TrashIcon className="h-4 w-4" aria-hidden />}
      {label}
    </button>
  );
}
