'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ChoiceMeta } from '@/lib/definitions/choices';

const Ctx = createContext<ChoiceMeta>({});

/** Provides the definitions-derived key → {label, tone} map to all chips. */
export function ChoiceProvider({ value, children }: { value: ChoiceMeta; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChoiceMeta(): ChoiceMeta {
  return useContext(Ctx);
}
