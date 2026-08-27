import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // SEO optimizations
  compress: true,
  
  // Performance optimizations for SEO
  poweredByHeader: false,
  
  // Image optimization for better Core Web Vitals
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Security headers for SEO trust signals
  async headers() {
    // CSP pragmatique (sans nonces, cf. guide Next.js) : le site utilise des
    // styles inline (React), GA, des images/audio de nombreuses CDNs
    // d'artistes et des embeds YouTube. La clé Supabase est injectée au build.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const isDev = process.env.NODE_ENV === "development";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' ${supabaseUrl} wss://${supabaseUrl.replace(/^https?:\/\//, "")} https://www.google-analytics.com https://region1.google-analytics.com https://challenges.cloudflare.com`,
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://audiomack.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
