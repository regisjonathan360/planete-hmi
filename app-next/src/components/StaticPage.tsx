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
  let activeReplacements = [...replacements];
  // Supprimer le header statique si demandé (le SiteHeader React prend le relais)
  if (hideStaticHeader) {
    body = body.replace(/<header[^>]*class="topbar"[^>]*>[\s\S]*?<\/header>/i, "");
    // Aussi supprimer le menu-mobile statique
    body = body.replace(/<nav[^>]*class="menu-mobile"[^>]*>[\s\S]*?<\/nav>/i, "");
  }

  // Remplacement dynamique du podium : quand un classement planétaire est
  // publié, le contenu entre l'en-tête de section et la fermeture </section>
  // est remplacé par le vrai top 5 issu de la moyenne cross-plateformes.
  const podiumReplacement = replacements.find((r) => r.marker === "<!-- PODIUM_CONTENT -->");
  if (podiumReplacement && podiumReplacement.html) {
    body = body.replace(
      /(<div class="section-head reveal">[\s\S]*?Voir le Top 100[\s\S]*?<\/div>\s*<\/div>)([\s\S]*?)(<\/section>\s*(?:<!-- ============ BANDE|<section class="feature-strip"))/,
      `$1\n${podiumReplacement.html}\n      $3`,
    );
    // Le marker ne sera pas trouvé littéralement dans le HTML : on le retire
    // de la liste pour ne pas laisser un texte vide.
    activeReplacements = activeReplacements.filter((r) => r.marker !== "<!-- PODIUM_CONTENT -->");
  }

  for (const replacement of activeReplacements) {
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
