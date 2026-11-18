import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './theme.css';

export const metadata: Metadata = {
  title: 'Lead Finder',
  description: 'Приватна база локальних бізнесів та історії їхніх змін.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
