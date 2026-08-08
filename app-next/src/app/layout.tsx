import type { Metadata, Viewport } from "next";
import { Anton, Inter, Space_Mono } from "next/font/google";
import {
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_URL,
  SOCIAL_IMAGE,
} from "@/lib/site-config";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Empêche le redimensionnement du viewport quand la barre d'adresse
  // se cache/réapparaît au scroll (évite les sauts des couches fixed).
  interactiveWidget: "resizes-content",
  themeColor: "#08070d",
};

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

const structuredData = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: SITE_LANGUAGE,
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/icon-512x512.png?v=2`,
        width: 512,
        height: 512,
      },
    },
  ],
}).replace(/</g, "\\u003c");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "music",
  keywords: [
    "musique haïtienne",
    "artistes haïtiens",
    "classements musicaux",
    "tendances musicales",
    "Haitian Music Index",
  ],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      {
        url: "/brand/favicon-32x32.png?v=2",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/brand/favicon-16x16.png?v=2",
        type: "image/png",
        sizes: "16x16",
      },
    ],
    shortcut: [{ url: "/favicon.ico?v=2" }],
    apple: [
      {
        url: "/brand/apple-touch-icon.png?v=2",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    type: "website",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SOCIAL_IMAGE.url,
        width: SOCIAL_IMAGE.width,
        height: SOCIAL_IMAGE.height,
        alt: SOCIAL_IMAGE.alt,
      },
    ],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
};

import { StageLightsLoader } from "@/components/StageLightsLoader";
import { ShootingStars } from "@/components/ShootingStars";
import { DonationPrompt } from "@/components/DonationPrompt";
import Script from "next/script";
import "./globals.css";
import "../../public/assets/css/style.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={SITE_LANGUAGE} className={`${anton.variable} ${inter.variable} ${spaceMono.variable}`}>
      <head>
        <meta name="tiktok-developers-site-verification" content="doqYMyXAJOluVvI8j618siiivDgAHx0x" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
      </head>
      <body>
        <StageLightsLoader />
        <ShootingStars />
        {children}
        <DonationPrompt />
        <Script src="/assets/js/main.js" strategy="afterInteractive" />
        <Script src="/assets/js/features.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
