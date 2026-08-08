import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  manualConfirmationSchema,
} from "@/lib/payments/validation";
import { hashRateLimitKey, safeNullable } from "@/lib/payments/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide." }, { status: 400 });
  }

  const validated = manualConfirmationSchema.safeParse({
    reference: formData.get("reference"),
    transactionCode: formData.get("transactionCode"),
    amount: formData.get("amount"),
    donorName: formData.get("donorName"),
    donorPhone: formData.get("donorPhone"),
    message: formData.get("message"),
  });
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? "Informations invalides." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: rateAllowed, error: rateError } = await supabase.rpc(
    "consume_contribution_rate_limit",
    {
      p_key_hash: hashRateLimitKey(request, "manual-proof"),
      p_limit: 10,
      p_window_seconds: 3600,
    },
  );
  if (rateError || rateAllowed !== true) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 },
    );
  }

  const { data: contribution } = await supabase
    .from("contributions")
    .select("id, reference, provider, amount, currency, status, proof_storage_path")
    .eq("reference", validated.data.reference)
    .maybeSingle();

  if (
    !contribution ||
    !["moncash", "natcash", "mannitoks", "remitly", "western_union", "taptap_send"].includes(
      contribution.provider as string,
    )
  ) {
    return NextResponse.json({ error: "Référence introuvable." }, { status: 404 });
  }
  if (!["PENDING", "PENDING_REVIEW"].includes(contribution.status as string)) {
    return NextResponse.json(
      { error: "Cette contribution ne peut plus être modifiée." },
      { status: 409 },
    );
  }
  if (Number(contribution.amount) !== validated.data.amount) {
    return NextResponse.json(
      { error: "Le montant ne correspond pas à la contribution préparée." },
      { status: 400 },
    );
  }

  const proof = formData.get("proof");
  let proofPath = (contribution.proof_storage_path as string | null) ?? null;
  if (proof instanceof File && proof.size > 0) {
    const extension = MIME_EXTENSIONS.get(proof.type);
    if (!extension || proof.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "La preuve doit être un fichier PNG, JPG, WebP ou PDF de 5 Mo maximum." },
        { status: 400 },
      );
    }
    proofPath = `${contribution.id}/${randomUUID()}.${extension}`;
    const buffer = Buffer.from(await proof.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("contribution-proofs")
      .upload(proofPath, buffer, {
        cacheControl: "3600",
        contentType: proof.type,
        upsert: false,
      });
    if (uploadError) {
      console.error("[contributions/manual-proof] upload failed", uploadError.message);
      return NextResponse.json(
        { error: "La preuve n’a pas pu être enregistrée. Réessayez sans fermer cette page." },
        { status: 500 },
      );
    }
  }

  const { error: updateError } = await supabase
    .from("contributions")
    .update({
      status: "PENDING_REVIEW",
      manual_transaction_code: validated.data.transactionCode,
      proof_storage_path: proofPath,
      donor_name: safeNullable(validated.data.donorName),
      donor_phone: safeNullable(validated.data.donorPhone),
      donor_message: safeNullable(validated.data.message),
    })
    .eq("id", contribution.id);

  if (updateError) {
    if (proofPath && proofPath !== contribution.proof_storage_path) {
      await supabase.storage.from("contribution-proofs").remove([proofPath]);
    }
    const duplicate = updateError.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "Ce numéro de transaction a déjà été soumis."
          : "La confirmation n’a pas pu être transmise.",
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  await supabase.from("contribution_status_history").insert({
    contribution_id: contribution.id,
    previous_status: contribution.status,
    new_status: "PENDING_REVIEW",
    changed_by: null,
    reason: "Confirmation manuelle transmise par le visiteur.",
  });

  return NextResponse.json({
    reference: contribution.reference,
    status: "PENDING_REVIEW",
  });
}
