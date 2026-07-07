import { redirect } from "next/navigation";

/**
 * Route "/" sur Vercel — redirige vers /charts.
 * La vraie page d'accueil du site est index.html sur GitHub Pages.
 * Ce domaine Vercel sert uniquement le module Classements.
 */
export default function HomePage() {
  redirect("/charts");
}
