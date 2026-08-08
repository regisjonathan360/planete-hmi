import { redirect } from "next/navigation";

/**
 * Page par défaut de /arene.
 * Redirige automatiquement vers /arene/battles (Requirement 1.6).
 */
export default function ArenePage() {
  redirect("/arene/battles");
}
