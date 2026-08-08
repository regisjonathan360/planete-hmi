"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Checks {
  envVar: string;
  gtag: string;
  dataLayer: string;
  consent: string;
  scripts: string;
}

export default function CheckGAPage() {
  const [checks, setChecks] = useState({
    envVar: "Vérification...",
    gtag: "Vérification...",
    dataLayer: "Vérification...",
    consent: "Vérification...",
    scripts: "Vérification...",
  });

  useEffect(() => {
    const results: Checks = {
      envVar: "Vérification...",
      gtag: "Vérification...",
      dataLayer: "Vérification...",
      consent: "Vérification...",
      scripts: "Vérification...",
    };

    // 1. Vérifier la variable d'environnement
    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    results.envVar = gaId
      ? `✅ ${gaId}`
      : "❌ Variable non définie (manque dans Vercel)";

    // 2. Vérifier gtag
    results.gtag =
      typeof window !== "undefined" && window.gtag
        ? "✅ window.gtag existe"
        : "❌ window.gtag n'existe pas";

    // 3. Vérifier dataLayer
    results.dataLayer =
      typeof window !== "undefined" && window.dataLayer
        ? `✅ dataLayer existe (${window.dataLayer.length} items)`
        : "❌ dataLayer n'existe pas";

    // 4. Vérifier le consentement
    const consent = localStorage.getItem("planete-hmi-cookie-consent");
    if (consent) {
      try {
        const parsed = JSON.parse(consent);
        results.consent = parsed.analytics
          ? "✅ Cookies acceptés (analytics: true)"
          : "❌ Analytics refusé (analytics: false)";
      } catch {
        results.consent = "❌ Consentement invalide";
      }
    } else {
      results.consent = "❌ Aucun consentement sauvegardé";
    }

    // 5. Vérifier les scripts chargés
    const scripts = Array.from(document.querySelectorAll("script")).filter(
      (s) => s.src.includes("googletagmanager") || s.src.includes("gtag")
    );
    results.scripts = scripts.length
      ? `✅ ${scripts.length} script(s) Google Analytics trouvé(s)`
      : "❌ Aucun script Google Analytics trouvé";

    const timer = window.setTimeout(() => setChecks(results), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        backgroundColor: "#08070d",
        color: "white",
        fontFamily: "monospace",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "2rem" }}>
          🔍 Diagnostic Google Analytics
        </h1>

        <div style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#9333ea" }}>
            Vérifications
          </h2>
          
          <div style={{ backgroundColor: "#1a1a1a", padding: "20px", borderRadius: "8px" }}>
            <div style={{ marginBottom: "1rem" }}>
              <strong>1. Variable d&apos;environnement :</strong>
              <div style={{ marginLeft: "20px", marginTop: "5px" }}>
                {checks.envVar}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <strong>2. window.gtag :</strong>
              <div style={{ marginLeft: "20px", marginTop: "5px" }}>
                {checks.gtag}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <strong>3. window.dataLayer :</strong>
              <div style={{ marginLeft: "20px", marginTop: "5px" }}>
                {checks.dataLayer}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <strong>4. Consentement cookies :</strong>
              <div style={{ marginLeft: "20px", marginTop: "5px" }}>
                {checks.consent}
              </div>
            </div>

            <div style={{ marginBottom: "0" }}>
              <strong>5. Scripts chargés :</strong>
              <div style={{ marginLeft: "20px", marginTop: "5px" }}>
                {checks.scripts}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#9333ea" }}>
            Actions à faire
          </h2>
          
          <div style={{ backgroundColor: "#1a1a1a", padding: "20px", borderRadius: "8px" }}>
            {checks.envVar.includes("❌") && (
              <div style={{ marginBottom: "1rem", padding: "15px", backgroundColor: "#991b1b", borderRadius: "4px" }}>
                <strong>⚠️ PROBLÈME CRITIQUE</strong>
                <p style={{ marginTop: "10px" }}>
                  La variable <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code> n&apos;est pas définie dans Vercel.
                </p>
                <p style={{ marginTop: "10px" }}>
                  <strong>Solution :</strong>
                </p>
                <ol style={{ marginTop: "5px", marginLeft: "20px" }}>
                  <li>Va sur https://vercel.com/dashboard</li>
                  <li>Clique sur ton projet &quot;planete-hmi&quot;</li>
                  <li>Settings → Environment Variables</li>
                  <li>Add New :
                    <ul style={{ marginLeft: "20px", marginTop: "5px" }}>
                      <li>Name: <code>NEXT_PUBLIC_GA_MEASUREMENT_ID</code></li>
                      <li>Value: <code>G-57C9XWTSYY</code></li>
                      <li>Coche: Production, Preview, Development</li>
                    </ul>
                  </li>
                  <li>Save</li>
                  <li>Deployments → ... → Redeploy</li>
                </ol>
              </div>
            )}

            {checks.consent.includes("❌") && (
              <div style={{ marginBottom: "1rem", padding: "15px", backgroundColor: "#854d0e", borderRadius: "4px" }}>
                <strong>⚠️ Cookies non acceptés</strong>
                <p style={{ marginTop: "10px" }}>
                  Va sur : <Link href="/accept-cookies" style={{ color: "#60a5fa" }}>/accept-cookies</Link>
                </p>
              </div>
            )}

            {checks.envVar.includes("✅") && checks.consent.includes("✅") && (
              <div style={{ padding: "15px", backgroundColor: "#065f46", borderRadius: "4px" }}>
                <strong>✅ Tout est configuré !</strong>
                <p style={{ marginTop: "10px" }}>
                  Google Analytics devrait fonctionner. Vérifie dans GA → Rapports → Temps réel.
                </p>
                <p style={{ marginTop: "10px" }}>
                  Si tu ne vois toujours rien, attends 5-10 minutes ou vide le cache (Ctrl + Shift + Suppr).
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#9333ea",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
            }}
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
