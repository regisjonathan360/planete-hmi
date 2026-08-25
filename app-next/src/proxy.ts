import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Pages authentifiées / d'authentification (refresh des tokens).
    "/connexion/:path*",
    "/compte/:path*",
    "/espace-artiste/:path*",
    "/arene/:path*",
    "/mot-de-passe-oublie",
    "/mot-de-passe-reinitialiser",
    // Routes API utilisant la session utilisateur.
    "/api/tiktok/:path*",
    "/api/favorites",
    "/api/events/save",
    "/api/arene/:path*",
    "/api/artist/profile",
    "/auth/callback",
    "/admin/:path*",
  ],
};
