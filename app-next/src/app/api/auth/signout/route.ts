/**
 * POST /api/auth/signout
 * Déconnecte l'utilisateur et redirige vers l'accueil (même origine).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 See Other : le navigateur repart en GET sur l'accueil.
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
