import NodeShell from '@/components/entity/NodeShell';
import nodeTabs from '@/components/entity/nodeTabs';
import { routeFor } from '@/lib/nodes/routes';

/** Generic node detail screen for ANY node type. Tabs are derived from the
 *  type's definition (Overview + children + edges + Activity) and overlaid with
 *  its `config.tabs`. The three original types keep their named routes. */
export default async function Page({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  const basePath = routeFor(type);
  const tabs = await nodeTabs({ typeKey: type, id, path: `${basePath}/${id}` });
  return <NodeShell typeKey={type} basePath={basePath} id={id} tabs={tabs} />;
}
