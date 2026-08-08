import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublicPaymentConfiguration } from "@/lib/payments/config";
import { SupportExperience } from "./SupportExperience";
import styles from "./support.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Soutenir Planète HMI",
  description:
    "Participez au développement de Planète HMI avec une contribution volontaire par MonCash, NatCash ou un moyen international disponible.",
  alternates: { canonical: "/support" },
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const configuration = getPublicPaymentConfiguration();
  const { payment } = await searchParams;
  const paymentNotice =
    payment === "verification-error" || payment === "pending" ? payment : null;

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <SupportExperience
          configuration={configuration}
          paymentNotice={paymentNotice}
        />
      </main>
      <SiteFooter />
    </>
  );
}
