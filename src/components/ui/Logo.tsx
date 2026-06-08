import Image from 'next/image';

/**
 * Theme-aware wordmark: white logo on the dark (default) theme, the dark-ink
 * logo on the light theme. Both render; CSS shows the right one per data-theme
 * (set before paint by the root layout script, so there's no flash).
 */
export default function Logo({
  className = 'h-6 w-auto',
  width = 110,
  height = 26,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <span className="logo inline-flex items-center">
      <Image src="/logo-white.svg" alt="Adaca" width={width} height={height} className={`logo-dark ${className}`} priority />
      <Image src="/logo.svg" alt="" width={width} height={height} className={`logo-light ${className}`} priority />
    </span>
  );
}
