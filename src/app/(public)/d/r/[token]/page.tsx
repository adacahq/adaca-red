import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import ReportView, { type AssessmentData } from '@/components/public/ReportView';

export const metadata = { robots: { index: false, follow: false } };

/**
 * The standalone public report, addressed ONLY by its 165-bit token (node ids
 * are never a public capability). Everything it renders lives on the
 * assessment node — by construction it survives the submission's purge.
 */
export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-z]{20,64}$/.test(token)) notFound();

  const db = createAdminClient();
  const { data: node, error } = await db
    .from('nodes')
    .select('*')
    .eq('data->>report_token', token)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!node) notFound();

  return <ReportView data={node.data as unknown as AssessmentData} issuedAt={node.created_at} />;
}
