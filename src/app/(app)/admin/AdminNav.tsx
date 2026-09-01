import { TabLinks } from '@/components/ui/Tabs';

const TABS = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/roles', label: 'Roles' },
  { href: '/admin/definitions', label: 'Definitions' },
  { href: '/admin/forms', label: 'Forms' },
  { href: '/admin/rubrics', label: 'Rubrics' },
  { href: '/admin/workflows', label: 'Workflows' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminNav() {
  return <TabLinks tabs={TABS} />;
}
