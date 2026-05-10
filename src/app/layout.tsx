import type {Metadata, Viewport} from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Cursor-App',
  description: 'Autonomous AI Coding Agent for Mobile',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Cursor-App',
  },
};

export const viewport: Viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: "(function() { try { const theme = localStorage.getItem('ca_app_theme') || 'standard'; document.documentElement.setAttribute('data-theme', theme); } catch (e) { console.error('Failed to access localStorage for theme: ', e); } })()" }} />
      </head>
      <body className="font-body antialiased bg-background text-foreground h-full overflow-hidden">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
