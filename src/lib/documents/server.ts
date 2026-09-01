import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import {
  extractPptxText as extractPptxTextSync,
  extractXlsxText as extractXlsxTextSync,
  sniffOoxmlKind,
} from './ooxml';

type DB = SupabaseClient<Database>;
export type DocumentRow = Database['public']['Tables']['documents']['Row'];

export { sniffOoxmlKind };

export const DOCUMENTS_BUCKET = 'documents';

/** Store one uploaded file: Storage object + documents row. Service-role only. */
export async function storeDocument(
  db: DB,
  input: { nodeId: string; filename: string; mimeType: string; bytes: Uint8Array },
): Promise<DocumentRow> {
  const { data: row, error } = await db
    .from('documents')
    .insert({
      node_id: input.nodeId,
      filename: input.filename,
      mime_type: input.mimeType,
      size_bytes: input.bytes.byteLength,
      storage_path: '', // set below once the id exists
    })
    .select('*')
    .single();
  if (error) throw error;

  const path = `${input.nodeId}/${row.id}/${input.filename}`;
  const { error: upErr } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, input.bytes.slice().buffer as ArrayBuffer, { contentType: input.mimeType, upsert: true });
  if (upErr) {
    await db.from('documents').delete().eq('id', row.id);
    throw upErr;
  }

  const { data: updated, error: pathErr } = await db
    .from('documents')
    .update({ storage_path: path })
    .eq('id', row.id)
    .select('*')
    .single();
  if (pathErr) throw pathErr;
  return updated;
}

export async function listDocuments(db: DB, nodeId: string): Promise<DocumentRow[]> {
  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function downloadDocument(db: DB, doc: DocumentRow): Promise<Uint8Array> {
  const { data, error } = await db.storage.from(DOCUMENTS_BUCKET).download(doc.storage_path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}

/** Remove the Storage objects for a set of nodes (purge cron; rows cascade). */
export async function removeDocumentObjects(db: DB, nodeIds: string[]): Promise<number> {
  if (nodeIds.length === 0) return 0;
  const { data, error } = await db
    .from('documents')
    .select('storage_path')
    .in('node_id', nodeIds)
    .neq('storage_path', '');
  if (error) throw error;
  const paths = (data ?? []).map((d) => d.storage_path);
  if (paths.length === 0) return 0;
  const { error: rmErr } = await db.storage.from(DOCUMENTS_BUCKET).remove(paths);
  if (rmErr) throw rmErr;
  return paths.length;
}

/** DOCX → plain text (mammoth; dynamic import keeps it out of client bundles). */
export async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import('mammoth');
  // mammoth's node build reads {buffer}; its browser build (which bundlers
  // can select via the package's "browser" field) reads {arrayBuffer}.
  // Provide both so extraction works in dev (node) and on Workers alike.
  const copy = bytes.slice();
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(copy.buffer),
    arrayBuffer: copy.buffer,
  } as { arrayBuffer: ArrayBuffer });
  return result.value.trim();
}

/** PPTX → plain text (fflate + regex `<a:t>` extraction; re-exports the pure,
 *  vitest-tested implementation in `ooxml.ts` as async for signature parity
 *  with `extractDocxText`). */
export async function extractPptxText(bytes: Uint8Array): Promise<string> {
  return extractPptxTextSync(bytes);
}

/** XLSX → plain text (sheet names + shared/inline strings; re-exports the
 *  pure, vitest-tested implementation in `ooxml.ts` as async for signature
 *  parity with `extractDocxText`). */
export async function extractXlsxText(bytes: Uint8Array): Promise<string> {
  return extractXlsxTextSync(bytes);
}
