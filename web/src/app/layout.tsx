import type { Metadata, Viewport } from "next";
import { Manrope, DM_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { site } from "@/lib/site";
import PwaRegister from "@/components/pwa-register";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-mono",
  weight: ["400", "500"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "KAEL - Solusi Digital untuk UMKM",
    template: "%s | KAEL",
  },
  description: site.description,
  keywords: [
    "solusi digital UMKM",
    "software UMKM",
    "kartu NFC Google Review",
    "aplikasi kasir UMKM",
    "loyalty program UMKM",
    "hitung HPP",
    "KAEL",
  ],
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: "KAEL - Solusi Digital untuk UMKM",
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: "KAEL - Solusi Digital untuk UMKM",
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KAEL POS",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  description: site.description,
  slogan: site.tagline,
  areaServed: "ID",
  email: site.email,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${manrope.variable} ${dmMono.variable} ${plusJakartaSans.variable}`}>
      <body className="font-sans antialiased">
        <a
          href="#solusi"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-5 focus:py-2.5 focus:text-sm focus:font-normal focus:text-accent-fg"
        >
          Lewati ke konten utama
        </a>
        <PwaRegister />
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
      </body>
    </html>
  );
}
