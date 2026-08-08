import { NextResponse } from "next/server";
import { contributionReferenceSchema } from "@/lib/payments/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const validated = contributionReferenceSchema.safeParse(reference);
  if (!validated.success) {
    return NextResponse.json({ error: "Référence invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contributions")
    .select("reference, provider, amount, currency, status, created_at, reviewed_at")
    .eq("reference", validated.data)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Le statut est temporairement indisponible." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Référence introuvable." }, { status: 404 });
  }

  return NextResponse.json({ contribution: data });
}
