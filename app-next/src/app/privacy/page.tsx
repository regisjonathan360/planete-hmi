import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Politique de confidentialité - Planète HMI",
  description: "Informations sur la collecte et l'utilisation des données par Planète HMI.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap">
          <h1 className="legal-page__title">Politique de confidentialité</h1>
          <p className="legal-page__updated">Dernière mise à jour : juillet 2026</p>

          <section>
            <h2>1. Présentation</h2>
            <p>
              Planète HMI est une plateforme consacrée à la musique haïtienne, aux artistes,
              aux classements et aux tendances musicales. Cette politique décrit les données
              traitées lorsque vous consultez le site ou utilisez un compte artiste.
            </p>
          </section>

          <section>
            <h2>2. Compte Planète HMI</h2>
            <p>Lors de la création d&apos;un compte artiste, nous traitons :</p>
            <ul>
              <li>votre adresse e-mail et votre nom d&apos;artiste ;</li>
              <li>les informations techniques nécessaires à votre session sécurisée ;</li>
              <li>la fiche artiste que vous demandez à revendiquer et son statut de validation.</li>
            </ul>
            <p>
              Le mot de passe est géré par notre service d&apos;authentification et n&apos;est jamais
              accessible en clair par Planète HMI.
            </p>
          </section>

          <section>
            <h2>3. Connexion TikTok</h2>
            <p>
              La connexion TikTok est facultative. TikTok affiche les autorisations demandées
              avant que vous les acceptiez. Selon les autorisations accordées, Planète HMI peut
              recevoir :
            </p>
            <ul>
              <li>votre identifiant TikTok, nom public, avatar, biographie et lien de profil ;</li>
              <li>votre statut vérifié et vos statistiques publiques de profil ;</li>
              <li>vos vidéos publiques accessibles par Display API ;</li>
              <li>les vues, likes, commentaires et partages de ces vidéos ;</li>
              <li>les autorisations accordées et les dates de synchronisation.</li>
            </ul>
            <p>
              Planète HMI ne reçoit jamais votre mot de passe TikTok, vos messages privés ou le
              contenu de vidéos privées. Les jetons d&apos;accès et de renouvellement sont chiffrés
              avant leur stockage et ne sont jamais envoyés au navigateur.
            </p>
          </section>

          <section>
            <h2>4. Utilisation des données</h2>
            <p>Ces données servent à :</p>
            <ul>
              <li>vérifier que vous contrôlez le compte TikTok relié ;</li>
              <li>présenter vos statistiques dans votre espace artiste ;</li>
              <li>mesurer l&apos;évolution de vos vidéos au moyen de relevés datés ;</li>
              <li>produire des classements et analyses éditoriales Planète HMI ;</li>
              <li>sécuriser le service et traiter les demandes de correction.</li>
            </ul>
          </section>

          <section>
            <h2>5. Sources et prestataires</h2>
            <p>
              Les données des comptes consentants sont obtenues par TikTok Login Kit et Display
              API. Planète HMI peut aussi utiliser des API officielles, des données publiques ou
              des imports administratifs vérifiés pour les autres plateformes musicales.
            </p>
            <p>
              Supabase fournit l&apos;authentification et la base de données. Vercel fournit
              l&apos;hébergement de l&apos;application. Nous ne vendons pas vos données personnelles.
            </p>
          </section>

          <section>
            <h2>6. Conservation et suppression</h2>
            <p>
              Les jetons d&apos;accès TikTok sont conservés tant que la connexion est active. Les
              relevés statistiques (vues, likes, commentaires) sont conservés jusqu&apos;à 24 mois
              pour permettre l&apos;historique des tendances, sauf demande contraire.
            </p>
            <p>
              Lorsque vous retirez TikTok depuis votre espace artiste, Planète HMI :
            </p>
            <ul>
              <li>révoque l&apos;autorisation auprès de TikTok ;</li>
              <li>supprime localement les jetons chiffrés ;</li>
              <li>supprime la connexion et les relevés statistiques associés.</li>
            </ul>
            <p>
              Vous pouvez également demander la suppression complète de votre compte et de
              toutes les données associées en contactant <strong>contact@planete-hmi.com</strong>.
              Nous traitons les demandes de suppression dans un délai de 30 jours.
            </p>
            <p>
              Si TikTok nous notifie une révocation d&apos;accès via son callback, nous supprimons
              automatiquement les jetons et la connexion concernés.
            </p>
          </section>

          <section>
            <h2>7. Partage de données</h2>
            <p>
              Planète HMI ne vend, ne loue et ne partage pas vos données personnelles ou
              données TikTok avec des tiers à des fins commerciales. Les données sont
              uniquement partagées avec :
            </p>
            <ul>
              <li>nos prestataires techniques (Supabase, Vercel) pour le fonctionnement du service ;</li>
              <li>les autorités compétentes si la loi l&apos;exige.</li>
            </ul>
            <p>
              Les classements publiés sur le site sont des résultats agrégés et anonymisés qui
              ne révèlent pas de données personnelles au-delà du nom public et des statistiques
              déjà publiques sur TikTok.
            </p>
          </section>

          <section>
            <h2>8. Vos droits</h2>
            <p>Vous pouvez à tout moment :</p>
            <ul>
              <li>accéder aux données que nous détenons sur vous ;</li>
              <li>demander la correction d&apos;informations inexactes ;</li>
              <li>demander la suppression de vos données personnelles ;</li>
              <li>retirer votre consentement à la connexion TikTok ;</li>
              <li>refuser tout traitement non essentiel.</li>
            </ul>
            <p>
              Pour exercer ces droits : <strong>contact@planete-hmi.com</strong>. Nous répondons
              dans un délai de 30 jours.
            </p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>
              Pour toute question ou demande relative à vos données : {" "}
              <strong>contact@planete-hmi.com</strong>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
