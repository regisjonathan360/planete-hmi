"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateArtistStatusAction } from "@/app/admin/charts/artists/actions";
import type { HaitianStatus } from "@/lib/charts/types";

const ACTIONS: { status: HaitianStatus; label: string; variant?: "ghost" }[] = [
  { status: "verified_haitian", label: "Garder" },
  { status: "verified_haitian_diaspora", label: "Diaspora", variant: "ghost" },
  { status: "verified_haitian_group", label: "Groupe", variant: "ghost" },
  { status: "pending_review", label: "A revoir", variant: "ghost" },
  { status: "rejected", label: "Retirer", variant: "ghost" },
];

export function ArtistStatusButtons({ artistId }: { artistId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function update(status: HaitianStatus) {
    startTransition(async () => {
      const result = await updateArtistStatusAction(artistId, status);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="admin__actions">
      {ACTIONS.map((action) => (
        <button
          key={action.status}
          className={action.variant === "ghost" ? "admin__btn admin__btn--ghost" : "admin__btn"}
          disabled={pending}
          type="button"
          onClick={() => update(action.status)}
        >
          {action.label}
        </button>
      ))}
      {message && <span className="admin__ok">{message}</span>}
    </div>
  );
}
