import { redirect } from "next/navigation";

/**
 * Catch-all pour les sous-routes inexistantes sous /arene.
 * Redirige automatiquement vers /arene/battles (Requirement 1.7).
 */
export default function AreneCatchAllPage() {
  redirect("/arene/battles");
}
