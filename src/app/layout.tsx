import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SyncProvider } from "@/components/app/SyncProvider";
import { TopBar } from "@/components/app/TopBar";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "stablature",
  description: "Capture and read bass tablature, offline, at band practice.",
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
        <SyncProvider />
        <TopBar />
        {children}
      </body>
    </html>
  );
}
