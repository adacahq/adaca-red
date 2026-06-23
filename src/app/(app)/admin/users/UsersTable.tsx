'use client';

import RoleSelect from './RoleSelect';
import DataTable, { type Column } from '@/components/ui/DataTable';

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
}

export default function UsersTable({ users }: { users: UserRow[] }) {
  const cols: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'User',
      cell: (u) => <span style={{ color: 'var(--ink)' }}>{u.name ?? '–'}</span>,
      sortValue: (u) => (u.name ?? '').toLowerCase(),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (u) => <span style={{ color: 'var(--muted)' }}>{u.email ?? '–'}</span>,
      sortValue: (u) => (u.email ?? '').toLowerCase(),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (u) => <RoleSelect userId={u.id} role={u.role} />,
      sortValue: (u) => (u.role ?? '').toLowerCase(),
    },
  ];
  return <DataTable columns={cols} rows={users} getRowKey={(u) => u.id} empty="No users yet." />;
}
