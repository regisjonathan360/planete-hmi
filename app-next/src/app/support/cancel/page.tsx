import type { Metadata } from "next";
import Link from "next/link";
import { RiArrowLeftLine } from "react-icons/ri";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "../support.module.css";

export const metadata: Metadata = {
  title: "Contribution annulée",
  robots: { index: false, follow: false },
};

export default function SupportCancelPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.statusResult}>
          <p className={styles.eyebrow}>Contribution volontaire</p>
          <h1>Opération annulée</h1>
          <p>Aucune contribution n’a été confirmée. Vous pouvez reprendre lorsque vous le souhaitez.</p>
          <Link className={styles.primaryButton} href="/support">
            <RiArrowLeftLine aria-hidden="true" /> Retour
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
