import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildTikTokAuthorizationUrl,
  TIKTOK_OAUTH_STATE_COOKIE,
} from "@/lib/tiktok/user-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/connexion", request.url);
    loginUrl.searchParams.set("next", "/espace-artiste");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(buildTikTokAuthorizationUrl(state));
    response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/api/tiktok/callback",
    });
    return response;
  } catch (error) {
    console.error("[TikTok OAuth] Configuration invalide", {
      error: error instanceof Error ? error.message : "erreur inconnue",
    });
    return NextResponse.redirect(
      new URL("/espace-artiste?notice=tiktok-unavailable", request.url)
    );
  }
}
