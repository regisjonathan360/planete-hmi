import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>
          Planète <span style={{ color: "var(--admin-accent)" }}>HMI</span>
        </h1>
        <p>Administration des classements. Accès réservé.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
