"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewArtistClaimAction } from "./connection-actions";

export interface PendingArtistClaim {
  userId: string;
  displayName: string;
  contactEmail: string | null;
  submittedAt: string | null;
  artistName: string;
  artistSlug: string;
  tiktokDisplayName: string | null;
  tiktokUsername: string | null;
  tiktokProfileUrl: string | null;
  tiktokVerified: boolean;
}

export function ArtistConnectionsQueue({ claims }: { claims: PendingArtistClaim[] }) {
  const router = useRouter();
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [, startTransition] = useTransition();

  async function review(userId: string, decision: "approved" | "rejected") {
    setBusyUserId(userId);
    setMessage(null);
    const result = await reviewArtistClaimAction({ userId, decision });
    setBusyUserId(null);

    if (!result.ok) {
      setMessage({ text: result.error ?? "Action impossible.", error: true });
      return;
    }

    setMessage({
      text: decision === "approved" ? "Rattachement approuvé." : "Demande refusée.",
    });
    startTransition(() => router.refresh());
  }

  if (claims.length === 0) {
    return <div className="banner banner--ok">Aucune connexion artiste à vérifier.</div>;
  }

  return (
    <div className="entry-list">
      {message && (
        <div className={message.error ? "banner" : "banner banner--ok"} role="status">
          {message.text}
        </div>
      )}

      {claims.map((claim) => (
        <div className="artist-row" key={claim.userId}>
          <div className="entry__meta">
            <div className="entry__title">
              {claim.displayName} demande {claim.artistName}
            </div>
            <div className="entry__artist">
              {claim.tiktokUsername ? `@${claim.tiktokUsername}` : "TikTok sans nom public"}
              {claim.tiktokVerified ? " - compte vérifié" : ""}
              {claim.contactEmail ? ` - ${claim.contactEmail}` : ""}
            </div>
            {claim.tiktokProfileUrl && (
              <a
                href={claim.tiktokProfileUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--admin-accent-2)", fontSize: "0.78rem" }}
              >
                Ouvrir le profil TikTok
              </a>
            )}
          </div>

          <div className="artist-row__actions">
            <button
              type="button"
              className="btn btn--ok btn--sm"
              disabled={busyUserId === claim.userId}
              onClick={() => review(claim.userId, "approved")}
            >
              Approuver
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              disabled={busyUserId === claim.userId}
              onClick={() => review(claim.userId, "rejected")}
            >
              Refuser
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
