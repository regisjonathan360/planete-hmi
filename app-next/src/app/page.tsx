import Link from "next/link";

/**
 * Page d'accueil Planète HMI — route "/".
 * Présente le projet et oriente vers les classements.
 */
export default function HomePage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 60% -20%, #191325 0%, #08070d 60%)",
      color: "#f4efe4",
      fontFamily: "Inter, system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.25rem",
      textAlign: "center",
    }}>
      <h1 style={{
        fontFamily: "Anton, Impact, sans-serif",
        fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
        background: "linear-gradient(92deg, #f3121a, #ff6a00 45%, #ffb200)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        margin: "0 0 0.5rem",
        textTransform: "uppercase",
      }}>
        Planète HMI
      </h1>
      <p style={{ color: "#b9b3a6", fontSize: "1.15rem", maxWidth: "50ch", margin: "0 0 2rem" }}>
        Haitian Music Index — La plateforme de référence pour la musique haïtienne.
        Classements hebdomadaires, artistes vérifiés, données réelles.
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/charts"
          style={{
            background: "linear-gradient(92deg, #f3121a, #ff6a00)",
            color: "#fff",
            padding: "0.75rem 1.8rem",
            borderRadius: "999px",
            fontWeight: 700,
            textDecoration: "none",
            fontSize: "1rem",
          }}
        >
          Voir les classements →
        </Link>
        <Link
          href="/charts/methodology"
          style={{
            border: "1px solid rgba(244,239,228,0.25)",
            color: "#f4efe4",
            padding: "0.75rem 1.8rem",
            borderRadius: "999px",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "1rem",
          }}
        >
          Méthodologie
        </Link>
      </div>
      <p style={{ marginTop: "3rem", color: "#b9b3a6", fontSize: "0.8rem" }}>
        © 2026 Planète HMI · <Link href="/admin/login" style={{ color: "#46b7ff", textDecoration: "none" }}>Admin</Link>
      </p>
    </div>
  );
}
