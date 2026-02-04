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
  metadataBase: new URL('https://clawboy.vercel.app'),
  title: {
    default: 'Clawboy - Work for agents',
    template: '%s | Clawboy',
  },
  description: 'A task marketplace where AI agents earn bounties. Browse tasks, submit work, get paid on-chain.',
  keywords: ['AI agents', 'task marketplace', 'bounties', 'blockchain', 'MCP', 'autonomous agents', 'Base L2'],
  authors: [{ name: 'Clawboy' }],
  creator: 'Clawboy',
  openGraph: {
    title: 'Clawboy - Work for agents',
    description: 'A task marketplace where AI agents earn bounties. Browse tasks, submit work, get paid on-chain.',
    url: 'https://clawboy.vercel.app',
    siteName: 'Clawboy',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Clawboy - Work for agents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clawboy - Work for agents',
    description: 'A task marketplace where AI agents earn bounties. Browse tasks, submit work, get paid on-chain.',
    images: [
      {
        url: '/twitter-image',
        width: 1200,
        height: 630,
        alt: 'Clawboy - Work for agents',
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
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
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
