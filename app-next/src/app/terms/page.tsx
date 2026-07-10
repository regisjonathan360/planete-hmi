import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Conditions d'utilisation - Planète HMI",
  description: "Conditions générales d'utilisation de la plateforme Planète HMI.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap">
          <h1 className="legal-page__title">Conditions d&apos;utilisation</h1>
          <p className="legal-page__updated">Dernière mise à jour : juillet 2026</p>

          <section>
            <h2>1. Service</h2>
            <p>
              Planète HMI présente des artistes, classements, actualités et tendances de la
              musique haïtienne. La consultation des contenus publics est gratuite. Certaines
              fonctions, dont l&apos;espace artiste, nécessitent un compte.
            </p>
          </section>

          <section>
            <h2>2. Compte artiste</h2>
            <p>
              Vous devez fournir des informations exactes, protéger l&apos;accès à votre compte et
              nous signaler toute utilisation non autorisée. Revendiquer une fiche ne garantit
              pas son approbation : Planète HMI peut vérifier le rattachement avant de le valider.
            </p>
            <p>
              Vous ne pouvez pas revendiquer l&apos;identité ou le compte social d&apos;une autre personne
              sans autorisation.
            </p>
          </section>

          <section>
            <h2>3. Connexion TikTok</h2>
            <p>
              La connexion TikTok repose sur le consentement affiché par TikTok. Planète HMI
              accède uniquement aux données correspondant aux autorisations effectivement
              accordées. Vous pouvez retirer la connexion depuis votre espace artiste ou depuis
              les réglages TikTok.
            </p>
            <p>
              Une autorisation retirée, expirée ou limitée peut interrompre la synchronisation.
              Planète HMI peut demander une nouvelle connexion pour continuer le service.
            </p>
            <p>
              Lorsque vous retirez la connexion, Planète HMI supprime les jetons, les données
              de connexion et les relevés associés. Vous pouvez également demander la
              suppression totale de vos données en nous contactant.
            </p>
          </section>

          <section>
            <h2>4. Classements et statistiques</h2>
            <p>
              Les statistiques correspondent aux valeurs disponibles au moment de chaque relevé.
              Elles peuvent évoluer, être retardées, arrondies ou corrigées par la plateforme
              source. Planète HMI ne garantit donc pas une exactitude absolue en temps réel.
            </p>
            <p>
              Les classements Planète HMI sont des résultats éditoriaux fondés sur des sources,
              règles de validation et méthodes de calcul propres au service. Ils ne constituent
              pas une certification officielle de TikTok ou d&apos;une autre plateforme.
            </p>
          </section>

          <section>
            <h2>5. Contenus et droits</h2>
            <p>
              Les droits sur les œuvres, vidéos, marques et profils appartiennent à leurs
              titulaires respectifs. Les liens et lecteurs externes renvoient vers les plateformes
              d&apos;origine et restent soumis à leurs propres conditions.
            </p>
            <p>
              Pour signaler une erreur, une usurpation ou un contenu portant atteinte à vos droits,
              contactez Planète HMI avec les éléments permettant d&apos;examiner la demande.
            </p>
          </section>

          <section>
            <h2>6. Utilisations interdites</h2>
            <p>Vous acceptez de ne pas :</p>
            <ul>
              <li>utiliser le service à des fins illégales ou frauduleuses ;</li>
              <li>contourner les contrôles d&apos;accès ou tenter d&apos;obtenir des secrets ;</li>
              <li>surcharger le site par des requêtes automatisées excessives ;</li>
              <li>redistribuer massivement les données sans autorisation ;</li>
              <li>porter atteinte aux artistes, créateurs ou autres utilisateurs.</li>
            </ul>
          </section>

          <section>
            <h2>7. Disponibilité et responsabilité</h2>
            <p>
              Le service est fourni en l&apos;état. Des interruptions, changements d&apos;API ou erreurs
              de données peuvent survenir. Dans les limites applicables, Planète HMI ne peut être
              tenu responsable d&apos;une décision prise uniquement à partir d&apos;un classement ou
              d&apos;une statistique affichée sur le site.
            </p>
          </section>

          <section>
            <h2>8. Modifications</h2>
            <p>
              Ces conditions peuvent être modifiées pour refléter l&apos;évolution du service. La
              version publiée sur cette page et sa date de mise à jour sont celles applicables.
            </p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>
              Pour toute question : <strong>contact@planete-hmi.com</strong>
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
