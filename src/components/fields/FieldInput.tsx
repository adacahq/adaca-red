'use client';

import type { FieldDef } from '@/lib/supabase/types';
import { getChoices } from '@/lib/definitions/choices';
import RichText from '@/components/rich-text/RichText';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import { UserSelect, UsersSelect } from './UserPicker';

export type FieldValueT = string | number | boolean | string[] | null | undefined;

/**
 * True when the control renders its own label, so a caller must NOT also
 * render one above it. Only booleans do: `.check` places the text after the
 * box, and a second label above would duplicate it.
 */
export function rendersOwnLabel(field: FieldDef): boolean {
  return field.data_type === 'boolean';
}

export default function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: FieldValueT;
  onChange: (v: FieldValueT) => void;
}) {
  const id = `f-${field.key}`;

  switch (field.data_type) {
    case 'richtext':
      return (
        <RichText value={(value as string) ?? ''} onChange={(md) => onChange(md)} />
      );

    case 'enum':
      return (
        <Select
          mono
          fullWidth
          ariaLabel={field.label}
          placeholder="–"
          value={(value as string) ?? ''}
          onChange={(v) => onChange(v || null)}
          options={getChoices(field).map((c) => ({ value: c.key, label: c.label }))}
        />
      );

    case 'boolean':
      // `.check` is a box PLUS its text — with no text child it renders as an
      // orphaned square floating under a label it isn't visibly attached to.
      // So a boolean owns its label and puts it after the box, as PMO does;
      // callers skip the label above via rendersOwnLabel().
      return (
        <label className="check">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>
            {field.label}
            {field.required ? ' *' : ''}
          </span>
        </label>
      );

    case 'number': {
      const { min, max, labels } = field.options ?? {};
      // Labeled scale → word dropdown (e.g. Very low…Very high), stores the number.
      if (labels && labels.length && min != null) {
        return (
          <Select
            fullWidth
            ariaLabel={field.label}
            placeholder="–"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(v) => onChange(v === '' ? null : Number(v))}
            options={labels.map((label, i) => ({ value: String(min + i), label }))}
          />
        );
      }
      return (
        <input
          id={id}
          type="number"
          className="field-input"
          min={min}
          max={max}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    }

    case 'date':
      return (
        <DatePicker
          fullWidth
          ariaLabel={field.label}
          value={(value as string) ?? ''}
          onChange={(v) => onChange(v || null)}
        />
      );

    case 'user':
      return <UserSelect label={field.label} value={(value as string) ?? ''} onChange={(v) => onChange(v)} />;

    case 'users':
      return <UsersSelect label={field.label} value={(value as string[]) ?? []} onChange={(v) => onChange(v)} />;

    case 'text':
    default:
      return (
        <input
          id={id}
          type="text"
          className="field-input"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
