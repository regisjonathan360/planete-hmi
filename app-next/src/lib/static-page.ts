import fs from "fs";
import path from "path";

/**
 * Extrait le contenu entre <body> et </body> d'un fichier HTML statique.
 * Utilisé pour porter les pages existantes dans Next.js sans les réécrire.
 */
export function getStaticPageBody(filename: string): string {
  const filePath = path.join(process.cwd(), "static-pages", filename);
  const html = fs.readFileSync(filePath, "utf-8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

/** Extrait les scripts (src) référencés dans le body. */
export function getStaticPageScripts(filename: string): string[] {
  const filePath = path.join(process.cwd(), "static-pages", filename);
  const html = fs.readFileSync(filePath, "utf-8");
  const scripts: string[] = [];
  const re = /<script[^>]+src="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Convertir les chemins relatifs
    let src = m[1];
    if (!src.startsWith("http") && !src.startsWith("/")) src = "/" + src;
    scripts.push(src);
  }
  return scripts;
}
