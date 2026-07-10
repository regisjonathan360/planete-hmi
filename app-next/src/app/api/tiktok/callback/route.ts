import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  connectTikTokAccount,
  TikTokConnectionConflictError,
} from "@/lib/tiktok/connections";
import { exchangeTikTokAuthorizationCode } from "@/lib/tiktok/user-api";
import { syncTikTokConnection } from "@/lib/tiktok/user-sync";
import { TIKTOK_OAUTH_STATE_COOKIE } from "../connect/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statesMatch(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function dashboardRedirect(request: NextRequest, notice: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(`/espace-artiste?notice=${encodeURIComponent(notice)}`, request.url)
  );
  response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/tiktok/callback",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const expectedState = request.cookies.get(TIKTOK_OAUTH_STATE_COOKIE)?.value;

  if (!statesMatch(expectedState, query.get("state"))) {
    return dashboardRedirect(request, "tiktok-invalid-state");
  }

  if (query.get("error")) {
    console.warn("[TikTok OAuth] Autorisation refusee", {
      code: query.get("error"),
    });
    return dashboardRedirect(request, "tiktok-denied");
  }

  const code = query.get("code");
  if (!code) return dashboardRedirect(request, "tiktok-missing-code");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return dashboardRedirect(request, "session-expired");

  try {
    const tokens = await exchangeTikTokAuthorizationCode(code);
    const connectionId = await connectTikTokAccount(user, tokens);
    const syncResult = await syncTikTokConnection(connectionId);
    return dashboardRedirect(
      request,
      syncResult.ok ? "tiktok-connected" : "tiktok-connected-sync-pending"
    );
  } catch (error) {
    console.error("[TikTok OAuth] Echec de la connexion", {
      userId: user.id,
      error: error instanceof Error ? error.message : "erreur inconnue",
    });
    return dashboardRedirect(
      request,
      error instanceof TikTokConnectionConflictError
        ? "tiktok-already-linked"
        : "tiktok-connect-error"
    );
  }
}
