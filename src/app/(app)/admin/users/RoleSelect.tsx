'use client';

import { useState, useTransition } from 'react';
import { setUserRole } from './actions';
import Select from '@/components/ui/Select';

const ROLES = ['viewer', 'member', 'owner', 'admin'];

export default function RoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: string | null;
}) {
  const [value, setValue] = useState(role ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(next: string) {
    setValue(next);
    setError(null);
    startTransition(async () => {
      try {
        await setUserRole(userId, next === '' ? null : next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed');
        setValue(role ?? '');
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Select
        mono
        ariaLabel="System role"
        placeholder="No role"
        value={value}
        onChange={change}
        disabled={pending}
        options={[{ value: '', label: 'No role' }, ...ROLES.map((r) => ({ value: r, label: r }))]}
      />
      {pending && <span className="spinner" aria-hidden />}
      {error && <span style={{ fontSize: 11, color: 'var(--crit)' }}>{error}</span>}
    </span>
  );
}
