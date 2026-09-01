import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadForm } from '@/lib/forms/server';
import {
  createSubmission,
  SubmissionError,
  verifyTurnstile,
  type IncomingFile,
} from '@/lib/forms/submit';

/**
 * Public multipart submission endpoint. A route handler (not a server action)
 * so large uploads stream in without the action body-size ceiling. Order of
 * defence: Turnstile → schema validation → file sniffing → service-role write.
 * (Per-IP rate limiting happens a layer up, in worker/index.ts.)
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ form: string }> }) {
  const { form: formKey } = await ctx.params;
  try {
    const db = createAdminClient();
    const form = await loadForm(db, formKey);
    if (!form) return NextResponse.json({ error: 'Unknown form' }, { status: 404 });

    const formData = await request.formData();

    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for');
    const human = await verifyTurnstile(formData.get('turnstile') as string | null, ip);
    if (!human) {
      return NextResponse.json(
        { error: 'Verification failed. Please retry the challenge.' },
        { status: 403 },
      );
    }

    let values: unknown = {};
    try {
      values = JSON.parse((formData.get('values') as string | null) ?? '{}');
    } catch {
      return NextResponse.json({ error: 'Malformed submission' }, { status: 400 });
    }

    const files: IncomingFile[] = [];
    for (const entry of formData.getAll('files')) {
      if (entry instanceof File) {
        files.push({ filename: entry.name, bytes: new Uint8Array(await entry.arrayBuffer()) });
      }
    }

    const { id } = await createSubmission(db, form, values, files);
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof SubmissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('submit failed', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
