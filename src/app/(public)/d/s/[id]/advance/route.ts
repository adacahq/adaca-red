import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { advanceRun } from '@/lib/workflows/runner';

/**
 * Pump one unit of the submission's workflow (docs/workflow-forms-plan.md
 * §7.3, revised): the status page calls this in a loop while the submitter
 * waits; each call performs at most one LLM call, so it stays well inside
 * request limits. Abandoned runs are swept by the cron.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const origin = process.env.PUBLIC_ORIGIN ?? new URL(request.url).origin;
    const progress = await advanceRun(createAdminClient(), id, origin);
    if (!progress) return NextResponse.json({ error: 'Unknown submission' }, { status: 404 });
    return NextResponse.json(progress);
  } catch (err) {
    console.error('advance failed', err);
    return NextResponse.json({ error: 'Processing hiccup, retrying.' }, { status: 500 });
  }
}
