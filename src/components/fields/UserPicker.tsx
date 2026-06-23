'use client';

import { XMarkIcon } from '@heroicons/react/20/solid';
import Select from '@/components/ui/Select';
import { useUsers, userLabel } from './UsersContext';

/** Single-user picker — stores one `users.id`. Options come from the app-wide
 *  UsersProvider, so no per-form fetch. */
export function UserSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string | null) => void;
  label?: string;
}) {
  const users = useUsers();
  const options = Object.entries(users).map(([id, u]) => ({ value: id, label: u.name ?? u.email ?? id }));
  return (
    <Select
      fullWidth
      ariaLabel={label ?? 'Person'}
      placeholder="Select person…"
      value={value ?? ''}
      onChange={(v) => onChange(v || null)}
      options={options}
    />
  );
}

/** Multi-user picker — stores `string[]` of `users.id`. Add via the dropdown,
 *  remove via the chips. */
export function UsersSelect({
  value,
  onChange,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  label?: string;
}) {
  const users = useUsers();
  const selected = Array.isArray(value) ? value : [];
  const options = Object.entries(users)
    .filter(([id]) => !selected.includes(id))
    .map(([id, u]) => ({ value: id, label: u.name ?? u.email ?? id }));

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1"
              style={{ fontSize: 12, padding: '2px 4px 2px 8px', border: '1px solid var(--line)', background: 'var(--bg-alt)' }}
            >
              {userLabel(users, id)}
              <button
                type="button"
                className="muted-link"
                title="Remove"
                onClick={() => onChange(selected.filter((x) => x !== id))}
              >
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <Select
        fullWidth
        ariaLabel={label ?? 'Add person'}
        placeholder="Add person…"
        value=""
        onChange={(v) => {
          if (v) onChange([...selected, v]);
        }}
        options={options}
      />
    </div>
  );
}
