import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/Footer";

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
    >
      <body className="min-h-full flex flex-col antialiased bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex flex-col min-h-screen">
          <div className="flex-grow">
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
