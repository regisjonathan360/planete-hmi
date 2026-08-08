import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { VisitorAuthForm } from "./VisitorAuthForm";

export const metadata: Metadata = {
  title: "Connexion — Planète HMI",
  description: "Connectez-vous pour gérer vos favoris et votre espace personnel.",
};

export const dynamic = "force-dynamic";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  if (user) redirect(params.next ?? "/compte");

  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap" style={{ maxWidth: 400, paddingTop: "3rem" }}>
          <h1 className="legal-page__title" style={{ fontSize: "1.5rem" }}>Connexion</h1>
          <p style={{ color: "rgba(244,239,228,0.6)", marginBottom: "1.5rem" }}>
            Connecte-toi pour ajouter des artistes en favoris et accéder à ton espace.
          </p>
          <VisitorAuthForm nextPath={params.next ?? "/compte"} />
        </div>
      </main>
    </>
  );
}
