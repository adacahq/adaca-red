import { describe, expect, it } from 'vitest';
import type { FieldDef } from '@/lib/supabase/types';
import { fieldsToZod } from './zod';

/**
 * The definitions→Zod engine predates this suite but now also validates every
 * public form submission — pin its behaviour.
 */

function schema(fields: FieldDef[]) {
  return fieldsToZod(fields);
}

describe('fieldsToZod', () => {
  it('required text must be non-empty', () => {
    const s = schema([{ key: 't', label: 'T', data_type: 'text', required: true }]);
    expect(s.safeParse({ t: 'x' }).success).toBe(true);
    expect(s.safeParse({ t: '' }).success).toBe(false);
    expect(s.safeParse({}).success).toBe(false);
  });

  it('optional fields accept undefined and null', () => {
    const s = schema([{ key: 't', label: 'T', data_type: 'text' }]);
    expect(s.safeParse({}).success).toBe(true);
    expect(s.safeParse({ t: null }).success).toBe(true);
  });

  it('banded numbers (min+max) are integers within range', () => {
    const s = schema([
      { key: 'n', label: 'N', data_type: 'number', required: true, options: { min: 0, max: 4 } },
    ]);
    expect(s.safeParse({ n: 3 }).success).toBe(true);
    expect(s.safeParse({ n: '2' }).success).toBe(true); // coerced
    expect(s.safeParse({ n: 2.5 }).success).toBe(false); // banded → integer
    expect(s.safeParse({ n: 5 }).success).toBe(false);
    expect(s.safeParse({ n: -1 }).success).toBe(false);
  });

  it('enums accept only declared choice keys (object and legacy string forms)', () => {
    const s = schema([
      {
        key: 'e',
        label: 'E',
        data_type: 'enum',
        required: true,
        options: { choices: [{ key: 'green', tone: 'ok' }, 'amber'] },
      },
    ]);
    expect(s.safeParse({ e: 'green' }).success).toBe(true);
    expect(s.safeParse({ e: 'amber' }).success).toBe(true);
    expect(s.safeParse({ e: 'purple' }).success).toBe(false);
  });

  it('required users lists need at least one entry', () => {
    const s = schema([{ key: 'u', label: 'U', data_type: 'users', required: true }]);
    expect(s.safeParse({ u: ['abc'] }).success).toBe(true);
    expect(s.safeParse({ u: [] }).success).toBe(false);
  });

  it('dates coerce from ISO strings', () => {
    const s = schema([{ key: 'd', label: 'D', data_type: 'date', required: true }]);
    const good = s.safeParse({ d: '2026-07-04' });
    expect(good.success).toBe(true);
    if (good.success) expect((good.data as { d: Date }).d).toBeInstanceOf(Date);
    expect(s.safeParse({ d: 'not a date' }).success).toBe(false);
  });
});
