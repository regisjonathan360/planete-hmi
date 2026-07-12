/**
 * POST /api/auth/signout
 * Déconnecte l'utilisateur et redirige vers l'accueil.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://planete-hmi.vercel.app" : "http://localhost:3000"));
}
