import type { Metadata } from 'next';
import { Poppins, Montserrat } from 'next/font/google';
import './globals.css';

import ConnectivityWrapper from '@/components/ui/ConnectivityWrapper';
import StoreProvider from '@/store/StoreProvider';
import LayoutConditionalWrapper from '@/components/ui/LayoutConditionalWrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'react-hot-toast';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
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
    <html
      lang="en"
      className={`${poppins.variable} ${montserrat.variable} scroll-smooth`}
      suppressHydrationWarning
    >
   <body className="font-poppins antialiased" suppressHydrationWarning>
        <StoreProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
          >
            <ConnectivityWrapper>
              <LayoutConditionalWrapper>
                {children}
              </LayoutConditionalWrapper>
            </ConnectivityWrapper>

            {/* Move Toaster LAST to avoid layout mismatch edge cases */}
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
              }}
            />
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}