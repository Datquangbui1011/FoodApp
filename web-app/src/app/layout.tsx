import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./components/Providers";
import PageTransition from "./components/PageTransition";
import UpdatePrompt from "./components/UpdatePrompt";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Foody",
  description: "Discover restaurants from food videos",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Foody',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable}`} style={{ height: '100%' }}>
      <body style={{ margin: 0, padding: 0, height: '100dvh', width: '100vw', overflow: 'hidden', background: '#F5EDED', display: 'flex', flexDirection: 'column' }}>
        <Providers>
          <div style={{ flex: 1, width: '100%', height: '100%', background: 'white', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', paddingTop: 'env(safe-area-inset-top)' }}>
            <PageTransition>{children}</PageTransition>
            <UpdatePrompt />
          </div>
        </Providers>
      </body>
    </html>
  );
}
