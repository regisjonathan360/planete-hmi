import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Planète HMI",
  description: "Informations sur la collecte et l'utilisation des données par Planète HMI.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
      <div className="legal-page__wrap">
        <h1 className="legal-page__title">Politique de confidentialité</h1>
        <p className="legal-page__updated">Dernière mise à jour : juillet 2025</p>

        <section>
          <h2>1. Introduction</h2>
          <p>
            Planète HMI est une plateforme dédiée à la musique haïtienne. Elle agrège des données
            publiques liées aux artistes, sons, classements et tendances musicales provenant de
            plateformes tierces telles que TikTok, Audiomack, YouTube, Spotify et Apple Music.
          </p>
          <p>
            Cette politique explique quelles données sont collectées, comment elles sont utilisées,
            et les droits dont vous disposez.
          </p>
        </section>

        <section>
          <h2>2. Données collectées</h2>
          <h3>Données publiques de plateformes tierces</h3>
          <p>Planète HMI collecte exclusivement des données accessibles publiquement :</p>
          <ul>
            <li>Noms d'artistes, titres de sons et métadonnées musicales</li>
            <li>Statistiques publiques : nombre de vues, likes, partages, commentaires</li>
            <li>Classements et tendances publics (TikTok, Audiomack, etc.)</li>
            <li>Noms d'utilisateur publics associés à des vidéos TikTok</li>
            <li>Hashtags et descriptions de vidéos publiques</li>
          </ul>

          <h3>Ce que nous ne collectons PAS</h3>
          <ul>
            <li>Mots de passe TikTok, Audiomack ou de toute autre plateforme</li>
            <li>Messages privés ou conversations directes</li>
            <li>Données personnelles sensibles (adresse, téléphone, données bancaires)</li>
            <li>Contenu de comptes privés ou protégés</li>
            <li>Données de géolocalisation précise des utilisateurs</li>
          </ul>
        </section>

        <section>
          <h2>3. Utilisation des données</h2>
          <p>Les données publiques collectées sont utilisées pour :</p>
          <ul>
            <li>Produire des classements musicaux (Top TikTok Haiti, Audiomack Weekly 100, etc.)</li>
            <li>Identifier les tendances de la musique haïtienne</li>
            <li>Mettre en avant les artistes et créateurs haïtiens</li>
            <li>Alimenter la section « HMI Shorts » sur la page d'accueil</li>
          </ul>
        </section>

        <section>
          <h2>4. Sources des données</h2>
          <p>Les données sont obtenues via :</p>
          <ul>
            <li>L'API TikTok Research (accès officiel approuvé par TikTok)</li>
            <li>L'API Audiomack</li>
            <li>Des sources publiques de classements musicaux</li>
          </ul>
          <p>
            Aucun scraping non autorisé n'est pratiqué. Toutes les données sont obtenues dans le
            respect des conditions d'utilisation des plateformes sources.
          </p>
        </section>

        <section>
          <h2>5. Conservation des données</h2>
          <p>
            Les données de classement sont conservées à des fins historiques et analytiques.
            Les données de vidéos individuelles sont mises à jour régulièrement et les anciennes
            données peuvent être supprimées après une période raisonnable.
          </p>
        </section>

        <section>
          <h2>6. Cookies et navigation</h2>
          <p>
            Planète HMI peut utiliser des cookies techniques nécessaires au fonctionnement du site
            (session d'administration). Aucun cookie de tracking publicitaire n'est utilisé pour
            les visiteurs publics.
          </p>
        </section>

        <section>
          <h2>7. Droits des utilisateurs</h2>
          <p>
            Si vous êtes un artiste ou un utilisateur dont les données publiques apparaissent sur
            Planète HMI et souhaitez demander une correction ou un retrait, contactez-nous à
            l'adresse indiquée ci-dessous.
          </p>
        </section>

        <section>
          <h2>8. Contact</h2>
          <p>
            Pour toute question relative à cette politique de confidentialité, vous pouvez nous
            contacter par email : <strong>contact@planete-hmi.com</strong>
          </p>
        </section>
      </div>
      </main>
    </>
  );
}
