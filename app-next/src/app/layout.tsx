import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Planète HMI — Haitian Music Index",
    template: "%s — Planète HMI",
  },
  description: "Planète HMI : classements, profils d'artistes et découverte de la musique haïtienne. Là où les étoiles de la musique haïtienne deviennent des légendes.",
  metadataBase: new URL("https://planete-hmi.vercel.app"),
  openGraph: {
    title: "Planète HMI — Haitian Music Index",
    description: "Charts, artistes, districts et HMI Shorts. L'univers de référence de la musique haïtienne.",
    type: "website",
    images: ["/image/social/planet-hmi-social.png"],
    siteName: "Planète HMI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Planète HMI — Haitian Music Index",
    description: "Charts, artistes et découverte de la musique haïtienne.",
    images: ["/image/social/planet-hmi-social.png"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://planete-hmi.vercel.app" },
};

import { StageLightsLoader } from "@/components/StageLightsLoader";
import Script from "next/script";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <meta name="theme-color" content="#08070d" />
        <meta name="tiktok-developers-site-verification" content="doqYMyXAJOluVvI8j618siiivDgAHx0x" />
        <link rel="icon" type="image/svg+xml" href="/brand/planet-hmi-icon-dark.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/assets/css/style.css" />
      </head>
      <body>
        <StageLightsLoader />
        {children}
        <Script src="/assets/js/main.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
