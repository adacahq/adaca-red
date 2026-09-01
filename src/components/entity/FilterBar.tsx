'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { FieldDef } from '@/lib/supabase/types';
import { getChoices } from '@/lib/definitions/choices';
import Select from '@/components/ui/Select';

/** Small enum sets read as buttons (`.seg`); larger ones stay a dropdown so
 *  the filter row doesn't run away on a wide-open field. */
const SEG_MAX_CHOICES = 6;

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
    <div className="mb-8 flex flex-wrap items-end gap-6">
      {enums.map((f) => {
        const choices = getChoices(f);
        const current = params?.get(f.key) ?? '';
        if (choices.length > 0 && choices.length <= SEG_MAX_CHOICES) {
          return (
            <div key={f.key}>
              <span className="field-label">{f.label}</span>
              <div className="seg">
                <button type="button" className={current === '' ? 'on' : undefined} onClick={() => setParam(f.key, '')}>
                  All
                </button>
                {choices.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={current === c.key ? 'on' : undefined}
                    onClick={() => setParam(f.key, c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          );
        }
        return (
          <Select
            key={f.key}
            mono
            ariaLabel={`Filter by ${f.label}`}
            placeholder={`${f.label}: all`}
            value={current}
            onChange={(v) => setParam(f.key, v)}
            options={[
              { value: '', label: `${f.label}: all` },
              ...choices.map((c) => ({ value: c.key, label: c.label })),
            ]}
          />
        );
      })}
    </div>
  );
}
