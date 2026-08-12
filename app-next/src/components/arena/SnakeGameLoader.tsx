"use client";

import dynamic from "next/dynamic";
import styles from "@/app/arene/serpent/page.module.css";

const Snake2DGame = dynamic(
  () => import("./Snake2DGame").then((m) => m.Snake2DGame),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading} role="status">
        Chargement de l&apos;arène…
      </div>
    ),
  }
);

export function SnakeGameLoader() {
  return <Snake2DGame />;
}