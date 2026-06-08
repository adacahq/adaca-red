import EntityListPage from '@/components/entity/EntityListPage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <EntityListPage typeKey="risk" basePath="/risks" title="Risks" searchParams={sp} />;
}
