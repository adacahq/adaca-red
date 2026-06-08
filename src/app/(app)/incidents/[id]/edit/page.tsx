import EntityEditPage from '@/components/entity/EntityEditPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntityEditPage typeKey="incident" basePath="/incidents" title="Incident" id={id} />;
}
