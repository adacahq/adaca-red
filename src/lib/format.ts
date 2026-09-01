/**
 * Deterministic date formatting. Locale-dependent formatters (toLocaleString
 * et al) render differently in Node and the browser and cause hydration
 * mismatches in SSR'd client components — never use them in components.
 *
 * Local getDate()/getHours() have the same disease in different clothes: the
 * server renders in its zone, the browser re-renders in the reader's, and the
 * markup disagrees. So nothing here reads the environment's timezone:
 * date-only values ('2026-08-16') are calendar facts and render from UTC
 * parts; instants render in the product's home zone (Australia/Sydney) via
 * formatToParts with every field pinned — same output on every machine.
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ISO_DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const SYDNEY = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
});

function sydneyParts(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of SYDNEY.formatToParts(d)) out[p.type] = p.value;
  return out;
}

export function fmtDate(input: string | number | Date): string {
  // A bare day is a calendar fact — render it as written, never shifted by
  // whoever happens to be reading it.
  if (typeof input === 'string' && ISO_DAY_ONLY.test(input)) {
    const d = new Date(`${input}T00:00:00Z`);
    return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  const p = sydneyParts(new Date(input));
  return `${p.day.padStart(2, '0')} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

/**
 * Today as an ISO day in the product's home zone — THE "today" for overdue,
 * stale and schedule comparisons. Identical on server and browser, so an
 * SSR'd component can render it without a hydration mismatch.
 */
export function todayISO(): string {
  const p = sydneyParts(new Date());
  return `${p.year}-${p.month.padStart(2, '0')}-${p.day.padStart(2, '0')}`;
}

export function fmtDateTime(input: string | number | Date): string {
  const p = sydneyParts(new Date(input));
  // hour12:false can yield '24' at midnight in some ICU builds.
  const hh = String(Number(p.hour) % 24).padStart(2, '0');
  return `${p.day.padStart(2, '0')} ${MONTHS[Number(p.month) - 1]} ${p.year} ${hh}:${p.minute.padStart(2, '0')}`;
}

export function fmtMonth(input: number | Date): string {
  const d = new Date(input);
  return `${MONTHS[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`;
}

/* ── Currency ────────────────────────────────────────────────
 * Australian dollars, deterministic. Negatives lead with a real minus
 * (U+2212) before the symbol — '−A$9,919' — so a column of figures aligns
 * on the sign rather than on a hyphen. Rounding happens before the sign is
 * chosen, so a value that rounds to nothing reads 'A$0', never '−A$0'.
 */

function separate(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Exact to the dollar: 'A$612,000', '−A$9,919'. */
export function fmtCurrency(n: number): string {
  const abs = Math.round(Math.abs(n));
  const sign = abs > 0 && n < 0 ? '−' : '';
  return `${sign}A$${separate(abs)}`;
}

/**
 * Compact, for slates and cards: 'A$612k', 'A$1.23m', 'A$980'.
 * Anything that would round to 1,000k is written in millions instead.
 */
export function fmtCurrencyK(n: number): string {
  const abs = Math.abs(n);
  const sign = abs >= 0.5 && n < 0 ? '−' : '';
  if (abs >= 999_500) return `${sign}A$${(abs / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `${sign}A$${Math.round(abs / 1_000)}k`;
  return `${sign}A$${separate(Math.round(abs))}`;
}

/** Hours, thousands-separated, at most one decimal: '1,462 h', '7.5 h'. */
export function fmtHours(n: number): string {
  const abs = Math.round(Math.abs(n) * 10) / 10;
  const whole = Math.floor(abs);
  const tenths = Math.round((abs - whole) * 10);
  const sign = abs > 0 && n < 0 ? '−' : '';
  return `${sign}${separate(whole)}${tenths ? `.${tenths}` : ''} h`;
}

/**
 * The number out of a human key: `BL-0014` → `14`.
 *
 * The big left-hand numeral on a queue row is the number, not the prefix — the
 * prefix is already in the link beside it. Anything that does not parse comes
 * back as written rather than as NaN.
 */
export function shortNum(key: string): string {
  const tail = key.split('-').pop() ?? key;
  const n = Number(tail);
  return Number.isFinite(n) ? String(n) : tail;
}

/**
 * Back-compat wrapper over fmtDate() for the call sites that pre-date this
 * module: same '–' for empty values and echo-back for anything that doesn't
 * parse as a date, but the deterministic Sydney/UTC rendering underneath
 * instead of toLocaleDateString (which caused SSR hydration mismatches).
 */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  const raw = String(value);
  if (Number.isNaN(new Date(raw).getTime())) return raw;
  return fmtDate(raw);
}

/** Title-case a slug/key for fallback labels. */
export function humanise(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
