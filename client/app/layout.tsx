import type { Metadata } from 'next';
import { Poppins, Montserrat } from 'next/font/google';
import './globals.css';

import ConnectivityWrapper from '@/components/ui/ConnectivityWrapper';
import StoreProvider from '@/store/StoreProvider';
import LayoutConditionalWrapper from '@/components/ui/LayoutConditionalWrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'react-hot-toast';

/**
 * Poppins — primary body / UI font.
 * Only weights actually used in the design system.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  variable: '--font-poppins',
  display: 'swap',
  preload: true,
});

/**
 * Montserrat — heading / display font.
 * Heavy weights only — matches font-black usage in globals.css.
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  style: ['normal'],
  variable: '--font-montserrat',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: 'Likeson.in | Healthcare for Families',
  description:
    'A comprehensive, tech-enabled healthcare solution delivering essential non-emergency services.',
  icons: { icon: '/Logo.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * suppressHydrationWarning is required by next-themes:
     * it injects `class` / `data-theme` on <html> before React hydrates,
     * which would normally trigger a mismatch warning.
     */
    <html
      lang="en"
      className={`${poppins.variable} ${montserrat.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      {/*
       * FIX 1: Removed `bg-base-100` from body className.
       *         globals.css already sets background-color: var(--base-100)
       *         with a 0.3s transition on body. The Tailwind class was
       *         competing with that and causing flash-of-wrong-background
       *         on theme switch because Tailwind applies it statically
       *         before the CSS-var resolves to the correct dark value.
       *
       * FIX 2: Removed `text-base-content` for the same reason — globals.css
       *         handles it with transition already.
       */}
      <body className="font-poppins antialiased">
        <StoreProvider>
          {/*
           * ThemeProvider configuration:
           *   attribute="class"     → adds/removes "dark" class on <html>
           *                           (matches the .dark {} block in globals.css)
           *   defaultTheme="system" → respects OS preference on first visit
           *   enableSystem          → keeps tracking OS preference changes
           *
           * FIX 3: Removed disableTransitionOnChange={false} — that prop does
           *         not exist in next-themes and was causing a React prop warning.
           *         CSS transitions on body are defined in globals.css and work
           *         independently of next-themes.
           */}
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
          >
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  borderRadius: 'var(--r-field)',
                  background: 'var(--neutral)',
                  color: 'var(--neutral-content)',
                  fontSize: '13px',
                  fontWeight: '600',
                  fontFamily: 'var(--font-poppins)',
                  border: '1px solid var(--base-300)',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                },
                success: {
                  iconTheme: {
                    primary: 'var(--secondary)',
                    secondary: 'var(--secondary-content)',
                  },
                },
                error: {
                  style: {
                    background: 'var(--error)',
                    color: 'var(--error-content)',
                  },
                },
              }}
            />
            <ConnectivityWrapper>
              <LayoutConditionalWrapper>{children}</LayoutConditionalWrapper>
            </ConnectivityWrapper>
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}