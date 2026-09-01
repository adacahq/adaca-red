import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRunProgress } from '@/lib/workflows/runner';

/** Read-only run progress for the public status page's first paint. */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const progress = await getRunProgress(createAdminClient(), id);
    if (!progress) return NextResponse.json({ error: 'Unknown submission' }, { status: 404 });
    return NextResponse.json(progress);
  } catch (err) {
    console.error('status failed', err);
    return NextResponse.json({ error: 'Status unavailable' }, { status: 500 });
  }
}
