import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Convention Next.js 16 : « proxy » remplace « middleware ».
// Rafraîchit la session Supabase et protège la zone /admin.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf assets statiques et images.
     * La garde /admin est appliquée dans updateSession.
     */
    "/((?!_next/static|_next/image|favicon.ico|brand|image|assets|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|css|js)$).*)",
  ],
};
