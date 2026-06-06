import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FACC15",
};

export const metadata: Metadata = {
  title: "Absensi",
  description: "Aplikasi Absensi Karyawan — PT. Lembayung Wanantara Padha",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Absensi",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="antialiased">
      <body className={`${inter.variable} font-sans min-h-[100dvh] flex flex-col bg-[#FBF9F3]`}>
        <Providers>
          <div className="flex-1 w-full max-w-[430px] mx-auto bg-[#FBF9F3] shadow-2xl relative flex flex-col overflow-hidden min-h-[100dvh]">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
