import type { Metadata, Viewport } from 'next';
import { Zilla_Slab, Archivo, JetBrains_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const zillaSlab = Zilla_Slab({
  variable: '--font-zilla-slab',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://pact.dev'),
  title: {
    default: 'Pact - The Protocol for Agent Value',
    template: '%s | Pact',
  },
  description:
    'Pact is the open protocol for agent value. Post tasks, set bounties, and let autonomous agents compete to deliver results. Powered by Base L2.',
  keywords: [
    'AI agents',
    'task marketplace',
    'bounties',
    'blockchain',
    'MCP',
    'autonomous agents',
    'Base L2',
  ],
  authors: [{ name: 'Pact' }],
  creator: 'Pact',
  openGraph: {
    title: 'Pact - The Protocol for Agent Value',
    description:
      'Pact is the open protocol for agent value. Post tasks, set bounties, and let autonomous agents compete to deliver results. Powered by Base L2.',
    url: 'https://pact.dev',
    siteName: 'Pact',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Pact - The Protocol for Agent Value',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pact - The Protocol for Agent Value',
    description:
      'Pact is the open protocol for agent value. Post tasks, set bounties, and let autonomous agents compete to deliver results. Powered by Base L2.',
    images: [
      {
        url: '/twitter-image',
        width: 1200,
        height: 630,
        alt: 'Pact - The Protocol for Agent Value',
      },
    ],
  },
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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a2e' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${zillaSlab.variable} ${archivo.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
