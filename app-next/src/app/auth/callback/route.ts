import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_NEXT_PATHS = new Set(["/espace-artiste"]);

function safeNextPath(value: string | null): string {
  return value && ALLOWED_NEXT_PATHS.has(value) ? value : "/espace-artiste";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(
    new URL("/connexion?notice=confirmation-error", request.url)
  );
}
