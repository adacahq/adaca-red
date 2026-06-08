'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FieldDef } from '@/lib/supabase/types';
import { getChoices } from '@/lib/definitions/choices';
import Select from '@/components/ui/Select';

/** URL-driven filter controls built from a definition's filterable fields. */
export default function FilterBar({ fields }: { fields: FieldDef[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params?.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const enums = fields.filter((f) => f.data_type === 'enum');
  if (enums.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <span
        className="mono"
        style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-2)' }}
      >
        Filter
      </span>
      {enums.map((f) => (
        <Select
          key={f.key}
          mono
          ariaLabel={`Filter by ${f.label}`}
          placeholder={`${f.label}: all`}
          value={params?.get(f.key) ?? ''}
          onChange={(v) => setParam(f.key, v)}
          options={[
            { value: '', label: `${f.label}: all` },
            ...getChoices(f).map((c) => ({ value: c.key, label: c.label })),
          ]}
        />
      ))}
    </div>
  );
}
