"use client";

import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
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

export interface ArtistesSidebarHandle {
  open: () => void;
}

export const ArtistesSidebar = forwardRef<ArtistesSidebarHandle, ArtistesSidebarProps>(
  function ArtistesSidebar({ categories, activeType, deceasedCount }, ref) {
    const [open, setOpen] = useState(false);

    const close = useCallback(() => setOpen(false), []);

    useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

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
      {open && (
        <div className="artistes-sidebar-backdrop" onClick={close} aria-hidden="true" />
      )}

      <aside className={`artistes-sidebar ${open ? "is-open" : ""}`} aria-label="Catégories d'artistes">
        <button type="button" className="artistes-sidebar-close" aria-label="Fermer le menu" onClick={close}>
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
                <span style={{
                  fontSize: "0.7rem",
                  opacity: 0.6,
                  background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
                  padding: "0.1rem 0.4rem",
                  borderRadius: 999,
                }}>
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
});

/* ── Toggle button (renders in toolbar) ──────────────────────────── */

let _openSidebar: (() => void) | null = null;

export function registerSidebarOpener(fn: () => void) {
  _openSidebar = fn;
}

export function SidebarToggleButton() {
  const handleClick = useCallback(() => {
    _openSidebar?.();
  }, []);

  return (
    <button
      type="button"
      className="artistes-sidebar-toggle"
      aria-label="Ouvrir le menu des catégories"
      onClick={handleClick}
    >
      <svg viewBox="0 0 28 24" width="26" height="22" fill="#ffd54f" className="artistes-sidebar-toggle-icon">
        <circle cx="6" cy="6.5" r="2.5" />
        <path d="M2 15.5c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5v1.5H2v-1.5z" />
        <circle cx="14" cy="5" r="3.2" />
        <path d="M8.5 16c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5v1.5H8.5V16z" />
        <circle cx="22" cy="6.5" r="2.5" />
        <path d="M18 15.5c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5v1.5H18v-1.5z" />
      </svg>
    </button>
  );
}