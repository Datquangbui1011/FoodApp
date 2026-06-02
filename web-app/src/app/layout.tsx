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
    <html lang="en" className={`${dmSans.variable}`} style={{ height: '100%', background: '#1A0808' }}>
      <body style={{ margin: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <Providers>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <PageTransition>{children}</PageTransition>
            <UpdatePrompt />
          </div>
        </Providers>
      </body>
    </html>
  );
}
