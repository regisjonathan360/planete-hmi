"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveMatchAction } from "@/app/admin/charts/review/actions";

export function ResolveButtons({ queueId }: { queueId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [trackId, setTrackId] = useState("");

  function run(decision: "resolved" | "rejected") {
    startTransition(async () => {
      const r = await resolveMatchAction(queueId, decision, trackId || undefined);
      setMsg(r.message);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
      <input
        placeholder="track_id (UUID)"
        value={trackId}
        onChange={(e) => setTrackId(e.target.value)}
        style={{ width: 240 }}
      />
      <button className="admin__btn" disabled={pending || !trackId} onClick={() => run("resolved")}>Associer</button>
      <button className="admin__btn admin__btn--ghost" disabled={pending} onClick={() => run("rejected")}>Rejeter</button>
      {msg && <span className="admin__ok">{msg}</span>}
    </div>
  );
}
