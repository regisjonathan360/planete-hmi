import Script from "next/script";
import { getStaticPageBody, getStaticPageScripts } from "@/lib/static-page";

/**
 * Rend une page HTML statique portée dans Next.js.
 * Le body HTML est injecté tel quel (même markup, même classes).
 * Les scripts sont chargés avec next/script (afterInteractive).
 * Note : main.js est déjà chargé dans le layout root, on l'exclut ici.
 */
export function StaticPage({
  filename,
  replacements = [],
  hideStaticHeader = false,
}: {
  filename: string;
  replacements?: Array<{ marker: string; html: string }>;
  hideStaticHeader?: boolean;
}) {
  let body = getStaticPageBody(filename);
  for (const replacement of replacements) {
    body = body.replace(replacement.marker, replacement.html);
  }
  // Supprimer le header statique si demandé (le SiteHeader React prend le relais)
  if (hideStaticHeader) {
    body = body.replace(/<header[^>]*class="topbar"[^>]*>[\s\S]*?<\/header>/i, "");
    // Aussi supprimer le menu-mobile statique
    body = body.replace(/<nav[^>]*class="menu-mobile"[^>]*>[\s\S]*?<\/nav>/i, "");
  }
  for (const replacement of replacements) {
    body = body.replace(replacement.marker, replacement.html);
  }
  const scripts = getStaticPageScripts(filename).filter(
    (src) => !src.includes("main.js")
  );

  return (
    <>
      <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: body }} />
      {scripts.map((src) => (
        <Script key={src} src={src} strategy="afterInteractive" />
      ))}
    </>
  );
}
