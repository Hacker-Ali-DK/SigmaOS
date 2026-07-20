import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import PWAProvider from "@/components/pwa-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recovery+ - AI Life Companion",
  description: "Premium offline-first personal operating system and AI Life Companion.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Recovery+",
  },
};

export const viewport: Viewport = {
  themeColor: "#03050C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-navy-dark text-slate-100 select-none">
        <PWAProvider>{children}</PWAProvider>
      </body>
    </html>
  );
}
