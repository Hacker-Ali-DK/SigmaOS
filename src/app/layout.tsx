import type { Metadata, Viewport } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import PWAProvider from "@/components/pwa-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });

export const metadata: Metadata = {
  title: "SIGMA RULER",
  description: "Master yourself. Rule your life.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SIGMA RULER",
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
      className={`${inter.variable} ${cinzel.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-navy-dark text-slate-100 select-none">
        <PWAProvider>{children}</PWAProvider>
      </body>
    </html>
  );
}
