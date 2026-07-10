import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Planète HMI",
  description: "Conditions générales d'utilisation de la plateforme Planète HMI.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
      <div className="legal-page__wrap">
        <h1 className="legal-page__title">Conditions d&apos;utilisation</h1>
        <p className="legal-page__updated">Dernière mise à jour : juillet 2025</p>

        <section>
          <h2>1. Présentation du service</h2>
          <p>
            Planète HMI est une plateforme web dédiée à la promotion et au suivi de la musique
            haïtienne. Elle propose des classements musicaux, des profils d'artistes, des tendances
            TikTok et Audiomack, ainsi qu'une section de vidéos courtes (HMI Shorts).
          </p>
          <p>
            L'accès au site est gratuit et ouvert à tous. Aucune inscription n'est requise pour
            consulter les classements et contenus publics.
          </p>
        </section>

        <section>
          <h2>2. Classements musicaux</h2>
          <p>
            Les classements présentés sur Planète HMI sont produits à partir de données publiques
            collectées via des API officielles (TikTok Research API, Audiomack API, etc.).
          </p>
          <ul>
            <li>Les classements reflètent des tendances basées sur des métriques publiques (nombre de publications, vues, likes, partages)</li>
            <li>Ils sont calculés selon un algorithme propriétaire utilisant un score composite pondéré</li>
            <li>Les positions peuvent varier d'une semaine à l'autre selon l'activité réelle sur les plateformes</li>
            <li>Planète HMI ne garantit pas l'exactitude absolue des données en temps réel</li>
          </ul>
        </section>

        <section>
          <h2>3. Contenus musicaux et droits d&apos;auteur</h2>
          <p>
            Planète HMI ne stocke ni ne diffuse de fichiers audio ou vidéo. Le site référence
            uniquement des métadonnées publiques (titres, artistes, statistiques) et peut inclure
            des liens vers les plateformes d'origine (TikTok, Audiomack, YouTube, Spotify, etc.).
          </p>
          <p>
            Les droits sur les œuvres musicales appartiennent à leurs créateurs et ayants droit
            respectifs. Si vous êtes titulaire de droits et souhaitez signaler un contenu,
            contactez-nous.
          </p>
        </section>

        <section>
          <h2>4. Liens externes</h2>
          <p>
            Planète HMI peut contenir des liens vers des sites et plateformes externes (TikTok,
            Audiomack, YouTube, Spotify, Apple Music, etc.). Ces liens sont fournis à titre
            informatif.
          </p>
          <p>
            Planète HMI n'est pas responsable du contenu, des pratiques de confidentialité ou de
            la disponibilité de ces sites externes. L'utilisation de ces plateformes est soumise
            à leurs propres conditions d'utilisation.
          </p>
        </section>

        <section>
          <h2>5. Données publiques</h2>
          <p>
            Les données affichées sur Planète HMI proviennent de sources publiques. Cela inclut :
          </p>
          <ul>
            <li>Les statistiques publiques de vidéos TikTok (vues, likes, partages)</li>
            <li>Les classements publics Audiomack</li>
            <li>Les noms d'artistes et titres de chansons publiquement disponibles</li>
            <li>Le nombre de publications (vidéos) utilisant un son donné</li>
          </ul>
          <p>
            Pour plus de détails sur notre collecte de données, consultez notre{" "}
            <a href="/privacy">politique de confidentialité</a>.
          </p>
        </section>

        <section>
          <h2>6. Responsabilités de l&apos;utilisateur</h2>
          <p>En utilisant Planète HMI, vous acceptez de :</p>
          <ul>
            <li>Ne pas utiliser le site à des fins illégales ou frauduleuses</li>
            <li>Ne pas tenter d'accéder aux zones d'administration sans autorisation</li>
            <li>Ne pas reproduire ou redistribuer massivement les données des classements sans autorisation</li>
            <li>Ne pas surcharger le site par des requêtes automatisées excessives (scraping)</li>
            <li>Respecter les droits des artistes et créateurs référencés sur la plateforme</li>
          </ul>
        </section>

        <section>
          <h2>7. Limitation de responsabilité</h2>
          <p>
            Planète HMI est fourni « en l'état ». Nous ne garantissons pas que le service sera
            disponible de manière ininterrompue ou exempt d'erreurs. Les classements et données
            sont fournis à titre informatif et ne constituent pas un avis professionnel.
          </p>
          <p>
            Planète HMI ne saurait être tenu responsable de pertes ou dommages résultant de
            l'utilisation du site ou de l'impossibilité d'y accéder.
          </p>
        </section>

        <section>
          <h2>8. Modifications des conditions</h2>
          <p>
            Planète HMI se réserve le droit de modifier ces conditions à tout moment. Les
            modifications prennent effet dès leur publication sur cette page. La date de dernière
            mise à jour est indiquée en haut du document.
          </p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>
            Pour toute question relative à ces conditions d'utilisation, vous pouvez nous
            contacter par email : <strong>contact@planete-hmi.com</strong>
          </p>
        </section>
      </div>
      </main>
    </>
  );
}
