/** Human date for display. Returns an em-dash for empty values. */
export function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Title-case a slug/key for fallback labels. */
export function humanise(key: string): string {
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
