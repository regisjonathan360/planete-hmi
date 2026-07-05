# Planète HMI — Haitian Music Index

Plateforme web de référence pour la musique haïtienne : charts, artistes, districts,
découverte (HMI Shorts) et univers cosmique premium. Version actuelle : **site statique**
(HTML / CSS / JavaScript vanilla, sans build).

## Fonctionnalités

- Accueil immersif (fond cosmique, planète, projecteurs de scène décoratifs).
- Pages : Accueil, Artistes, Classements, Actualités, Événements, Boutique.
- **Écoute d'extraits** au survol et à la demande (API publique Deezer, 30 s).
- **Recherche globale** (overlay) avec pochettes et écoute.
- **Favoris** persistants (localStorage) avec compteur et panneau de gestion.
- Filtres par genre, onglets, responsive, accessibilité (`aria`, `prefers-reduced-motion`).

## Lancer en local

Servir la racine du projet sur le port 8080 :

```bash
# Python
python -m http.server 8080
# ou Node
npx http-server . -p 8080
```

Puis ouvrir http://localhost:8080

## Structure

```
.
├── index.html, artistes.html, classement.html, actualites.html, evenements.html, boutique.html
├── assets/
│   ├── css/style.css
│   └── js/  (main, preview, ui, features, artists-data, rank-data)
├── brand/   (logos)
├── image/   (backgrounds, effects, artists, covers, social)
└── .kiro/   (specs & steering)
```

## Déploiement

Site 100 % statique : déployable tel quel sur **GitHub Pages**, **Netlify** ou **Vercel**
(dossier racine, pas de build). Point d'entrée : `index.html`.

## Notes

- Contenu de démonstration (artistes, charts, prix) clairement étiqueté.
- Les extraits audio proviennent de recherches publiques Deezer ; une intégration
  serveur licenciée est prévue pour la production (voir `.kiro/`).
