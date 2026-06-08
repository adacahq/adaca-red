import { z } from 'zod';
import type { EdgeConfig, FieldDef, NodeConfig } from '@/lib/supabase/types';
import { getChoices } from './choices';

/**
 * Turn a definition's field list into a Zod schema. Single source of truth for
 * form validation and server-side write validation — both read from the same
 * `definitions.config.fields`.
 *
 * Rules:
 *  - number with both min+max is treated as a banded INTEGER score (RED 0–4,
 *    likelihood/impact 1–5) and enforced as such.
 *  - text/richtext required fields must be non-empty.
 *  - non-required fields are optional + nullable.
 */
function fieldSchema(f: FieldDef): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (f.data_type) {
    case 'number': {
      let n = z.coerce.number();
      const { min, max } = f.options ?? {};
      if (min != null && max != null) n = n.int(); // banded score → integer
      if (min != null) n = n.min(min);
      if (max != null) n = n.max(max);
      schema = n;
      break;
    }
    case 'enum': {
      const keys = getChoices(f).map((c) => c.key);
      schema = keys.length > 0 ? z.enum(keys as [string, ...string[]]) : z.string();
      break;
    }
    case 'date':
      schema = z.coerce.date();
      break;
    case 'boolean':
      schema = z.coerce.boolean();
      break;
    case 'text':
    case 'richtext':
    case 'user':
    default:
      schema = f.required ? z.string().min(1) : z.string();
      break;
  }

  return f.required ? schema : schema.optional().nullable();
}

/** Build a Zod object from a flat field list. */
export function fieldsToZod(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) shape[f.key] = fieldSchema(f);
  return z.object(shape);
}

/** Build a Zod object for a node/edge definition's `config`. */
export function definitionToZod(config: NodeConfig | EdgeConfig) {
  return fieldsToZod(config.fields ?? []);
}
