"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/arene/battles", label: "Battles" },
  { href: "/admin/arene/defis", label: "Défis" },
  { href: "/admin/arene/moderation", label: "Modération" },
  { href: "/admin/arene/badges", label: "Badges" },
  { href: "/admin/arene/solitaire", label: "Solitaire" },
  { href: "/admin/arene/termes-interdits", label: "Termes interdits" },
];

export function AreneAdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="admin-card"
      style={{ minWidth: "180px", padding: "0.75rem", flexShrink: 0 }}
    >
      <p
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--admin-accent-2)",
          margin: "0 0 0.6rem",
        }}
      >
        Arène
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                style={{
                  display: "block",
                  padding: "0.45rem 0.6rem",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  color: isActive ? "var(--admin-text)" : "var(--admin-muted)",
                  background: isActive ? "var(--admin-panel-2)" : "transparent",
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
