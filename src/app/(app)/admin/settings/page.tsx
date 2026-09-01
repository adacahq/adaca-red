import type { CSSProperties } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadRetentionSettings } from '@/lib/settings/server';
import AdminNav from '../AdminNav';
import RetentionSettings from './RetentionSettings';

export const metadata = { title: 'Settings · Adaca Red' };

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('users').select('role').eq('auth_id', user.id).single();
  if (!me || !(me.role === 'admin' || me.role === 'owner')) redirect('/');

  const retention = await loadRetentionSettings(supabase);

  return (
    <div>
      <p className="eyebrow rv">Admin</p>
      <h1 className="view-title rv" style={{ '--i': 1 } as CSSProperties}>
        Settings
      </h1>
      <p className="lede rv" style={{ '--i': 2 } as CSSProperties}>
        App-wide configuration. Retention is a whole-node policy: an expired node is
        hard-deleted with all its revisions and documents — the public form&rsquo;s privacy
        copy renders from these values, so what you promise here is what happens.
      </p>

      <AdminNav />

      <div className="mt-10 rv" style={{ '--i': 3 } as CSSProperties}>
        <RetentionSettings initial={retention} />
      </div>
    </div>
  );
}
