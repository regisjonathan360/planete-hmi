"use client";

import { useRef, useEffect } from "react";
import { ArtistesSidebar, SidebarToggleButton, registerSidebarOpener, type ArtistesSidebarHandle } from "./ArtistesSidebar";

interface CategoryItem {
  type: string;
  label: string;
  count: number;
}

interface ArtistesShellProps {
  categories: CategoryItem[];
  activeType: string;
  deceasedCount: number;
  children: React.ReactNode;
}

export function ArtistesShell({ categories, activeType, deceasedCount, children }: ArtistesShellProps) {
  const sidebarRef = useRef<ArtistesSidebarHandle>(null);

  useEffect(() => {
    registerSidebarOpener(() => sidebarRef.current?.open());
  }, []);

  return (
    <div className="wrap artistes-layout">
      <ArtistesSidebar
        ref={sidebarRef}
        categories={categories}
        activeType={activeType}
        deceasedCount={deceasedCount}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

export { SidebarToggleButton };
