import { TabLinks } from '@/components/ui/Tabs';

const TABS = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/roles', label: 'Roles' },
  { href: '/admin/definitions', label: 'Definitions' },
];

export default function AdminNav() {
  return <TabLinks tabs={TABS} />;
}
