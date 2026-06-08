/**
 * Recently-engaged nodes, persisted to localStorage. A tiny external store so
 * the sidebar can subscribe via useSyncExternalStore (no setState-in-effect),
 * and detail pages can record visits. Most-recent first, de-duplicated by id.
 */
export type RecentType = 'initiative' | 'risk' | 'incident';

export interface RecentEntry {
  type: RecentType;
  id: string;
  title: string;
  ts: number;
}

const KEY = 'red:recents';
const LIMIT = 8;
const EMPTY: RecentEntry[] = [];

let cache: RecentEntry[] | null = null;
const listeners = new Set<() => void>();

function read(): RecentEntry[] {
  if (typeof window === 'undefined') return EMPTY;
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentEntry[]) : EMPTY;
    cache = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: RecentEntry[]) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — keep the in-memory copy */
  }
  listeners.forEach((l) => l());
}

export function recordRecent(entry: Omit<RecentEntry, 'ts'>) {
  if (typeof window === 'undefined') return;
  const rest = read().filter((x) => !(x.id === entry.id && x.type === entry.type));
  write([{ ...entry, ts: Date.now() }, ...rest].slice(0, LIMIT));
}

export function clearRecents() {
  write([]);
}

export function subscribeRecents(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === KEY) {
      cache = null; // another tab changed it — re-read on next snapshot
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function getRecentsSnapshot(): RecentEntry[] {
  return read();
}

export function getRecentsServerSnapshot(): RecentEntry[] {
  return EMPTY;
}
