import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsButton } from "@/components/CookieSettingsButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Politique des cookies",
  description:
    "Informations sur les cookies, le stockage local et les traceurs utilisés par Planète HMI.",
  alternates: { canonical: "/cookies" },
};

export default function CookiePolicyPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <div className="legal-page__wrap">
          <h1 className="legal-page__title">Politique des cookies</h1>
          <p className="legal-page__updated">Dernière mise à jour : août 2026</p>

          <section>
            <h2>1. Notre approche</h2>
            <p>
              Planète HMI limite les cookies et autres traceurs au strict nécessaire.
              Aucun cookie publicitaire n’est utilisé et nous ne vendons pas vos données.
              Les fonctions facultatives ne sont activées qu’après votre choix.
            </p>
          </section>

          <section>
            <h2>2. Cookies et stockages essentiels</h2>
            <p>Ces éléments permettent au site de fonctionner ou répondent à une action que vous demandez.</p>
            <ul>
              <li>
                <strong>Session Supabase :</strong> maintient votre connexion et protège l’accès à votre compte.
                Sa durée dépend de la session d’authentification.
              </li>
              <li>
                <strong>phmi_tiktok_oauth_state et phmi_claim_artist_id :</strong> protègent temporairement
                la connexion TikTok contre les requêtes frauduleuses. Ils expirent après 10 minutes.
              </li>
              <li>
                <strong>planete-hmi-cookie-consent :</strong> conserve votre accord ou votre refus pendant six mois.
              </li>
              <li>
                <strong>hmi:favoris :</strong> conserve sur votre appareil les artistes que vous ajoutez aux favoris,
                jusqu’à leur suppression ou à l’effacement des données du site.
              </li>
              <li>
                <strong>planete-hmi-donation-prompt-opt-out :</strong> mémorise votre demande de ne plus afficher
                l’appel au soutien, jusqu’à l’effacement des données du site.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Mesure d’audience facultative</h2>
            <p>
              Avec votre accord, Vercel Web Analytics mesure les pages consultées, le pays,
              le type d’appareil, le système et le navigateur. Vercel indique que ce service
              n’utilise pas de cookies et produit des statistiques agrégées. Planète HMI
              retire les paramètres d’URL et exclut les espaces privés, l’administration,
              l’authentification et les pages de suivi des contributions.
            </p>
          </section>

          <section>
            <h2>4. Services externes demandés par l’utilisateur</h2>
            <p>
              Les boutons PayPal et MonCash ainsi que les connexions TikTok ou d’autres
              plateformes ne sont chargés ou ouverts que lorsque vous utilisez la fonction
              correspondante. Ces prestataires peuvent alors appliquer leurs propres cookies
              et politiques de confidentialité sur leurs domaines.
            </p>
          </section>

          <section>
            <h2>5. Modifier ou retirer votre choix</h2>
            <p>
              Vous pouvez accepter ou refuser la mesure d’audience avec la même facilité.
              Votre choix reste valable six mois et peut être modifié à tout moment :
            </p>
            <p><CookieSettingsButton /></p>
            <p>
              Vous pouvez aussi supprimer les cookies et données locales depuis les réglages
              de votre navigateur. Le refus de la mesure d’audience ne limite pas l’accès au site.
            </p>
          </section>

          <section>
            <h2>6. Contact</h2>
            <p>
              Pour toute question : <strong>contact@planete-hmi.com</strong>. Consultez aussi notre {" "}
              <Link href="/privacy">politique de confidentialité</Link>.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
