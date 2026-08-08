/**
 * Classement planétaire de la page d'accueil.
 *
 * GET  — prévisualise le calcul (top 20 moyennés).
 * POST — publie le top N (par défaut 5).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeHomepageChart,
  getPublishedHomepageChart,
  publishHomepageChart,
} from "@/lib/home/homepage-chart";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createAdminClient();
  const [computed, published] = await Promise.all([
    computeHomepageChart(supabase, 20),
    getPublishedHomepageChart(supabase),
  ]);

  return NextResponse.json({ ok: true, computed, published });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const rawLimit = Number((body as Record<string, unknown>)?.limit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10) : 5;

  const supabase = createAdminClient();
  const computed = await computeHomepageChart(supabase, limit);
  const result = await publishHomepageChart(supabase, computed, {
    limit,
    publishedBy: auth.user.id,
  });

  return NextResponse.json({ ok: true, ...result });
}
