import type { Metadata } from "next";
import { Anton, Inter, Space_Mono } from "next/font/google";

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
    <html lang="fr" className={`${anton.variable} ${inter.variable} ${spaceMono.variable}`}>
      <head>
        <meta name="theme-color" content="#08070d" />
        <meta name="tiktok-developers-site-verification" content="doqYMyXAJOluVvI8j618siiivDgAHx0x" />
        <link rel="icon" type="image/svg+xml" href="/brand/planet-hmi-icon-dark.svg" />
      </head>
      <body>
        <StageLightsLoader />
        {children}
        <DonationPrompt />
        <Script src="/assets/js/main.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
