import { NextResponse } from "next/server";
import { contributionInputSchema } from "@/lib/payments/validation";
import {
  createContributionReference,
  hashRateLimitKey,
  isProviderAvailable,
  paymentModeForProvider,
  safeNullable,
} from "@/lib/payments/server";
import {
  createMonCashPayment,
  getMonCashAutomaticConfiguration,
} from "@/lib/payments/moncash";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CONTRIBUTION_SELECT =
  "id, reference, provider, payment_mode, amount, currency, status, created_at, provider_payload";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  const validated = contributionInputSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { error: validated.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const input = validated.data;
  if (
    ((input.provider === "moncash" || input.provider === "natcash") &&
      input.currency !== "HTG") ||
    (input.provider === "paypal" && input.currency !== "USD")
  ) {
    return NextResponse.json(
      { error: "La devise ne correspond pas au moyen de paiement choisi." },
      { status: 400 },
    );
  }
  if (!isProviderAvailable(input.provider)) {
    return NextResponse.json(
      { error: "Ce moyen de paiement n’est pas encore disponible." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const { data: rateAllowed, error: rateError } = await supabase.rpc(
    "consume_contribution_rate_limit",
    {
      p_key_hash: hashRateLimitKey(request, "create"),
      p_limit: 8,
      p_window_seconds: 3600,
    },
  );
  if (rateError || rateAllowed !== true) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 },
    );
  }

  const contribution = {
    reference: createContributionReference(),
    idempotency_key: input.idempotencyKey,
    provider: input.provider,
    payment_mode: paymentModeForProvider(input.provider),
    amount: input.amount,
    currency: input.currency,
    status: "PENDING",
    donor_name: input.anonymous ? null : safeNullable(input.donorName),
    donor_email: safeNullable(input.donorEmail),
    donor_phone: safeNullable(input.donorPhone),
    donor_message: safeNullable(input.message),
    is_anonymous: input.anonymous,
  };

  const { data, error } = await supabase
    .from("contributions")
    .insert(contribution)
    .select(CONTRIBUTION_SELECT)
    .single();

  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("contributions")
      .select(CONTRIBUTION_SELECT)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return respondWithPreparedContribution(supabase, existing);
    }
  }
  if (error || !data) {
    console.error("[contributions/create] insert failed", error?.code ?? "unknown");
    return NextResponse.json(
      { error: "La contribution n’a pas pu être préparée. Vos informations restent dans le formulaire." },
      { status: 500 },
    );
  }

  return respondWithPreparedContribution(supabase, data, 201);
}

async function respondWithPreparedContribution(
  supabase: ReturnType<typeof createAdminClient>,
  contribution: Record<string, unknown>,
  status = 200,
) {
  if (
    contribution.provider !== "moncash" ||
    contribution.payment_mode !== "AUTOMATIC"
  ) {
    return NextResponse.json(
      { contribution: publicContribution(contribution) },
      { status },
    );
  }

  const previousPayload = contribution.provider_payload;
  if (
    contribution.status === "PROCESSING" &&
    previousPayload &&
    typeof previousPayload === "object" &&
    typeof (previousPayload as Record<string, unknown>).redirect_url === "string"
  ) {
    return NextResponse.json(
      {
        contribution: {
          ...publicContribution(contribution),
          redirectUrl: (previousPayload as Record<string, string>).redirect_url,
        },
      },
      { status },
    );
  }

  const configuration = getMonCashAutomaticConfiguration();
  if (!configuration) {
    return NextResponse.json(
      { error: "La configuration automatique MonCash est incomplète." },
      { status: 503 },
    );
  }

  try {
    const payment = await createMonCashPayment(
      configuration,
      String(contribution.reference),
      Number(contribution.amount),
    );
    const providerPayload = {
      redirect_url: payment.redirectUrl,
      payment_token: payment.token,
      created_at: new Date().toISOString(),
      environment: configuration.environment,
    };
    const { data: updated, error } = await supabase
      .from("contributions")
      .update({
        status: "PROCESSING",
        provider_payload: providerPayload,
      })
      .eq("id", contribution.id)
      .select(CONTRIBUTION_SELECT)
      .single();
    if (error || !updated) throw new Error("contribution_update_failed");

    await supabase.from("contribution_status_history").insert({
      contribution_id: contribution.id,
      previous_status: contribution.status,
      new_status: "PROCESSING",
      reason: "Paiement MonCash créé et redirection remise au visiteur.",
    });
    return NextResponse.json(
      {
        contribution: {
          ...publicContribution(updated),
          redirectUrl: payment.redirectUrl,
        },
      },
      { status },
    );
  } catch (error) {
    console.error(
      "[contributions/create] MonCash initialization failed",
      error instanceof Error ? error.name : "unknown",
    );
    await supabase
      .from("contributions")
      .update({ status: "FAILED" })
      .eq("id", contribution.id);
    await supabase.from("contribution_status_history").insert({
      contribution_id: contribution.id,
      previous_status: contribution.status,
      new_status: "FAILED",
      reason: "Échec de l’initialisation du paiement MonCash.",
    });
    return NextResponse.json(
      {
        error:
          "MonCash n’a pas pu préparer le paiement. Réessayez dans quelques instants.",
      },
      { status: 502 },
    );
  }
}

function publicContribution(contribution: Record<string, unknown>) {
  return {
    reference: contribution.reference,
    provider: contribution.provider,
    payment_mode: contribution.payment_mode,
    amount: contribution.amount,
    currency: contribution.currency,
    status: contribution.status,
    created_at: contribution.created_at,
  };
}
