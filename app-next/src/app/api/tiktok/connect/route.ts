import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTikTokAuthorizationUrl,
  TIKTOK_OAUTH_STATE_COOKIE,
} from "@/lib/tiktok/user-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cookie pour mémoriser l'artiste demandé pendant le flux OAuth */
const CLAIM_ARTIST_COOKIE = "phmi_claim_artist_id";

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

  // Mémoriser l'artiste cible (passé en query param par le bouton "Revendiquer")
  const claimArtistId = request.nextUrl.searchParams.get("claim");

  // Valider que l'artiste existe et est actif (si spécifié)
  if (claimArtistId) {
    const admin = createAdminClient();
    const { data: artist } = await admin
      .from("artists")
      .select("id")
      .eq("id", claimArtistId)
      .eq("is_active", true)
      .maybeSingle();

    if (!artist) {
      return NextResponse.redirect(
        new URL("/espace-artiste?notice=claim-invalid", request.url)
      );
    }

    // Stocker côté serveur dans artist_accounts
    await admin
      .from("artist_accounts")
      .update({ claim_target_artist_id: claimArtistId })
      .eq("user_id", user.id);
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const authUrl = buildTikTokAuthorizationUrl(state);
    const response = NextResponse.redirect(authUrl);

    // Cookie CSRF state
    response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/api/tiktok/callback",
    });

    // Cookie artist claim (httpOnly, pas exposé au client)
    if (claimArtistId) {
      response.cookies.set(CLAIM_ARTIST_COOKIE, claimArtistId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/api/tiktok/callback",
      });
    }

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
