import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://replaceme.lol"),
  title: "REPLACEME — One Person is #1. Replace them.",
  description: "An internet status game and bidding war. Pay to become #1, get replaced, get revenge, real-time chaos.",
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: "REPLACEME — One Person is #1. Replace them.",
    description: "An internet status game and bidding war. Pay to become #1, get replaced, get revenge, real-time chaos.",
    url: "https://replaceme.lol",
    siteName: "ReplaceMe",
    images: [
      {
        url: "/replaceme-avatar.svg",
        width: 800,
        height: 800,
        alt: "ReplaceMe Logo",
      }
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "REPLACEME — One Person is #1. Replace them.",
    description: "An internet status game and bidding war. Pay to become #1, get replaced, get revenge, real-time chaos.",
    images: ["/replaceme-avatar.svg"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased bg-[var(--background)] text-[var(--foreground)]">
        <Providers>
          <div className="flex flex-col min-h-screen">
            <div className="flex-grow">
              {children}
            </div>
            <div
              className="fixed bottom-3 right-3 md:bottom-6 md:right-6 z-[40] px-4 py-2 bg-white/50 dark:bg-black/40 backdrop-blur-md border border-white/30 dark:border-white/10 rounded-full shadow-sm"
            >
              <span className="text-xs font-medium text-[var(--secondary)]">
                Built by <a href="https://x.com/beswinjoee" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent font-semibold hover:opacity-80 transition-opacity">@beswinjoee</a>
              </span>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
