"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./AreneTabNav.module.css";

const TABS = [
  { href: "/arene/battles", label: "Battles" },
  { href: "/arene/defis", label: "Défis" },
  { href: "/arene/discussions", label: "Discussions" },
  { href: "/arene/classement-membres", label: "Classement" },
] as const;

/**
 * Navigation par onglets de l'Arène.
 * Cosmic-themed tab bar with glowing active underline.
 * Responsive: horizontal scroll on mobile, centered on desktop.
 * Accessible: ARIA roles, focus-visible outline (2px #65a6ff), 44×44px touch targets.
 */
export function AreneTabNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Navigation de l'arène">
      <ul className={styles.list} role="tablist">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} role="presentation">
              <Link
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className={styles.navBorder} aria-hidden="true" />
    </nav>
  );
}
