'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { assignUser, unassignUser } from '@/lib/nodes/actions';
import Select from '@/components/ui/Select';

interface MiniUser { id: string; name: string | null; email: string | null }
interface MiniRole { key: string; label: string }
interface MiniAssignment { id: string; user_id: string; role_key: string }

export default function AssignmentsPanel({
  nodeId,
  users,
  roles,
  assignments,
  revalidate,
}: {
  nodeId: string;
  users: MiniUser[];
  roles: MiniRole[];
  assignments: MiniAssignment[];
  revalidate: string;
}) {
  const [userId, setUserId] = useState('');
  const [roleKey, setRoleKey] = useState(roles[0]?.key ?? '');
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const userById = Object.fromEntries(users.map((u) => [u.id, u]));
  const roleLabel = Object.fromEntries(roles.map((r) => [r.key, r.label]));

  return (
    <div className="my-4">
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {assignments.map((a) => {
          const u = userById[a.user_id];
          return (
            <li
              key={a.id}
              className="flex items-center gap-3 py-2.5"
              style={{ borderBottom: '1px solid var(--line)' }}
            >
              <span style={{ fontSize: 14, color: 'var(--ink)', flex: 1 }}>
                {u?.name ?? u?.email ?? a.user_id}
              </span>
              <span
                className="mono"
                style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}
              >
                {roleLabel[a.role_key] ?? a.role_key}
              </span>
              <button
                type="button"
                className="muted-link"
                title="Remove"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await unassignUser(a.id, revalidate);
                    router.refresh();
                  })
                }
              >
                <XMarkIcon className="h-4 w-4" aria-hidden />
              </button>
            </li>
          );
        })}
        {assignments.length === 0 && (
          <li className="py-2 text-[13px]" style={{ color: 'var(--muted-2)' }}>
            No one assigned.
          </li>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Select
          ariaLabel="Person"
          placeholder="Select person…"
          value={userId}
          onChange={setUserId}
          options={users.map((u) => ({ value: u.id, label: u.name ?? u.email ?? u.id }))}
        />
        <Select
          mono
          ariaLabel="Role"
          value={roleKey}
          onChange={setRoleKey}
          options={roles.map((r) => ({ value: r.key, label: r.label }))}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={pending || !userId || !roleKey}
          onClick={() =>
            startTransition(async () => {
              await assignUser(nodeId, userId, roleKey, revalidate);
              setUserId('');
              router.refresh();
            })
          }
        >
          Assign
        </button>
      </div>
    </div>
  );
}
