import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Mot de passe oublié — Planète HMI",
  description: "Recevez un lien de réinitialisation de mot de passe.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function MotDePasseOubliePage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap" style={{ maxWidth: 400, paddingTop: "3rem" }}>
          <h1 className="legal-page__title" style={{ fontSize: "1.5rem" }}>Mot de passe oublié</h1>
          <p style={{ color: "rgba(244,239,228,0.6)", marginBottom: "1.5rem" }}>
            Saisis ton adresse email : tu recevras un lien pour définir un nouveau mot de passe.
          </p>
          <ForgotPasswordForm />
          <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.85rem", color: "rgba(244,239,228,0.6)" }}>
            <Link href="/connexion" style={{ color: "var(--flame-orange, #ff6a00)", textDecoration: "underline" }}>
              Retour à la connexion
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
