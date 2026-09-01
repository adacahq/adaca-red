import Image from 'next/image';

/**
 * Theme-aware wordmark: white logo on the dark (default) theme, the dark-ink
 * logo on the light theme. Both render; CSS shows the right one per data-theme
 * (set before paint by the root layout script, so there's no flash).
 *
 * `variant="white"` opts out of that swap and always renders the white mark —
 * used inside the sidebar rail (`.sb`), which re-scopes to its own dark
 * palette regardless of the app theme, so the wordmark must stay white in
 * both themes there.
 */
export default function Logo({
  className = 'h-6 w-auto',
  width = 110,
  height = 26,
  variant = 'auto',
}: {
  className?: string;
  width?: number;
  height?: number;
  variant?: 'auto' | 'white';
}) {
  if (variant === 'white') {
    return <Image src="/logo-white.svg" alt="Adaca" width={width} height={height} className={className} priority />;
  }
  return (
    <span className="logo inline-flex items-center">
      <Image src="/logo-white.svg" alt="Adaca" width={width} height={height} className={`logo-dark ${className}`} priority />
      <Image src="/logo.svg" alt="" width={width} height={height} className={`logo-light ${className}`} priority />
    </span>
  );
}
