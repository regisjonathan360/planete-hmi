import { getStaticPageBody, getStaticPageScripts } from "@/lib/static-page";
import { StaticPageClientEffects } from "@/components/StaticPageClientEffects";

/**
 * Rend une page HTML statique portée dans Next.js.
 * Le body HTML est injecté tel quel (même markup, même classes).
 * Les scripts historiques sont chargés avec `defer` afin qu'ils s'exécutent
 * aussi lorsque la page statique est injectée depuis un Server Component.
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
  const rootId = `static-page-${filename.replace(/[^a-z0-9_-]/gi, "-")}`;
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
    // La structure cible est :
    //   <div class="section-head reveal"> ... Voir le Top 100 ... </div>
    //   ... podium de démo ...
    //   </section>
    //   <!-- ============ BANDE ... ou <section class="feature-strip"
    body = body.replace(
      /(<div class="section-head reveal">[\s\S]*?Voir le Top 100[\s\S]*?<\/div>)\s*([\s\S]*?)(\s*<\/section>\s*\n?\s*(?:<!-- ============ BANDE|<section class="feature-strip"))/,
      `$1\n\n${podiumReplacement.html}\n      $3`,
    );
    activeReplacements = activeReplacements.filter((r) => r.marker !== "<!-- PODIUM_CONTENT -->");
  }

  const shortsReplacement = replacements.find(
    (replacement) => replacement.marker === "<!-- HMI_SHORTS_CONTENT -->",
  );
  if (shortsReplacement) {
    body = body.replace(
      /(<section class="section" id="shorts"[\s\S]*?<div class="shorts reveal">)[\s\S]*?(<\/div>\s*<\/section>)/,
      `$1\n${shortsReplacement.html}\n        $2`,
    );
    activeReplacements = activeReplacements.filter(
      (replacement) => replacement.marker !== "<!-- HMI_SHORTS_CONTENT -->",
    );
  }

  for (const replacement of activeReplacements) {
    body = body.replace(replacement.marker, replacement.html);
  }
  const scripts = getStaticPageScripts(filename).filter(
    (src) => !src.includes("main.js") && !src.includes("features.js")
  );

  return (
    <>
      <div
        id={rootId}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <StaticPageClientEffects rootId={rootId} />
      {scripts.map((src) => (
        <script key={src} src={src} defer />
      ))}
    </>
  );
}
