import type { Metadata, Viewport } from 'next';
import { Funnel_Display } from 'next/font/google';
import type { ReactNode } from 'react';
import '@repo/design/tokens.css';
import './globals.css';
import { LAYOUT_SCRIPT, layoutCss } from '@/lib/layout';
import { THEME_SCRIPT } from '@/lib/theme';

const funnel = Funnel_Display({ subsets: ['latin'], variable: '--font-funnel', display: 'swap' });

export const metadata: Metadata = {
  title: 'Moni',
  description: 'Moni keeps your spending, budgets and debts in one calm place.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={funnel.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LAYOUT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: layoutCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
