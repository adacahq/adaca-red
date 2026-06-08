import { createClient } from '@/lib/supabase/server';
import { listEdges, getNodesByIds, listRevisions, listNodes } from '@/lib/nodes/queries';
import { readRed, residual, coverageFromReds } from '@/lib/red';
import HeadlineMetrics from '@/components/canvas/HeadlineMetrics';
import RedTrend, { type RedPoint } from './RedTrend';
import RiskMitigationsList from './RiskMitigationsList';
import { formatDate } from '@/lib/format';

/** Risk side: mitigating initiatives (add/edit RED), residual exposure, trend. */
export default async function RiskMitigations({
  riskId,
  riskData,
}: {
  riskId: string;
  riskData: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const edges = await listEdges(supabase, riskId, { typeKey: 'mitigates', direction: 'to' });
  const initIds = edges.map((e) => e.from_id);
  const [inits, allInits] = await Promise.all([
    getNodesByIds(supabase, initIds),
    listNodes(supabase, 'initiative'),
  ]);
  const titleById = Object.fromEntries(
    inits.map((n) => [n.id, ((n.data ?? {}) as { title?: string }).title ?? 'Initiative']),
  );
  const linked = new Set(initIds);

  const reds = edges.map((e) => readRed(e.data));
  const likelihood = Number(riskData.likelihood ?? 0);
  const impact = Number(riskData.impact ?? 0);
  const inherent = likelihood * impact;
  const res = residual(inherent, reds);
  const coverage = Math.round(coverageFromReds(reds) * 100);

  let trend: RedPoint[] = [];
  if (edges.length > 0) {
    const newest = [...edges].sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))[0];
    const revs = await listRevisions(supabase, 'edge', newest.id);
    trend = [...revs]
      .sort((a, b) => a.rev_no - b.rev_no)
      .map((rv) => {
        const r = readRed(rv.data);
        return {
          label: r.assessmentDate ? formatDate(r.assessmentDate) : `r${rv.rev_no}`,
          Relevance: r.relevance,
          Extent: r.extent,
          Duration: r.duration,
        };
      });
  }

  return (
    <div className="my-4">
      <HeadlineMetrics
        metrics={[
          { label: 'Inherent (L×I)', value: String(inherent || '–') },
          { label: 'Residual', value: String(inherent ? res : '–'), note: `${coverage}% covered` },
          { label: 'Mitigations', value: String(edges.length) },
        ]}
      />

      <RiskMitigationsList
        riskId={riskId}
        revalidatePath={`/risks/${riskId}`}
        edges={edges.map((e) => ({
          id: e.id,
          initiativeId: e.from_id,
          initiativeTitle: titleById[e.from_id] ?? 'Initiative',
          data: e.data,
        }))}
        initiativeOptions={allInits
          .filter((n) => !linked.has(n.id))
          .map((n) => ({ id: n.id, title: ((n.data ?? {}) as { title?: string }).title ?? 'Initiative' }))}
      />

      {trend.length > 0 && (
        <div className="mt-6">
          <p className="field-label">RED trend (newest mitigation)</p>
          <RedTrend series={trend} />
        </div>
      )}
    </div>
  );
}
