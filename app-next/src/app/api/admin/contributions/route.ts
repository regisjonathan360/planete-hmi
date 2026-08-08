import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminContributionQuerySchema } from "@/lib/payments/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PUBLIC_ADMIN_FIELDS =
  "id, reference, provider, payment_mode, amount, currency, status, donor_name, donor_email, donor_phone, donor_message, is_anonymous, manual_transaction_code, proof_storage_path, internal_notes, reviewed_by, reviewed_at, created_at, updated_at";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const validated = adminContributionQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!validated.success) {
    return NextResponse.json({ error: "Filtres invalides." }, { status: 400 });
  }

  const filters = validated.data;
  const supabase = createAdminClient();
  let query = supabase
    .from("contributions")
    .select(PUBLIC_ADMIN_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.provider) query = query.eq("provider", filters.provider);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
  if (filters.search) {
    const safeSearch = filters.search
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (safeSearch) {
      query = query.or(
        `reference.ilike.%${safeSearch}%,donor_name.ilike.%${safeSearch}%,manual_transaction_code.ilike.%${safeSearch}%`,
      );
    }
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("[admin/contributions] list failed", error.code);
    return NextResponse.json(
      { error: "Impossible de charger les contributions." },
      { status: 500 },
    );
  }

  return NextResponse.json({ contributions: data ?? [], total: count ?? 0 });
}
