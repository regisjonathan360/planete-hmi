/**
 * POST /api/admin/producers/sync
 * Synchronise les crédits de production avec progression temps réel (SSE).
 */
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncProducers } from "@/lib/producers/sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const rawLimit = Number(body?.trackLimit);
  const trackLimit = Number.isFinite(rawLimit) ? rawLimit : 500;
  const enrichWithSpotify = body?.enrichWithSpotify !== false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const report = await syncProducers(createAdminClient(), {
          trackLimit,
          enrichWithSpotify,
          onProgress: send,
        });

        if (report.warnings.length > 0) {
          send({
            ...report,
            phase: "done",
            percent: 100,
            message: `Synchronisation terminée avec ${report.warnings.length} avertissement(s).`,
          });
        }
      } catch (err) {
        send({
          phase: "error",
          percent: 0,
          message: err instanceof Error ? err.message : "Erreur pendant la synchronisation.",
        });
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
