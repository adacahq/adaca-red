import NodeShell from '@/components/entity/NodeShell';
import FieldsSection from '@/components/entity/FieldsSection';
import AssignmentsSection from '@/components/entity/AssignmentsSection';
import RevisionsPanel from '@/components/entity/RevisionsPanel';
import ContainmentTree from '@/components/entity/ContainmentTree';
import IncidentTimeline from '@/components/incident/IncidentTimeline';
import PlainEdges from '@/components/edges/PlainEdges';
import SectionHeader from '@/components/canvas/SectionHeader';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/incidents/${id}`;
  return (
    <NodeShell
      typeKey="incident"
      basePath="/incidents"
      id={id}
      tabs={[
        {
          key: 'overview',
          label: 'Overview',
          content: (
            <>
              <FieldsSection typeKey="incident" id={id} />
              <SectionHeader title="People" />
              <AssignmentsSection nodeId={id} revalidatePath={path} />
              <SectionHeader title="Realises (risks)" />
              <PlainEdges
                nodeId={id}
                edgeType="realises"
                direction="from"
                targetType="risk"
                targetBasePath="/risks"
                revalidatePath={path}
                addLabel="Link risk"
              />
              <SectionHeader title="Remediated by initiatives" />
              <PlainEdges
                nodeId={id}
                edgeType="remediates"
                direction="to"
                targetType="initiative"
                targetBasePath="/initiatives"
                revalidatePath={path}
                addLabel="Link initiative"
              />
            </>
          ),
        },
        { key: 'timeline', label: 'Timeline', content: <IncidentTimeline incidentId={id} /> },
        {
          key: 'actions',
          label: 'Action items',
          content: <ContainmentTree rootId={id} revalidatePath={path} onlyTypes={['task']} />,
        },
        { key: 'activity', label: 'Activity', content: <RevisionsPanel kind="node" id={id} /> },
      ]}
    />
  );
}
