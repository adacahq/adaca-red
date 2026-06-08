import { notFound } from 'next/navigation';
import NodeShell from '@/components/entity/NodeShell';
import FieldsSection from '@/components/entity/FieldsSection';
import AssignmentsSection from '@/components/entity/AssignmentsSection';
import RevisionsPanel from '@/components/entity/RevisionsPanel';
import RiskMitigations from '@/components/red/RiskMitigations';
import PlainEdges from '@/components/edges/PlainEdges';
import SectionHeader from '@/components/canvas/SectionHeader';
import { createClient } from '@/lib/supabase/server';
import { getNode } from '@/lib/nodes/queries';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const node = await getNode(supabase, id);
  if (!node) notFound();
  const riskData = (node.data ?? {}) as Record<string, unknown>;
  const path = `/risks/${id}`;

  return (
    <NodeShell
      typeKey="risk"
      basePath="/risks"
      id={id}
      tabs={[
        {
          key: 'overview',
          label: 'Overview',
          content: (
            <>
              <FieldsSection typeKey="risk" id={id} />
              <SectionHeader title="People" />
              <AssignmentsSection nodeId={id} revalidatePath={path} />
              <SectionHeader title="Realised by incidents" />
              <PlainEdges
                nodeId={id}
                edgeType="realises"
                direction="to"
                targetType="incident"
                targetBasePath="/incidents"
                revalidatePath={path}
                addLabel="Link incident"
              />
            </>
          ),
        },
        {
          key: 'mitigations',
          label: 'Mitigations',
          content: <RiskMitigations riskId={id} riskData={riskData} />,
        },
        { key: 'activity', label: 'Activity', content: <RevisionsPanel kind="node" id={id} /> },
      ]}
    />
  );
}
