import { ReactNode } from 'react';
import ThemeToggle from '@/components/ui/ThemeToggle';

/**
 * The public no-login surface (/d/*): forms, run status, reports. No AppShell,
 * no rail — a quiet canvas page (`.wrap`) with the theme toggle, matching (auth).
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="fixed top-5 right-5 z-10 w-fit">
        <ThemeToggle />
      </div>
      <main className="wrap">{children}</main>
    </div>
  );
}
