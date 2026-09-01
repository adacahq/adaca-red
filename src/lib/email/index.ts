/**
 * Transactional app email via Resend (server-only; RESEND_API_KEY / EMAIL_FROM
 * secrets). Microsoft SSO means Supabase sends no auth mail, so anything the
 * app sends goes through here. Plain fetch against the Resend REST API — no
 * SDK dependency needed for one endpoint.
 */

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendEmail(input: EmailInput): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error('RESEND_API_KEY / EMAIL_FROM are not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

const VERDICT_HUES: Record<string, string> = {
  green: '#38b26a',
  amber: '#d9a13b',
  red: '#d95c4a',
};

/** Minimal on-brand report email: dark, hairlines, mono labels, orange accent. */
export function reportEmailHtml(input: {
  title: string;
  verdict: 'green' | 'amber' | 'red';
  verdictLabel: string;
  summary: string;
  reportUrl: string;
  ctas: { label: string; href: string }[];
}): string {
  const hue = VERDICT_HUES[input.verdict] ?? VERDICT_HUES.amber;
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ctas = input.ctas
    .map(
      (c) =>
        `<a href="${esc(c.href)}" style="display:inline-block;margin:0 12px 12px 0;padding:10px 18px;border:1px solid #2a2f3a;color:#e8eaf0;text-decoration:none;font-size:13px;">${esc(c.label)}</a>`,
    )
    .join('');
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#080a0f;color:#e8eaf0;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <p style="font-family:monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8b90a0;margin:0 0 24px;">Adaca Red · Diagnostic</p>
    <h1 style="font-size:22px;font-weight:500;margin:0 0 8px;color:#e8eaf0;">${esc(input.title)}</h1>
    <p style="margin:0 0 24px;">
      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${hue};margin-right:8px;"></span>
      <span style="font-family:monospace;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${hue};">${esc(input.verdictLabel)}</span>
    </p>
    <p style="font-size:14px;line-height:1.7;color:#b8bcc8;margin:0 0 28px;">${esc(input.summary)}</p>
    <p style="margin:0 0 32px;">
      <a href="${esc(input.reportUrl)}" style="display:inline-block;padding:12px 22px;background:#f87854;color:#1a0d08;text-decoration:none;font-size:14px;font-weight:500;">View your full report</a>
    </p>
    <div style="border-top:1px solid #1c212c;padding-top:24px;">${ctas}</div>
    <p style="font-size:11px;color:#5a5f6e;margin-top:32px;line-height:1.6;">This report is guidance, not legal advice. The link above is unique to you. Share it only with people you want to see the report.</p>
  </div>
</body></html>`;
}
