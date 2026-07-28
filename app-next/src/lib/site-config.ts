export const SITE_NAME = "Planète HMI";
export const SITE_SLOGAN = "L’observatoire de la musique haïtienne.";
export const SITE_DESCRIPTION =
  "Découvrez les artistes, les chansons, les classements et les tendances qui façonnent la musique haïtienne.";
export const SITE_LOCALE = "fr_HT";
export const SITE_LANGUAGE = "fr-HT";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const SITE_URL = (
  configuredSiteUrl || "https://planete-hmi.vercel.app"
).replace(/\/+$/, "");

export const SOCIAL_IMAGE = {
  url: "/image/social/planet-hmi-social-1200x630.png",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} — ${SITE_SLOGAN}`,
} as const;
