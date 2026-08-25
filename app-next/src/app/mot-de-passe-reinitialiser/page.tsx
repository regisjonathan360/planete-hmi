import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Nouveau mot de passe — Planète HMI",
  description: "Définissez un nouveau mot de passe pour votre compte.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function MotDePasseReinitialiserPage() {
  // Accessible uniquement via le lien de l'email (session établie par
  // /auth/callback). Sans session valide, le lien a expiré ou est falsifié.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?notice=reset-link-expired");

  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap" style={{ maxWidth: 400, paddingTop: "3rem" }}>
          <h1 className="legal-page__title" style={{ fontSize: "1.5rem" }}>Nouveau mot de passe</h1>
          <p style={{ color: "rgba(244,239,228,0.6)", marginBottom: "1.5rem" }}>
            Choisis un nouveau mot de passe pour ton compte.
          </p>
          <ResetPasswordForm />
        </div>
      </main>
    </>
  );
}
