import EntityListPage from '@/components/entity/EntityListPage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <EntityListPage typeKey="incident" basePath="/incidents" title="Incidents" searchParams={sp} />;
}
