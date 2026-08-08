"use client";

import { useEffect, useState } from "react";

export default function AcceptCookiesPage() {
  const [status, setStatus] = useState("En cours...");

  useEffect(() => {
    let redirectTimer: number | undefined;
    try {
      const consent = {
        version: 1,
        necessary: true,
        analytics: true,
        decidedAt: Date.now(),
        expiresAt: Date.now() + 180 * 24 * 60 * 60 * 1000,
      };

      localStorage.setItem(
        "planete-hmi-cookie-consent",
        JSON.stringify(consent)
      );

      window.dispatchEvent(
        new CustomEvent("planete-hmi:consent-changed", { detail: consent })
      );

      redirectTimer = window.setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error) {
      redirectTimer = window.setTimeout(() => {
        setStatus("❌ Erreur : " + (error as Error).message);
      }, 0);
    }
    return () => { if (redirectTimer !== undefined) window.clearTimeout(redirectTimer); };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "20px",
        backgroundColor: "#08070d",
        color: "white",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
        Acceptation des cookies
      </h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "2rem" }}>{status}</p>
      <div style={{ textAlign: "center", maxWidth: "600px" }}>
        <p style={{ color: "#999" }}>
          Cette page accepte automatiquement les cookies pour activer Google
          Analytics. Vous serez redirigé vers l&apos;accueil dans quelques secondes.
        </p>
      </div>
    </div>
  );
}
