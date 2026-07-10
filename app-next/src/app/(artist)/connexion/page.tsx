import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = {
  title: "Connexion artiste",
  description: "Accès sécurisé à l'espace artiste Planet HMI.",
};

export const dynamic = "force-dynamic";

const ALLOWED_NEXT_PATHS = new Set(["/espace-artiste"]);

function safeNextPath(value: string | undefined): string {
  return value && ALLOWED_NEXT_PATHS.has(value) ? value : "/espace-artiste";
}

const NOTICE_MESSAGES: Record<string, string> = {
  "signed-out": "Tu es maintenant déconnecté.",
  "confirmation-error": "Le lien de confirmation n'est plus valide.",
};

export default async function ArtistLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  if (user) redirect(nextPath);

  return (
    <div className="wrap artist-auth-page">
      <section className="artist-auth-heading">
        <p className="artist-kicker">Espace artiste</p>
        <h1>Connexion Planet HMI</h1>
        <p>Gère ton identité et tes données TikTok depuis un seul espace.</p>
      </section>
      <AuthForm
        nextPath={nextPath}
        initialMessage={params.notice ? NOTICE_MESSAGES[params.notice] : undefined}
      />
    </div>
  );
}
