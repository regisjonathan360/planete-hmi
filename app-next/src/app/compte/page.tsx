import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { NiveauBadge } from "@/components/arene/NiveauBadge";
import type { Niveau } from "@/lib/arene/levels";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ComptePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion?next=/compte");

  // Fetch community profile
  const { data: profile } = await supabase
    .from("community_profiles")
    .select("*")
    .eq("member_id", user.id)
    .maybeSingle();

  // Fetch recent badges
  const { data: badges } = await supabase
    .from("member_badges")
    .select("created_at, badges(name, icon_url, description)")
    .eq("member_id", user.id)
    .order("created_at", { ascending: false })
    .limit(6);

  // Fetch favorites count
  const { count: favCount } = await supabase
    .from("favorites")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <>
      <SiteHeader />
      <main style={{ minHeight: "100vh", padding: "2rem 1rem", background: "var(--void, #0a0a14)", color: "var(--cream, #f0ece2)" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto" }}>

          {/* Header section */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2.5rem", flexWrap: "wrap" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: "2px solid rgba(244,239,228,0.2)", background: "rgba(244,239,228,0.05)", display: "grid", placeItems: "center", fontSize: "2rem", flexShrink: 0 }}>
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span>{(profile?.pseudo ?? user.email ?? "U").charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: "0 0 0.3rem", fontSize: "1.6rem", fontFamily: "var(--font-display)" }}>
                {profile?.pseudo ?? "Mon espace"}
              </h1>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(244,239,228,0.6)" }}>
                {user.email} · Membre depuis {new Date(user.created_at).toLocaleDateString("fr-FR")}
              </p>
              {profile && (
                <div style={{ marginTop: "0.5rem" }}>
                  <NiveauBadge niveau={(profile.niveau as Niveau) ?? "etoile"} size="lg" />
                </div>
              )}
            </div>
          </div>

          {/* Stats cards */}
          {profile && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              <StatCard label="Points Cosmiques" value={profile.points_cosmiques?.toLocaleString("fr-FR") ?? "0"} icon="✨" />
              <StatCard label="Commentaires" value={String(profile.comment_count ?? 0)} icon="💬" />
              <StatCard label="Votes" value={String(profile.vote_count ?? 0)} icon="🗳️" />
              <StatCard label="Réactions" value={String(profile.reaction_count ?? 0)} icon="🌟" />
              <StatCard label="Favoris" value={String(favCount ?? 0)} icon="❤️" />
            </div>
          )}

          {/* Quick links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2.5rem" }}>
            <QuickLink href="/arene" label="Arène communautaire" description="Battles, défis, discussions" icon="⚔️" />
            <QuickLink href="/compte/favoris" label="Mes favoris" description="Artistes sauvegardés" icon="❤️" />
            <QuickLink href="/arene/classement-membres" label="Classement" description="Top 50 membres" icon="🏆" />
            {profile && <QuickLink href="/arene/defis" label="Défis actifs" description="Gagne des points" icon="🎯" />}
          </div>

          {/* Badges section */}
          {badges && badges.length > 0 && (
            <section style={{ marginBottom: "2.5rem" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Mes badges</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                {badges.map((b, i) => {
                  const badge = b.badges as unknown as { name: string; icon_url: string; description: string } | null;
                  if (!badge) return null;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.8rem", border: "1px solid rgba(244,239,228,0.12)", borderRadius: "10px", background: "rgba(244,239,228,0.03)" }}>
                      <span style={{ fontSize: "1.2rem" }}>{badge.icon_url.startsWith("http") ? "🏅" : badge.icon_url}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{badge.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Actions */}
          <section style={{ paddingTop: "1.5rem", borderTop: "1px solid rgba(244,239,228,0.1)" }}>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" style={{
                background: "transparent", border: "1px solid rgba(255,92,124,0.4)",
                color: "#ff5c7c", padding: "0.6rem 1.2rem", borderRadius: "8px",
                cursor: "pointer", fontSize: "0.85rem", transition: "all 0.2s",
              }}>
                Se déconnecter
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div style={{ padding: "1.1rem", border: "1px solid rgba(244,239,228,0.1)", borderRadius: "14px", background: "rgba(244,239,228,0.03)", textAlign: "center" }}>
      <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>{icon}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "rgba(244,239,228,0.6)", marginTop: "0.2rem" }}>{label}</div>
    </div>
  );
}

function QuickLink({ href, label, description, icon }: { href: string; label: string; description: string; icon: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "1rem", border: "1px solid rgba(244,239,228,0.1)", borderRadius: "14px", background: "rgba(244,239,228,0.03)", textDecoration: "none", color: "inherit", transition: "border-color 0.2s, background 0.2s" }}>
      <span style={{ fontSize: "1.4rem" }}>{icon}</span>
      <div>
        <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#f4efe4" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "rgba(244,239,228,0.55)" }}>{description}</div>
      </div>
    </Link>
  );
}
