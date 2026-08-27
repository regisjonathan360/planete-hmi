import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SecurityForms } from "./SecurityForms";
import { DangerZone } from "./DangerZone";

export const metadata: Metadata = {
  title: "Sécurité du compte — Planète HMI",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function CompteSecuritePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/compte/securite");

  return (
    <>
      <SiteHeader />
      <main style={{ minHeight: "100vh", padding: "2rem 1rem", background: "var(--void, #0a0a14)", color: "var(--cream, #f0ece2)" }}>
        <div style={{ maxWidth: "520px", margin: "0 auto" }}>
          <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-display)", marginBottom: "0.5rem" }}>
            Sécurité du compte
          </h1>
          <p style={{ color: "rgba(244,239,228,0.6)", fontSize: "0.9rem", marginBottom: "2rem" }}>
            Connecté en tant que {user.email}
          </p>

          <SecurityForms currentEmail={user.email ?? ""} />

          <DangerZone />

          <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "rgba(244,239,228,0.6)" }}>
            <Link href="/compte" style={{ color: "var(--flame-orange, #ff6a00)", textDecoration: "underline" }}>
              ← Retour à mon espace
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
