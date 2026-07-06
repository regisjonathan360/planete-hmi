"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  validateEditionAction,
  publishEditionAction,
  rollbackEditionAction,
} from "@/app/admin/charts/workflow-actions";

export function EditionActions({ editionId, status }: { editionId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; erreurs?: string[] }>) {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (r.ok) setMsg(r.message ?? "Fait.");
      else setErr(r.erreurs?.join(" | ") ?? r.message ?? "Échec.");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
      {status !== "published" && (
        <button className="admin__btn admin__btn--ghost" disabled={pending} onClick={() => run(() => validateEditionAction(editionId))}>
          Valider
        </button>
      )}
      {(status === "validated" || status === "ready") && (
        <button className="admin__btn" disabled={pending} onClick={() => run(() => publishEditionAction(editionId))}>
          Publier
        </button>
      )}
      {status === "published" && (
        <button className="admin__btn admin__btn--ghost" disabled={pending} onClick={() => run(() => rollbackEditionAction(editionId))}>
          Annuler la publication
        </button>
      )}
      {msg && <span className="admin__ok">{msg}</span>}
      {err && <span className="admin__err">{err}</span>}
    </div>
  );
}
