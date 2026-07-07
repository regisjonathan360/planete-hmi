"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSourceEnabled } from "@/app/admin/charts/sources/actions";

export function SourceToggle({ sourceKey, initialEnabled }: { sourceKey: string; initialEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialEnabled);

  function toggle() {
    startTransition(async () => {
      const r = await toggleSourceEnabled(sourceKey, !enabled);
      if (r.ok) setEnabled(!enabled);
      router.refresh();
    });
  }

  return (
    <button
      className={`admin__btn admin__btn--ghost`}
      onClick={toggle}
      disabled={pending}
      style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}
    >
      {enabled ? "Désactiver" : "Activer"}
    </button>
  );
}
