"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { IconType } from "react-icons";
import {
  FaApple,
  FaBroadcastTower,
  FaCalendarAlt,
  FaChartBar,
  FaChartLine,
  FaClone,
  FaFileAlt,
  FaGamepad,
  FaHome,
  FaMusic,
  FaNewspaper,
  FaSignOutAlt,
  FaTiktok,
  FaUserFriends,
  FaUsers,
  FaVideo,
  FaYoutube,
} from "react-icons/fa";
import { SiAudiomack, SiDeezer, SiSpotify } from "react-icons/si";

type AdminNavItem = {
  href: string;
  label: string;
  active: string;
  icon: IconType;
  external?: boolean;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/admin", label: "Tableau de bord", active: "home", icon: FaChartLine },
      { href: "/admin/accueil", label: "Page d'accueil", active: "accueil", icon: FaHome },
      { href: "/admin/radio", label: "Radio", active: "radio", icon: FaBroadcastTower },
      { href: "/charts", label: "Voir les classements publics", active: "", icon: FaChartBar, external: true },
    ],
  },
  {
    label: "Contenu",
    items: [
      { href: "/admin/actualites", label: "Actualités", active: "actualites", icon: FaNewspaper },
      { href: "/admin/evenements", label: "Événements", active: "evenements", icon: FaCalendarAlt },
      { href: "/admin/shorts", label: "HMI Shorts", active: "shorts", icon: FaVideo },
      { href: "/admin/contributions", label: "Contributions", active: "contributions", icon: FaFileAlt },
    ],
  },
  {
    label: "Artistes et catalogue",
    items: [
      { href: "/admin/artistes", label: "Artistes", active: "artistes", icon: FaUsers },
      { href: "/admin/producteurs", label: "Producteurs", active: "producteurs", icon: FaUserFriends },
      { href: "/admin/labels", label: "Labels", active: "labels", icon: FaMusic },
      { href: "/admin/doublons", label: "Doublons à traiter", active: "doublons", icon: FaClone },
    ],
  },
  {
    label: "Plateformes et classements",
    items: [
      { href: "/admin/audiomack", label: "Audiomack", active: "audiomack", icon: SiAudiomack },
      { href: "/admin/spotify", label: "Spotify", active: "spotify", icon: SiSpotify },
      { href: "/admin/deezer", label: "Deezer", active: "deezer", icon: SiDeezer },
      { href: "/admin/apple-music", label: "Apple Music", active: "apple-music", icon: FaApple },
      { href: "/admin/youtube", label: "YouTube", active: "youtube", icon: FaYoutube },
      { href: "/admin/tiktok", label: "TikTok", active: "tiktok", icon: FaTiktok },
    ],
  },
  {
    label: "Communauté",
    items: [
      { href: "/admin/arene", label: "Arène", active: "arene", icon: FaGamepad },
    ],
  },
];

export function AdminHeader({ email, active }: { email: string | null; active?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/admin/login");
  }

  return (
    <>
      <button
        type="button"
        className="admin__menu-toggle"
        aria-label={isOpen ? "Fermer le menu d'administration" : "Ouvrir le menu d'administration"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>
      {isOpen && <button type="button" className="admin__scrim" aria-label="Fermer le menu" onClick={() => setIsOpen(false)} />}

      <aside className={`admin__header ${isOpen ? "is-open" : ""}`} aria-label="Navigation d'administration">
        <div className="admin__sidebar-top">
          <Link href="/admin" className="admin__brand" onClick={() => setIsOpen(false)}>
            <span className="admin__brand-mark">H</span>
            <span>
              Planète <strong>HMI</strong>
              <small>Administration</small>
            </span>
          </Link>
          <button type="button" className="admin__sidebar-close" onClick={() => setIsOpen(false)} aria-label="Fermer le menu">
            ×
          </button>
        </div>

        <nav className="admin__nav">
          {NAV_GROUPS.map((group) => (
            <div className="admin__nav-group" key={group.label}>
              <p className="admin__nav-label">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.active !== "" && active === item.active;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin__nav-link ${isActive ? "is-active" : ""}`}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    onClick={() => setIsOpen(false)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.external && <span className="admin__external-mark" aria-hidden="true">↗</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin__sidebar-footer">
          {email && <span className="admin__email" title={email}>{email}</span>}
          <button type="button" className="admin__logout" onClick={logout}>
            <FaSignOutAlt aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
