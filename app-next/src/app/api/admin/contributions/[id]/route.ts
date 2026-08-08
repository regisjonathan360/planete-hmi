import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { reviewContributionSchema } from "@/lib/payments/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const validated = reviewContributionSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("review_contribution", {
    p_contribution_id: id,
    p_new_status: validated.data.status,
    p_changed_by: auth.user.id,
    p_reason: validated.data.reason,
    p_internal_notes: validated.data.internalNotes,
  });
  if (error) {
    const notFound = error.message.includes("contribution_not_found");
    return NextResponse.json(
      { error: notFound ? "Contribution introuvable." : "Le statut n’a pas pu être modifié." },
      { status: notFound ? 404 : 409 },
    );
  }

  return NextResponse.json({ contribution: data });
}
