import NodeShell from '@/components/entity/NodeShell';
import nodeTabs from '@/components/entity/nodeTabs';
import { routeFor } from '@/lib/nodes/routes';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const basePath = routeFor('initiative');
  const tabs = await nodeTabs({ typeKey: 'initiative', id, path: `${basePath}/${id}` });
  return <NodeShell typeKey="initiative" basePath={basePath} id={id} tabs={tabs} />;
}
