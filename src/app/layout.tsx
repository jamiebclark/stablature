import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { Footer } from "@/components/app/Footer";
import { ServiceWorker } from "@/components/app/ServiceWorker";
import { SyncProvider } from "@/components/app/SyncProvider";
import { TopBar } from "@/components/app/TopBar";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

/*
 * JetBrains Mono carries the tablature, and the choice was measured rather
 * than picked: at the 11px the staff actually renders at, it has a visibly
 * larger x-height than Geist Mono, IBM Plex Mono or Roboto Mono, and all four
 * share an identical 0.6em advance. So the digits are easier to read at no
 * cost in columns per screen -- and columns per screen is the whole point of
 * this app.
 *
 * Geist Sans stays for the interface. Nothing about a band tool is improved
 * by a more opinionated UI face, and a third family is weight a PWA carries
 * offline for no return.
 */
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "stablature",
  description: "Capture and read bass tablature, offline, at band practice.",
  applicationName: "stablature",
  appleWebApp: {
    capable: true,
    title: "stablature",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  // The capture screen is a fixed-height app surface; letting it zoom on a
  // double-tap makes the fretboard jump under your thumb.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0b0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <ServiceWorker />
        <SyncProvider />
        <TopBar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
