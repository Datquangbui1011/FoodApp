import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./components/Providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FoodMap AI",
  description: "Paste a food video, find the restaurant",
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full`}>
      <body className="min-h-full flex flex-col items-center justify-start bg-[#F0EDE6]">
        <Providers>
          <div className="w-full max-w-sm min-h-screen bg-white flex flex-col shadow-xl relative overflow-hidden">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
