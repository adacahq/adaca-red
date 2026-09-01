'use client';

import { useState } from 'react';
import NodeEditModal from './NodeEditModal';
import type { FieldDef, NodeRow } from '@/lib/supabase/types';

/** Header "Edit" that opens the full-field modal (consistent with the tree). */
export default function EditNodeButton({
  node,
  fields,
  typeLabel,
  revalidatePath,
}: {
  node: NodeRow;
  fields: FieldDef[];
  typeLabel: string;
  revalidatePath: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost sm" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open && (
        <NodeEditModal
          open={open}
          onClose={() => setOpen(false)}
          node={node}
          fields={fields}
          typeLabel={typeLabel}
          revalidatePath={revalidatePath}
        />
      )}
    </>
  );
}
