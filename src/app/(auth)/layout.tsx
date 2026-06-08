import { ReactNode } from 'react';
import ThemeToggle from '@/components/ui/ThemeToggle';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="fixed top-5 right-5">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
