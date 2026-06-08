import type { Metadata } from 'next';
import './globals.css';
import Toaster from '@/components/ui/Toaster';

export const metadata: Metadata = {
  title: 'Adaca Red',
  description: 'Operations register for initiatives, risks and incidents, with RED analysis.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png' }],
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

// Applied before paint so the chosen theme never flashes. Default is dark.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
