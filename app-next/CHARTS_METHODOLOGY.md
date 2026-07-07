# Méthodologie des Classements Planète HMI

## YouTube Music — Haïti
- **Mesure** : chansons présentes dans le classement officiel YouTube Music pour Haïti.
- **Territoire** : Haïti.
- **Métrique** : position (import vérifié). Un classement distinct « YouTube HMI — Vues gagnées en 7 jours » mesure les vues mondiales sur une liste blanche de vidéos officielles (Data API).
- **Méthode** : import administratif vérifié (territorial) ; API officielle (mode vues mondiales).
- **Limites** : le classement `mostPopular` de la Data API n'est pas identique à YouTube Music Charts Haïti et n'est donc pas utilisé comme tel.

## Spotify — Populaire en Haïti
- **Mesure** : popularité territoriale en Haïti.
- **Territoire** : Haïti.
- **Métrique** : position. Aucun nombre de streams n'est fabriqué par Planète HMI.
- **Méthode** : import administratif vérifié. La Web API sert uniquement à enrichir les métadonnées (ISRC, pochette, lien).
- **Règles d'affichage** : pochette non recadrée, non couverte ; numéro HMI à côté de l'image.

## Audiomack — Weekly 100 Haiti
- **Mesure** : chansons les plus performantes sur Audiomack pour la région Haïti.
- **Territoire** : Haïti.
- **Métrique** : position.
- **Méthode** : import administratif vérifié. Le classement hebdomadaire global n'est jamais présenté comme Haïti.
- **Genres suivis** : les mêmes onglets publics Audiomack sont disponibles comme sources séparées : All, Afrosounds, Hip-Hop/Rap, Latin, Jazz/Blues, Caribbean, Pop, R&B, Gospel, Electronic, Rock, Punjabi, Country, Instrumental et Podcast.
- **Filtre Planète HMI** : la position source Audiomack est conservée. Les artistes non haïtiens peuvent être retirés manuellement dans l'administration; le site recalcule alors uniquement la position filtrée HMI.

## Apple Music — Haïti / HMI Worldwide
- **Mesure** : chart Apple Music du storefront Haïti si disponible, sinon présence internationale (Worldwide).
- **Territoire** : selon la source réelle (pas de bascule silencieuse vers un autre pays).
- **Métrique** : position via l'API officielle Apple Music.
- **Méthode** : API officielle (Developer Token serveur, test storefront `ht`).

## TikTok — Sons populaires en Haïti
- **Mesure** : sons les plus utilisés dans des publications en Haïti.
- **Territoire** : Haïti.
- **Métrique** : nombre de **publications** utilisant un son — jamais présenté comme des streams ou des vues.
- **Méthode** : import administratif vérifié.
- **Limites** : les sons TikTok peuvent être des versions altérées ; les correspondances incertaines sont vérifiées manuellement.

## Règles d'éligibilité communes
- Au moins un artiste **primary** ou **co-primary** doit être haïtien vérifié.
- Un artiste haïtien uniquement **featured** n'ouvre pas l'admissibilité au classement principal (classé séparément comme « Collaboration haïtienne »).

## Déclaration d'indépendance
Planète HMI est un service indépendant. Les marques et plateformes mentionnées appartiennent à leurs propriétaires respectifs. Planète HMI n'est ni affilié, ni sponsorisé, ni approuvé par ces plateformes, sauf mention expresse d'un partenariat.
