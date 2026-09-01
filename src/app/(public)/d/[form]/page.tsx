import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadForm } from '@/lib/forms/server';
import { exposedFields } from '@/lib/forms/config';
import { loadRetentionSettings } from '@/lib/settings/server';
import { resolveRetention, retentionCopy } from '@/lib/settings/retention';
import type { WorkflowConfig } from '@/lib/supabase/types';
import RichTextView from '@/components/rich-text/RichTextView';
import PublicForm from '@/components/public/PublicForm';
import LandingBlocks from '@/components/public/LandingBlocks';

export const metadata = { robots: { index: false, follow: false } };

export default async function PublicFormPage({ params }: { params: Promise<{ form: string }> }) {
  const { form: formKey } = await params;
  const db = createAdminClient();
  const form = await loadForm(db, formKey);
  if (!form) notFound();

  const appRetention = await loadRetentionSettings(db);
  const privacy = retentionCopy(
    resolveRetention('submission', appRetention.submission, form.config),
    resolveRetention('assessment', appRetention.assessment, form.config),
  );

  const fields = exposedFields(form.config, form.targetConfig.fields ?? []);
  const blocks = form.config.copy.blocks ?? [];
  const cta = form.config.copy.cta;

  // Verdict thresholds for a verdictLegend block only — absent/anything
  // missing renders items' own descriptions (or none) instead.
  let thresholds: { green: number; amber: number } | null = null;
  if (blocks.some((b) => b.type === 'verdictLegend') && form.config.workflow) {
    const { data: wfDef } = await db
      .from('definitions')
      .select('*')
      .eq('kind', 'workflow')
      .eq('key', form.config.workflow)
      .maybeSingle();
    const workflow = wfDef ? ((wfDef.config ?? {}) as unknown as WorkflowConfig) : null;
    const verdictStep = workflow?.steps.find((s) => s.type === 'verdict');
    if (verdictStep && verdictStep.type === 'verdict') thresholds = verdictStep.config.thresholds;
  }

  return (
    <div>
      <p className="eyebrow rv">Diagnostic</p>
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
          {form.config.copy.title || form.def.label}
        </h1>
        {cta && (
          <span className="rv" style={{ '--i': 2 } as CSSProperties}>
            <a className="btn btn-primary" href={cta.href}>{cta.label}</a>
          </span>
        )}
      </div>
      {form.config.copy.intro && (
        <div className="lede rv" style={{ '--i': 2 } as CSSProperties}>
          <RichTextView value={form.config.copy.intro} />
        </div>
      )}

      {/* One column, one width. `.dive` clamps itself to 560 but `.mstones`
          and `.stats` do not, so leaving these unclamped made the steps read
          at 560 and the verdict legend at the full 1100 — visibly ragged
          against a 54ch lede. Clamping here lines every block up with the
          lede and the form below. */}
      {blocks.length > 0 && (
        <div style={{ maxWidth: 560 }}>
          <LandingBlocks blocks={blocks} thresholds={thresholds} />
        </div>
      )}

      <div className="mt-10" style={{ maxWidth: 560 }}>
        <PublicForm
          formKey={form.def.key}
          fields={fields}
          uploads={form.config.uploads ?? null}
          submitLabel={form.config.copy.submitLabel ?? 'Submit'}
          turnstileSiteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''}
        />
      </div>

      <p
        className="mt-10 text-[13px]"
        style={{ maxWidth: 560, color: 'var(--muted)', lineHeight: 1.7, borderTop: '1px solid var(--line)', paddingTop: 16 }}
      >
        {privacy}
        {form.config.copy.privacyNote ? ` ${form.config.copy.privacyNote}` : ''}
      </p>
    </div>
  );
}
