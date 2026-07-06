import Link from "next/link";

export const dynamic = "force-static";

const PLATEFORMES = [
  {
    nom: "YouTube Music — Haïti",
    mesure: "Chansons présentes dans le classement officiel YouTube Music pour Haïti.",
    territoire: "Haïti",
    metrique: "Position (import vérifié) ; un classement distinct « YouTube HMI » mesure les vues mondiales gagnées en 7 jours.",
    methode: "Import administratif vérifié (API officielle en préparation).",
  },
  {
    nom: "Spotify — Populaire en Haïti",
    mesure: "Popularité territoriale en Haïti.",
    territoire: "Haïti",
    metrique: "Position. La Web API sert uniquement à enrichir les métadonnées ; aucun nombre de streams n'est fabriqué.",
    methode: "Import administratif vérifié.",
  },
  {
    nom: "Audiomack — Weekly 100 Haiti",
    mesure: "Chansons les plus performantes sur Audiomack pour la région Haïti.",
    territoire: "Haïti",
    metrique: "Position. Le classement hebdomadaire global n'est jamais présenté comme Haïti.",
    methode: "Import administratif vérifié (flux partenaire possible ultérieurement).",
  },
  {
    nom: "Apple Music — Haïti / HMI Worldwide",
    mesure: "Chart Apple Music du storefront Haïti si disponible, sinon présence internationale des artistes haïtiens (Worldwide).",
    territoire: "Haïti ou International (précisé selon la source réelle).",
    metrique: "Position via l'API officielle Apple Music.",
    methode: "API officielle (test du storefront ht, sans bascule silencieuse).",
  },
  {
    nom: "TikTok — Sons populaires en Haïti",
    mesure: "Sons les plus utilisés dans les publications en Haïti.",
    territoire: "Haïti",
    metrique: "Nombre de publications utilisant un son — jamais présenté comme des streams ou des vues.",
    methode: "Import administratif vérifié (accès partenaire/officiel en préparation).",
  },
];

export default function MethodologyPage() {
  return (
    <>
      <p className="hmi__meta">
        <Link className="hmi__link" href="/charts">← Tous les classements</Link>
      </p>
      <h1 className="hmi__title">Méthodologie</h1>
      <p className="hmi__lead">
        Chaque classement indique clairement sa plateforme source, le territoire
        ou contexte mesuré, et sa méthode de collecte.
      </p>

      {PLATEFORMES.map((p) => (
        <section className="row" key={p.nom}>
          <h2 className="row__name">{p.nom}</h2>
          <ul style={{ color: "var(--cream-dim)", lineHeight: 1.7 }}>
            <li><strong>Ce que ça mesure :</strong> {p.mesure}</li>
            <li><strong>Territoire / contexte :</strong> {p.territoire}</li>
            <li><strong>Métrique :</strong> {p.metrique}</li>
            <li><strong>Méthode d’acquisition :</strong> {p.methode}</li>
            <li><strong>Éligibilité :</strong> au moins un artiste principal (primary/co-primary) haïtien vérifié.</li>
          </ul>
        </section>
      ))}

      <section className="row">
        <p className="empty">
          Planète HMI est un service indépendant consacré à la musique haïtienne.
          Les marques et plateformes mentionnées appartiennent à leurs propriétaires
          respectifs. Planète HMI n’est ni affilié, ni sponsorisé, ni approuvé par
          ces plateformes, sauf mention expresse d’un partenariat.
        </p>
      </section>
    </>
  );
}
