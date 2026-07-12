"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminHeader({ email, active }: { email: string | null; active?: string }) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="admin__header">
      <div className="admin__brand">
        Planète <span>HMI</span> · Admin
      </div>
      <nav className="admin__nav">
        <Link href="/admin" className={active === "home" ? "is-active" : ""}>
          Tableau de bord
        </Link>
        <Link href="/admin/audiomack" className={active === "audiomack" ? "is-active" : ""}>
          Audiomack
        </Link>
        <Link href="/admin/deezer" className={active === "deezer" ? "is-active" : ""}>
          Deezer
        </Link>
        <Link href="/admin/tiktok" className={active === "tiktok" ? "is-active" : ""}>
          TikTok
        </Link>
        <Link href="/charts" target="_blank" style={{ color: "var(--admin-accent-2)" }}>
          Classements publics ↗
        </Link>
        {email && <span style={{ color: "var(--admin-muted)", fontSize: "0.8rem" }}>{email}</span>}
        <button className="btn btn--sm btn--ghost" onClick={logout}>
          Déconnexion
        </button>
      </nav>
    </header>
  );
}
