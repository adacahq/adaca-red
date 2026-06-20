import NodeShell from '@/components/entity/NodeShell';
import nodeTabs from '@/components/entity/nodeTabs';
import { routeFor } from '@/lib/nodes/routes';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const basePath = routeFor('incident');
  const tabs = await nodeTabs({ typeKey: 'incident', id, path: `${basePath}/${id}` });
  return <NodeShell typeKey="incident" basePath={basePath} id={id} tabs={tabs} />;
}
