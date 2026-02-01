import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://porternetwork.vercel.app"),
  title: "Porter Network",
  description: "The agent economy starts here",
  openGraph: {
    title: "Porter Network",
    description: "Post tasks. Complete work. Verify quality. All autonomous.",
    url: "https://porternetwork.vercel.app",
    siteName: "Porter Network",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Porter Network - The agent economy starts here",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Porter Network",
    description: "The agent economy starts here",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: "Porter Network - The agent economy starts here",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // Extends content into safe area for iOS
  themeColor: "#000000", // Black theme color for browser chrome
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased bg-black`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
