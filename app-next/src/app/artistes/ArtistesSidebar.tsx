"use client";

import { useState, useCallback, useEffect } from "react";
import { HaitiShapeButton } from "@/components/HaitiMap/HaitiShapeButton";
import { EtoilesEteintesLink } from "@/components/EtoilesEteintes/EtoilesEteintesLink";

interface CategoryItem {
  type: string;
  label: string;
  count: number;
}

interface ArtistesSidebarProps {
  categories: CategoryItem[];
  activeType: string;
  deceasedCount: number;
}

export function ArtistesSidebar({
  categories,
  activeType,
  deceasedCount,
}: ArtistesSidebarProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <>
      {/* Mobile toggle — visible only on mobile via CSS */}
      <button
        type="button"
        className="artistes-sidebar-toggle"
        aria-label="Ouvrir le menu des catégories"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="artistes-sidebar-backdrop"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`artistes-sidebar ${open ? "is-open" : ""}`}
        aria-label="Catégories d'artistes"
      >
        {/* Close button — mobile only */}
        <button
          type="button"
          className="artistes-sidebar-close"
          aria-label="Fermer le menu"
          onClick={close}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <HaitiShapeButton />

        <nav className="artistes-sidebar__nav" aria-label="Catégories d'artistes">
          {categories.map((cat) => {
            const isActive = cat.type === activeType;
            return (
              <a
                key={cat.type || "all"}
                href={cat.type ? `/artistes?type=${cat.type}` : "/artistes"}
                aria-current={isActive ? "page" : undefined}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.55rem 0.8rem",
                  borderRadius: 8,
                  fontSize: "0.82rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#f4efe4" : "#9a9ac0",
                  textDecoration: "none",
                  background: isActive ? "rgba(124,92,255,0.22)" : "rgba(20,20,42,0.5)",
                  border: `1px solid ${isActive ? "rgba(124,92,255,0.6)" : "transparent"}`,
                  transition: "all 0.15s",
                }}
              >
                <span>{cat.label}</span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.6,
                    background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: 999,
                  }}
                >
                  {cat.count}
                </span>
              </a>
            );
          })}
        </nav>

        <EtoilesEteintesLink count={deceasedCount} />
      </aside>
    </>
  );
}
