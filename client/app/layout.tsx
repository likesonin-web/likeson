import type { Metadata, Viewport } from 'next';
import { Poppins, Montserrat } from 'next/font/google';
import './globals.css';
import './consultation-admin.css';
import ConnectivityWrapper from '@/components/ui/ConnectivityWrapper';
import StoreProvider from '@/store/StoreProvider';
import LayoutConditionalWrapper from '@/components/ui/LayoutConditionalWrapper';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'react-hot-toast';
import AuthSocketBridge from '@/context/AuthSocketBridge';
import { GoogleMapsProvider } from '@/context/GoogleMapsProvider';

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

// Viewport settings are separate from Metadata in recent Next.js versions
export const viewport: Viewport = {
  themeColor: '#ffffff', // Replace with your primary brand color hex
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  // Required for relative OG/Twitter image URLs to work correctly
  metadataBase: new URL('https://likeson.in'),
  
  title: {
    default: 'Likeson Healthcare | Premium Medical Services & Family Care',
    // This template applies to child pages. e.g., if a page exports title: 'Sign In', 
    // it becomes 'Sign In | Likeson Healthcare'
    template: '%s | Likeson Healthcare',
  },
  description: 'A comprehensive, tech-enabled healthcare solution delivering essential medical transport, doctor consultations, premium home care, pharmacy deliveries, and lab diagnostics.',
  applicationName: 'Likeson',
  authors: [{ name: 'Likeson Team', url: 'https://likeson.in' }],
  creator: 'Likeson Healthcare',
  publisher: 'Likeson Healthcare',
  
  keywords: [
    'healthcare', 
    'medical transport', 
    'Transport booking India', 
    'online doctor consultation', 
    'home healthcare', 
    'pharmacy delivery', 
    'lab tests at home', 
    'telemedicine', 
    'family medical care',
    'Likeson Healthcare'
  ],

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  alternates: {
    canonical: '/',
  },

  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://likeson.in',
    title: 'Likeson Healthcare | Comprehensive Family Medical Care',
    description: 'Tech-enabled healthcare solution delivering essential non-emergency services, medical transport, and clinical support right to your door.',
    siteName: 'Likeson Healthcare',
    images: [
      {
        url: '/og-image.jpg', // Ensure you place an 1200x630 og-image.jpg in your /public folder
        width: 1200,
        height: 630,
        alt: 'Likeson Healthcare Services Overview',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Likeson Healthcare | Family Medical Care',
    description: 'Tech-enabled healthcare solution delivering essential non-emergency services, medical transport, and clinical support.',
    images: ['/twitter-image.jpg'], // Ensure you place a twitter-image.jpg in your /public folder
    creator: '@LikesonHealth', // Replace with your actual Twitter handle if you have one
  },

  icons: {
    icon: [
      { url: '/client/public/Logo.ico' },
      { url: '/icon.png', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png' }, // Create a 180x180 PNG in /public for iOS home screens
    ],
  },

  appleWebApp: {
    title: 'Likeson',
    statusBarStyle: 'default',
    capable: true,
  },

  verification: {
    // google: 'your-google-search-console-string-here', // Uncomment when you register with Google Search Console
  },
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
          <ThemeProvider attribute="class" defaultTheme="dark">
            {/*
              Order matters:
              AuthSocketBridge — connects general booking socket (uses token from store)
              ConsultationProvider — connects /consultations namespace socket (same token)
              Both sit inside StoreProvider so they can read Redux state.
            */}
            <AuthSocketBridge>
                <GoogleMapsProvider>
                  <ConnectivityWrapper>
                    <LayoutConditionalWrapper>
                      {children}
                    </LayoutConditionalWrapper>
                  </ConnectivityWrapper>
                </GoogleMapsProvider>
            </AuthSocketBridge>

            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  borderRadius: 'var(--r-field)',
                  background: 'var(--neutral)',
                  color: 'var(--neutral-content)',
                  fontSize: '13px',
                  fontWeight: '600',
                  fontFamily: 'var(--font-poppins), sans-serif',
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