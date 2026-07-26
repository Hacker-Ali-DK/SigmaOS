import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAProvider from "@/components/pwa-provider";

const inter = { variable: "font-sans" };
const outfit = { variable: "font-heading" };

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
