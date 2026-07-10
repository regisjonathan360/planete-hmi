import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/connexion/:path*",
    "/espace-artiste/:path*",
    "/api/tiktok/:path*",
    "/auth/callback",
    "/admin/:path*",
  ],
};
