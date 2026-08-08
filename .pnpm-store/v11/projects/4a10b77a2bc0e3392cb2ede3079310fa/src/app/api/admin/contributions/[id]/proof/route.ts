import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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

  const supabase = createAdminClient();
  const { data: contribution } = await supabase
    .from("contributions")
    .select("proof_storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!contribution?.proof_storage_path) {
    return NextResponse.json({ error: "Aucune preuve disponible." }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from("contribution-proofs")
    .createSignedUrl(contribution.proof_storage_path as string, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "La preuve ne peut pas être ouverte." },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl, expiresIn: 300 });
}
