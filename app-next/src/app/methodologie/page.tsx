import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Méthodologie", description: "Comment Planète HMI collecte, vérifie et publie ses données." };

export default function MethodologyPage() {
  return <><SiteHeader /><main className="info-page"><div className="info-page__wrap">
    <p className="info-page__eyebrow">Transparence des données</p><h1>Notre méthodologie</h1>
    <p className="info-page__lead">Les données affichées sur Planète HMI sont contextualisées : nous précisons la source, la période, le territoire et ce que chaque indicateur mesure réellement.</p>
    <section className="info-page__section"><h2>1. Collecte</h2><p>Nous utilisons les sources disponibles des plateformes musicales, des imports administratifs contrôlés et des informations publiques fournies par les artistes ou leurs équipes. Une donnée indisponible n’est jamais remplacée par une valeur inventée.</p></section>
    <section className="info-page__section"><h2>2. Vérification et éligibilité</h2><p>Avant publication, les entrées sont examinées selon la plateforme et le classement concerné. Les artistes exclus par décision éditoriale ne sont ni recollectés ni comptés dans les totaux, jusqu’à leur réintégration explicite.</p></section>
    <section className="info-page__section"><h2>3. Calcul des classements</h2><p>Chaque classement conserve sa propre règle : position source, nouvelles vues, popularité territoriale ou autre métrique clairement identifiée. Les performances de plateformes différentes ne sont pas additionnées comme si elles étaient identiques.</p></section>
    <section className="info-page__section"><h2>4. Publication et corrections</h2><p>Les classements sont publiés par période et peuvent être corrigés si une source est mise à jour, si une erreur est confirmée ou si une décision éditoriale doit être revue. Les anciennes publications servent de trace de référence.</p></section>
    <section className="info-page__callout"><h2>Méthodologie détaillée des classements</h2><p>Consultez les règles propres à chaque plateforme, les métriques utilisées et les limites connues.</p><Link className="btn btn-primary" href="/charts/methodology">Voir la méthodologie des classements</Link></section>
  </div></main><SiteFooter /></>;
}
