import type { FieldDef } from '@/lib/supabase/types';
import { formatDate } from '@/lib/format';
import { getChoices } from '@/lib/definitions/choices';
import Chip from '@/components/entity/Chips';
import RichTextView from '@/components/rich-text/RichTextView';
import { UserName, UserNames } from './UsersContext';

const EMPTY = <span style={{ color: 'var(--muted-2)' }}>–</span>;

/** Read-only render of a single field's value, per data_type. */
export default function FieldValue({
  field,
  value,
}: {
  field: FieldDef;
  value: unknown;
}) {
  if (value === null || value === undefined || value === '') {
    return field.data_type === 'richtext' ? <RichTextView value="" /> : EMPTY;
  }

  switch (field.data_type) {
    case 'enum': {
      const c = getChoices(field).find((x) => x.key === String(value));
      return <Chip value={String(value)} tone={c?.tone} label={c?.label} />;
    }
    case 'date':
      return <>{formatDate(value)}</>;
    case 'boolean':
      return <>{value ? 'Yes' : 'No'}</>;
    case 'richtext':
      return <RichTextView value={String(value)} />;
    case 'number': {
      const { labels, min } = field.options ?? {};
      if (labels && labels.length && min != null) {
        const word = labels[Number(value) - min];
        return <>{word ? `${word}` : String(value)}</>;
      }
      return <>{String(value)}</>;
    }
    case 'user':
      return <UserName id={String(value)} />;
    case 'users':
      return <UserNames ids={Array.isArray(value) ? (value as string[]) : []} />;
    case 'text':
    default:
      return <>{String(value)}</>;
  }
}
