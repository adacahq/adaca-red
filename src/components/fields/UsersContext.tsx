'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** id → display info, loaded once in the app shell (mirrors ChoiceProvider). */
export type UserMeta = Record<string, { name: string | null; email: string | null }>;

const Ctx = createContext<UserMeta>({});

export function UsersProvider({ value, children }: { value: UserMeta; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUsers(): UserMeta {
  return useContext(Ctx);
}

/** Resolve a user id to a display label (name → email → the raw id). */
export function userLabel(meta: UserMeta, id: string): string {
  const u = meta[id];
  return u?.name ?? u?.email ?? id;
}

const DASH = <span style={{ color: 'var(--muted-2)' }}>–</span>;

/** Client island: render a single user id as a name (usable in server trees). */
export function UserName({ id }: { id: string }) {
  const meta = useUsers();
  return <>{userLabel(meta, id)}</>;
}

/** Client island: render a list of user ids as comma-joined names. */
export function UserNames({ ids }: { ids: string[] }) {
  const meta = useUsers();
  if (!ids.length) return DASH;
  return <>{ids.map((id) => userLabel(meta, id)).join(', ')}</>;
}
