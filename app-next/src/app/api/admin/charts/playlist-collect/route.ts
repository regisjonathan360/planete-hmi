/**
 * POST /api/admin/charts/playlist-collect
 * Collecte un classement alimenté par une playlist Spotify, avec progression
 * en temps réel (Server-Sent Events).
 *
 * Corps : { sourceKey: string }
 */
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectPlaylistChart } from "@/lib/charts/playlist-collect";
import { findPlaylistChartSource } from "@/lib/charts/playlist-sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await request.json().catch(() => ({}));
  const sourceKey = String((body as Record<string, unknown>)?.sourceKey ?? "");
  const source = findPlaylistChartSource(sourceKey);
  if (!source) return jsonError("Classement inconnu.", 400);

  const supabase = createAdminClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await collectPlaylistChart(supabase, sourceKey, {
          changedBy: auth.user.id,
          onProgress: send,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur pendant la collecte.";
        // La source garde la trace de l'échec pour le diagnostic en admin.
        await supabase
          .from("chart_sources")
          .update({ last_failure_at: new Date().toISOString(), last_error: message })
          .eq("source_key", sourceKey);

        send({ phase: "error", percent: 0, message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
