import { StaticPage } from "@/components/StaticPage";
import { BoutiqueDevelopmentOverlay } from "@/components/BoutiqueDevelopmentOverlay";
import styles from "./boutique-development.module.css";

export default function BoutiquePage() {
  return (
    <div className={styles.page}>
      <div className={styles.preview} inert aria-hidden="true">
        <StaticPage filename="boutique.html" />
      </div>
      <BoutiqueDevelopmentOverlay />
    </div>
  );
}
