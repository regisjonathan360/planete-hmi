import Script from "next/script";
import { getStaticPageBody, getStaticPageScripts } from "@/lib/static-page";

/**
 * Rend une page HTML statique portée dans Next.js.
 * Le body HTML est injecté tel quel (même markup, même classes).
 * Les scripts sont chargés avec next/script (afterInteractive).
 * Note : main.js est déjà chargé dans le layout root, on l'exclut ici.
 */
export function StaticPage({ filename }: { filename: string }) {
  const body = getStaticPageBody(filename);
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
