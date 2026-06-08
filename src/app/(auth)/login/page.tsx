import SignInButton from './SignInButton';
import Logo from '@/components/ui/Logo';

export const metadata = { title: 'Sign in · Adaca Red' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
            color: 'var(--muted-2)',
          }}
        >
          Operations · Internal
        </p>
        <h1 className="mt-2" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>
          Sign in
        </h1>
        <p className="mt-2 mb-8 text-[14px]" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          Use your Adaca Microsoft account. Access is restricted to approved
          domains.
        </p>

        {error && (
          <div
            className="mb-5 px-4 py-3 text-[13px]"
            style={{
              background: 'var(--red-tint)',
              color: 'var(--red-ink)',
              border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)',
            }}
          >
            {error}
          </div>
        )}

        <SignInButton />
      </div>
    </div>
  );
}
