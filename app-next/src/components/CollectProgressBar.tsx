"use client";

export interface CollectProgress {
  phase: "init" | "start" | "source" | "scraping" | "scraped" | "inserting" | "done" | "error";
  percent: number;
  message: string;
  found?: number;
  inserted?: number;
  current?: number;
  total?: number;
  source?: string;
}

export function CollectProgressBar({ progress }: { progress: CollectProgress | null }) {
  if (!progress) return null;

  const isError = progress.phase === "error";
  const isDone = progress.phase === "done";

  const barColor = isError
    ? "var(--admin-danger)"
    : isDone
      ? "var(--admin-ok)"
      : "var(--admin-accent)";

  return (
    <div
      style={{
        marginTop: "0.9rem",
        padding: "0.9rem 1rem",
        borderRadius: 10,
        background: "var(--admin-panel-2)",
        border: `1px solid ${isError ? "var(--admin-danger)" : isDone ? "var(--admin-ok)" : "var(--admin-border)"}`,
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "0.55rem",
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            color: "var(--admin-text)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isError ? "✗ " : isDone ? "✓ " : ""}
          {progress.message}
        </span>
        <strong
          style={{
            fontSize: "0.85rem",
            color: barColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {progress.percent}%
        </strong>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, Math.max(0, progress.percent))}%`,
            borderRadius: 999,
            background: barColor,
            transition: "width 0.25s ease, background-color 0.25s ease",
          }}
        />
      </div>

      {progress.total ? (
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--admin-muted)" }}>
          {progress.current}/{progress.total} traités
          {progress.inserted !== undefined && ` · ${progress.inserted} nouveaux`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Lit un flux SSE de collecte et appelle onProgress à chaque étape.
 * Retourne le dernier état reçu.
 */
export async function readCollectStream(
  response: Response,
  onProgress: (p: CollectProgress) => void
): Promise<CollectProgress | null> {
  if (!response.body) {
    const fallback: CollectProgress = {
      phase: "error",
      percent: 0,
      message: "Flux de collecte indisponible.",
    };
    onProgress(fallback);
    return fallback;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: CollectProgress | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed.startsWith("data:")) continue;
      try {
        const parsed = JSON.parse(trimmed.slice(5).trim()) as CollectProgress;
        last = parsed;
        onProgress(parsed);
      } catch {
        // chunk partiel — on ignore
      }
    }
  }

  return last;
}
