import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth/admin-guard";
import { MfaManager } from "./MfaManager";

export const metadata: Metadata = {
  title: "MFA — Administration Planète HMI",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function AdminMfaPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login?next=/admin/mfa");

  return (
    <div className="login-wrap" style={{ padding: "2rem 1rem" }}>
      <div className="login-card">
        <h1>
          Authentification <span style={{ color: "var(--admin-accent)" }}>à deux facteurs</span>
        </h1>
        <p style={{ marginBottom: "1.5rem" }}>
          Connecté en tant que {user.email}. Protège ton compte admin avec un code TOTP
          (Google Authenticator, Authy, 1Password…).
        </p>
        <MfaManager />
      </div>
    </div>
  );
}
