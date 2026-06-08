import NodeShell from '@/components/entity/NodeShell';
import FieldsSection from '@/components/entity/FieldsSection';
import AssignmentsSection from '@/components/entity/AssignmentsSection';
import RevisionsPanel from '@/components/entity/RevisionsPanel';
import ContainmentTree from '@/components/entity/ContainmentTree';
import InitiativeBoard from '@/components/initiative/InitiativeBoard';
import InitiativeMitigations from '@/components/red/InitiativeMitigations';
import PlainEdges from '@/components/edges/PlainEdges';
import SectionHeader from '@/components/canvas/SectionHeader';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/initiatives/${id}`;
  return (
    <NodeShell
      typeKey="initiative"
      basePath="/initiatives"
      id={id}
      tabs={[
        {
          key: 'overview',
          label: 'Overview',
          content: (
            <>
              <FieldsSection typeKey="initiative" id={id} />
              <SectionHeader title="People" />
              <AssignmentsSection nodeId={id} revalidatePath={path} />
              <SectionHeader title="Incidents addressed" />
              <PlainEdges
                nodeId={id}
                edgeType="remediates"
                direction="from"
                targetType="incident"
                targetBasePath="/incidents"
                revalidatePath={path}
                addLabel="Link incident"
              />
            </>
          ),
        },
        { key: 'board', label: 'Board', content: <InitiativeBoard initiativeId={id} /> },
        {
          key: 'tasks',
          label: 'Tasks',
          content: <ContainmentTree rootId={id} revalidatePath={path} onlyTypes={['group', 'task']} />,
        },
        { key: 'risks', label: 'Risks (RED)', content: <InitiativeMitigations initiativeId={id} /> },
        { key: 'activity', label: 'Activity', content: <RevisionsPanel kind="node" id={id} /> },
      ]}
    />
  );
}
