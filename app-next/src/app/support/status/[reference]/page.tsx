import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiHistoryLine,
  RiInformationLine,
} from "react-icons/ri";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { contributionReferenceSchema } from "@/lib/payments/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import styles from "../../support.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmation de contribution",
  robots: { index: false, follow: false },
};

export default async function ContributionStatusPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const validated = contributionReferenceSchema.safeParse(reference);
  if (!validated.success) notFound();

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("contributions")
    .select("reference, provider, amount, currency, status, created_at, reviewed_at")
    .eq("reference", validated.data)
    .maybeSingle();
  if (!data) notFound();

  const presentation = statusPresentation(data.status as string);

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.statusResult} aria-labelledby="status-title">
          <span className={styles.statusIcon} data-tone={presentation.tone}>
            {presentation.tone === "success" ? (
              <RiCheckboxCircleLine aria-hidden="true" />
            ) : presentation.tone === "error" ? (
              <RiCloseCircleLine aria-hidden="true" />
            ) : presentation.tone === "pending" ? (
              <RiHistoryLine aria-hidden="true" />
            ) : (
              <RiInformationLine aria-hidden="true" />
            )}
          </span>
          <p className={styles.eyebrow}>Confirmation de contribution</p>
          <h1 id="status-title">{presentation.title}</h1>
          <p>{presentation.message}</p>
          <dl className={styles.statusDetails}>
            <div><dt>Référence</dt><dd>{data.reference}</dd></div>
            <div><dt>Date</dt><dd>{new Date(data.created_at as string).toLocaleString("fr-HT")}</dd></div>
            <div><dt>Fournisseur</dt><dd>{providerLabel(data.provider as string)}</dd></div>
            <div><dt>Montant</dt><dd>{Number(data.amount).toLocaleString("fr-HT")} {data.currency}</dd></div>
            <div><dt>Statut</dt><dd>{presentation.title}</dd></div>
          </dl>
          <p className={styles.receiptNotice}>
            Cette confirmation n’est pas un reçu fiscal ni une attestation de don caritatif.
          </p>
          <Link className={styles.primaryButton} href="/support">
            Retour au soutien
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function statusPresentation(status: string) {
  if (status === "CONFIRMED") {
    return {
      title: "Confirmé",
      message: "Merci pour votre soutien à Planète HMI. Votre contribution a été confirmée.",
      tone: "success",
    };
  }
  if (status === "REJECTED") {
    return {
      title: "Rejeté",
      message:
        "Nous n’avons pas pu confirmer cette transaction. Vérifiez les informations fournies ou contactez l’équipe.",
      tone: "error",
    };
  }
  if (status === "CANCELLED") {
    return {
      title: "Annulé",
      message: "Cette contribution a été annulée.",
      tone: "neutral",
    };
  }
  if (status === "FAILED") {
    return {
      title: "Paiement non abouti",
      message:
        "Le paiement n’a pas pu être préparé ou vérifié. Vous pouvez reprendre le parcours de soutien.",
      tone: "error",
    };
  }
  if (status === "PROCESSING") {
    return {
      title: "Paiement en cours",
      message:
        "Le paiement a été préparé. Finalisez-le sur MonCash ; son statut sera ensuite vérifié automatiquement.",
      tone: "pending",
    };
  }
  return {
    title: "En attente",
    message:
      "Votre confirmation a bien été transmise. Elle sera examinée avant que la contribution soit marquée comme confirmée.",
    tone: "pending",
  };
}

function providerLabel(provider: string): string {
  return {
    moncash: "MonCash",
    natcash: "NatCash",
    paypal: "PayPal",
    mannitoks: "Mannitòks",
    remitly: "Remitly",
    western_union: "Western Union",
    taptap_send: "TapTap Send",
  }[provider] ?? "Autre";
}
