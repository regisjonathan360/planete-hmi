import { NextResponse } from "next/server";
import {
  getMonCashAutomaticConfiguration,
  retrieveMonCashPayment,
} from "@/lib/payments/moncash";
import {
  contributionReferenceSchema,
} from "@/lib/payments/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TRANSACTION_ID = /^[A-Za-z0-9_-]{3,160}$/;

export async function GET(request: Request) {
  return handleMonCashCallback(request, false);
}

export async function handleMonCashCallback(
  request: Request,
  browserReturn: boolean,
) {
  const url = new URL(request.url);
  const transactionId = url.searchParams.get("transactionId")?.trim();
  const orderId = url.searchParams.get("orderId")?.trim().toUpperCase();
  const configuration = getMonCashAutomaticConfiguration();

  if (!configuration) {
    return callbackResponse(
      request,
      browserReturn,
      null,
      "La configuration MonCash est incomplète.",
      503,
    );
  }
  if (
    (!transactionId || !TRANSACTION_ID.test(transactionId)) &&
    (!orderId || !contributionReferenceSchema.safeParse(orderId).success)
  ) {
    return callbackResponse(
      request,
      browserReturn,
      orderId ?? null,
      "Identifiant MonCash invalide.",
      400,
    );
  }

  try {
    const payment = await retrieveMonCashPayment(
      configuration,
      transactionId && TRANSACTION_ID.test(transactionId)
        ? { transactionId }
        : { orderId: orderId as string },
    );
    const parsedReference = contributionReferenceSchema.safeParse(
      payment.reference.toUpperCase(),
    );
    if (!parsedReference.success) {
      return callbackResponse(
        request,
        browserReturn,
        orderId ?? null,
        "La référence renvoyée par MonCash est invalide.",
        422,
      );
    }

    const supabase = createAdminClient();
    const { data: contribution, error } = await supabase
      .from("contributions")
      .select("id, reference, provider, amount, currency, status")
      .eq("reference", parsedReference.data)
      .maybeSingle();
    if (error || !contribution || contribution.provider !== "moncash") {
      return callbackResponse(
        request,
        browserReturn,
        parsedReference.data,
        "Contribution MonCash introuvable.",
        404,
      );
    }

    const amountMatches =
      contribution.currency === "HTG" &&
      Math.abs(Number(contribution.amount) - payment.amount) < 0.005;
    const nextStatus =
      payment.successful && amountMatches ? "CONFIRMED" : "PENDING_REVIEW";
    if (contribution.status !== nextStatus) {
      const { data: updated, error: updateError } = await supabase
        .from("contributions")
        .update({
          status: nextStatus,
          provider_transaction_id: payment.transactionId,
          provider_payload: {
            transaction_id: payment.transactionId,
            amount: payment.amount,
            message: payment.message,
            verified_at: new Date().toISOString(),
            environment: configuration.environment,
          },
          reviewed_at: nextStatus === "CONFIRMED" ? new Date().toISOString() : null,
        })
        .eq("id", contribution.id)
        .eq("status", contribution.status)
        .select("id")
        .maybeSingle();
      if (updateError) {
        console.error(
          "[contributions/moncash/callback] contribution update failed",
          updateError.code,
        );
        return callbackResponse(
          request,
          browserReturn,
          contribution.reference,
          updateError.code === "23505"
            ? "Cette transaction MonCash est déjà associée à une autre contribution."
            : "Le paiement a été vérifié mais son statut n’a pas pu être enregistré.",
          updateError.code === "23505" ? 409 : 500,
        );
      }
      if (updated) {
        await supabase.from("contribution_status_history").insert({
          contribution_id: contribution.id,
          previous_status: contribution.status,
          new_status: nextStatus,
          reason:
            nextStatus === "CONFIRMED"
              ? "Transaction vérifiée auprès de l’API MonCash."
              : "Transaction MonCash reçue mais montant ou statut à vérifier.",
        });
      }
    }

    return callbackResponse(
      request,
      browserReturn,
      contribution.reference,
      nextStatus === "CONFIRMED"
        ? "Paiement MonCash confirmé."
        : "Paiement transmis pour vérification.",
      nextStatus === "CONFIRMED" ? 200 : 202,
    );
  } catch (error) {
    console.error(
      "[contributions/moncash/callback] verification failed",
      error instanceof Error ? error.name : "unknown",
    );
    return callbackResponse(
      request,
      browserReturn,
      orderId ?? null,
      "La vérification MonCash est temporairement indisponible.",
      502,
    );
  }
}

function callbackResponse(
  request: Request,
  browserReturn: boolean,
  reference: string | null,
  message: string,
  status: number,
) {
  if (browserReturn) {
    const target =
      reference && contributionReferenceSchema.safeParse(reference).success
        ? `/support/status/${encodeURIComponent(reference)}`
        : `/support?payment=${status >= 400 ? "verification-error" : "pending"}`;
    return NextResponse.redirect(new URL(target, request.url));
  }
  return NextResponse.json({ ok: status < 400, reference, message }, { status });
}
