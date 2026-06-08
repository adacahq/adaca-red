import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/lib/auth/actions';
import Logo from '@/components/ui/Logo';

export const metadata = { title: 'Access pending · Adaca Red' };

export default async function NoAccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="w-full max-w-sm" style={{ border: '1px solid var(--line)' }}>
      <div className="p-8">
        <Logo />
        <p
          className="mono mt-8"
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--amber-ink)',
          }}
        >
          Access pending
        </p>
        <h1 className="mt-2" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>
          Your role hasn&rsquo;t been assigned yet
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          You&rsquo;re signed in
          {user?.email ? (
            <>
              {' '}
              as <strong style={{ color: 'var(--ink)' }}>{user.email}</strong>
            </>
          ) : null}
          , but an administrator needs to grant you a role before you can use the
          app. Please check back shortly.
        </p>
        <p className="mt-3 text-[13px]" style={{ color: 'var(--muted-2)', lineHeight: 1.6 }}>
          Need help? Contact{' '}
          <a href="mailto:support@adaca.com" className="text-link">support@adaca.com</a>.
        </p>

        <form action={signOut} className="mt-8">
          <button type="submit" className="btn btn-ghost btn-sm">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
