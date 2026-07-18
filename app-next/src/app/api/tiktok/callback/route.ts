import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  connectTikTokAccount,
  TikTokConnectionConflictError,
  TikTokConnectionReplacementError,
} from "@/lib/tiktok/connections";
import {
  exchangeTikTokAuthorizationCode,
  normalizeTikTokScopes,
  TIKTOK_OAUTH_STATE_COOKIE,
} from "@/lib/tiktok/user-api";
import { syncTikTokConnection } from "@/lib/tiktok/user-sync";
import { attemptAutoClaim, executeAutoClaim } from "@/lib/tiktok/auto-claim";
import { ensureArtistAccount } from "@/lib/artists/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLAIM_ARTIST_COOKIE = "phmi_claim_artist_id";

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
  // Nettoyer tous les cookies OAuth
  response.cookies.set(TIKTOK_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/tiktok/callback",
  });
  response.cookies.set(CLAIM_ARTIST_COOKIE, "", {
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
  const claimArtistId = request.cookies.get(CLAIM_ARTIST_COOKIE)?.value;

  // 1. Validation CSRF
  if (!statesMatch(expectedState, query.get("state"))) {
    return dashboardRedirect(request, "tiktok-invalid-state");
  }

  // 2. TikTok a refusé
  if (query.get("error")) {
    return dashboardRedirect(request, "tiktok-denied");
  }

  // 3. Code d'autorisation
  const code = query.get("code");
  if (!code) return dashboardRedirect(request, "tiktok-missing-code");

  // 4. Session Planète HMI
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return dashboardRedirect(request, "session-expired");

  try {
    // 5. Échanger le code contre des tokens
    const tokens = await exchangeTikTokAuthorizationCode(code);
    const scopes = normalizeTikTokScopes(tokens.scope);

    // 6. Créer/mettre à jour la connexion TikTok
    const connectionId = await connectTikTokAccount(user, tokens);

    // 7. Sync immédiate (profil + vidéos)
    const syncResult = await syncTikTokConnection(connectionId);

    // 8. Revendication automatique si un artiste cible est spécifié
    if (claimArtistId) {
      const admin = createAdminClient();

      // Récupérer le profil TikTok depuis la connexion (déjà synced)
      const { data: connection } = await admin
        .from("artist_tiktok_connections")
        .select("tiktok_open_id, tiktok_union_id, username")
        .eq("id", connectionId)
        .single();

      if (connection) {
        const claimResult = await attemptAutoClaim(admin, {
          userId: user.id,
          artistId: claimArtistId,
          tiktokOpenId: connection.tiktok_open_id as string,
          tiktokUnionId: (connection.tiktok_union_id as string) ?? null,
          tiktokUsername: (connection.username as string) ?? null,
          grantedScopes: scopes,
        });

        if (claimResult.approved) {
          // Approbation automatique !
          await executeAutoClaim(admin, {
            userId: user.id,
            artistId: claimArtistId,
            connectionId,
            tiktokOpenId: connection.tiktok_open_id as string,
            tiktokUsername: (connection.username as string) ?? null,
            expectedUsername: claimResult.details.expectedUsername,
          });
          return dashboardRedirect(request, "claim-auto-approved");
        } else {
          // Correspondance incertaine → mise en attente
          await admin
            .from("artist_accounts")
            .update({
              artist_id: claimArtistId,
              claim_status: "pending",
              claim_submitted_at: new Date().toISOString(),
              claim_reviewed_at: null,
            })
            .eq("user_id", user.id);

          // Trace d'audit
          await admin.from("artist_claim_audit").insert({
            user_id: user.id,
            artist_id: claimArtistId,
            tiktok_open_id: connection.tiktok_open_id as string,
            tiktok_username: (connection.username as string) ?? null,
            expected_username: claimResult.details.expectedUsername,
            match_result: claimResult.details.matchResult,
            auto_approved: false,
          });

          return dashboardRedirect(request, "claim-submitted");
        }
      }
    } else {
      // Vérifier s'il y a un claim_target_artist_id stocké côté serveur
      const admin = createAdminClient();
      const account = await ensureArtistAccount(user);

      if (account.claim_status === "unsubmitted") {
        const { data: accountRow } = await admin
          .from("artist_accounts")
          .select("claim_target_artist_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const serverTargetId = accountRow?.claim_target_artist_id as string | null;

        if (serverTargetId) {
          // Même logique de claim automatique
          const { data: connection } = await admin
            .from("artist_tiktok_connections")
            .select("tiktok_open_id, tiktok_union_id, username")
            .eq("id", connectionId)
            .single();

          if (connection) {
            const claimResult = await attemptAutoClaim(admin, {
              userId: user.id,
              artistId: serverTargetId,
              tiktokOpenId: connection.tiktok_open_id as string,
              tiktokUnionId: (connection.tiktok_union_id as string) ?? null,
              tiktokUsername: (connection.username as string) ?? null,
              grantedScopes: scopes,
            });

            if (claimResult.approved) {
              await executeAutoClaim(admin, {
                userId: user.id,
                artistId: serverTargetId,
                connectionId,
                tiktokOpenId: connection.tiktok_open_id as string,
                tiktokUsername: (connection.username as string) ?? null,
                expectedUsername: claimResult.details.expectedUsername,
              });

              // Nettoyer le target
              await admin.from("artist_accounts").update({ claim_target_artist_id: null }).eq("user_id", user.id);
              return dashboardRedirect(request, "claim-auto-approved");
            } else {
              // Mise en attente
              await admin.from("artist_accounts").update({
                artist_id: serverTargetId,
                claim_status: "pending",
                claim_submitted_at: new Date().toISOString(),
                claim_target_artist_id: null,
              }).eq("user_id", user.id);

              await admin.from("artist_claim_audit").insert({
                user_id: user.id,
                artist_id: serverTargetId,
                tiktok_open_id: connection.tiktok_open_id as string,
                tiktok_username: (connection.username as string) ?? null,
                expected_username: claimResult.details.expectedUsername,
                match_result: claimResult.details.matchResult,
                auto_approved: false,
              });

              return dashboardRedirect(request, "claim-submitted");
            }
          }
        }
      }
    }

    // Pas de claim → redirection normale
    return dashboardRedirect(
      request,
      syncResult.ok ? "tiktok-connected" : "tiktok-connected-sync-pending"
    );
  } catch (error) {
    console.error("[TikTok OAuth] Echec", {
      userId: user.id,
      error: error instanceof Error ? error.message : "erreur inconnue",
    });
    const notice =
      error instanceof TikTokConnectionConflictError
        ? "tiktok-already-linked"
        : error instanceof TikTokConnectionReplacementError
          ? "tiktok-disconnect-first"
          : "tiktok-connect-error";
    return dashboardRedirect(request, notice);
  }
}
