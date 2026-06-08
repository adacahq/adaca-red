import type { DefinitionRow } from '@/lib/supabase/types';
import { fieldsOf } from '@/lib/definitions/server';
import FieldValue from '@/components/fields/FieldValue';

/** Definition-driven read view of a node's fields (excludes title by default). */
export default function FieldsPanel({
  def,
  data,
  exclude = ['title'],
}: {
  def: DefinitionRow;
  data: Record<string, unknown>;
  exclude?: string[];
}) {
  const fields = fieldsOf(def)
    .filter((f) => !exclude.includes(f.key))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  if (fields.length === 0) return null;

  return (
    <dl
      className="my-4 grid grid-cols-1 sm:grid-cols-[180px_1fr]"
      style={{ border: '1px solid var(--line)', margin: 0 }}
    >
      {fields.map((f, i) => {
        const border = i === fields.length - 1 ? 'none' : '1px solid var(--line)';
        return (
          <div key={f.key} className="contents">
            <dt
              className="field-label"
              style={{ padding: '12px 16px', margin: 0, borderBottom: border }}
            >
              {f.label}
            </dt>
            <dd
              style={{ padding: '12px 16px', margin: 0, borderBottom: border, fontSize: 14, color: 'var(--ink)' }}
            >
              <FieldValue field={f} value={data[f.key]} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
