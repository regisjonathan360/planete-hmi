# Guide SEO - Planète HMI

## ✅ Configuration technique SEO installée

### 1. **Fichiers de base**
- ✅ `robots.ts` - Configuration robots.txt dynamique
- ✅ `sitemap.ts` - Sitemap XML automatique
- ✅ `manifest.webmanifest` - PWA manifest pour mobile
- ✅ `humans.txt` - Crédits lisibles par humains

### 2. **Métadonnées et Schema.org**
- ✅ `src/lib/seo.ts` - Générateurs de schema JSON-LD
  - WebSite schema
  - Organization schema
  - Artist schema (MusicGroup)
  - Article schema
  - Event schema
  - MusicPlaylist schema (pour les charts)
- ✅ `src/lib/seo-helpers.ts` - Helpers pour métadonnées dynamiques
- ✅ `src/components/Breadcrumbs.tsx` - Fil d'Ariane avec schema.org

### 3. **Analytics et conformité**
- ✅ `src/components/Analytics.tsx` - Google Analytics 4 avec consentement RGPD
- ✅ Integration avec CookieConsent existant

### 4. **En-têtes de sécurité** (dans `next.config.ts`)
- ✅ `X-DNS-Prefetch-Control`
- ✅ `X-Frame-Options`
- ✅ `X-Content-Type-Options`
- ✅ `Referrer-Policy`
- ✅ `Permissions-Policy`

### 5. **Vérifications externes**
- ✅ Google Search Console (balise + fichier HTML)
- ✅ TikTok Developers verification

---

## 🚀 Configuration à compléter

### Variables d'environnement

Ajouter dans `.env.local` :

```bash
# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# URL du site (optionnel, défaut: planete-hmi.vercel.app)
NEXT_PUBLIC_SITE_URL=https://planete-hmi.com
```

### Google Search Console

1. **Propriété ajoutée** : `https://planete-hmi.vercel.app`
2. **Méthode de validation** : Fichier HTML (`google6d44388fef967718.html`)
3. **Statut** : En attente de validation

**Prochaines étapes** :
- Soumettre le sitemap : `https://planete-hmi.vercel.app/sitemap.xml`
- Configurer les données structurées
- Surveiller les Core Web Vitals

### Google Analytics 4

1. Créer une propriété GA4 : https://analytics.google.com
2. Copier le `Measurement ID` (format: `G-XXXXXXXXXX`)
3. Ajouter dans `.env.local` : `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
4. Redéployer le site

### Domaine personnalisé (recommandé)

Pour un meilleur SEO, utiliser un domaine personnalisé :

1. **Acheter le domaine** : `planete-hmi.com`
2. **Dans Vercel** :
   - Settings → Domains
   - Ajouter `planete-hmi.com`
   - Configurer les enregistrements DNS
3. **Dans Google Search Console** :
   - Ajouter la propriété domaine
   - Valider avec l'enregistrement TXT DNS

---

## 📊 Utilisation des helpers SEO

### Métadonnées de page

```typescript
import { generatePageMetadata } from "@/lib/seo-helpers";

export const metadata = generatePageMetadata({
  title: "Ma page",
  description: "Description de ma page",
  path: "/ma-page",
  keywords: ["mot-clé 1", "mot-clé 2"],
});
```

### Métadonnées d'artiste

```typescript
import { generateArtistMetadata } from "@/lib/seo-helpers";

export async function generateMetadata({ params }) {
  const artist = await getArtist(params.slug);
  return generateArtistMetadata(artist);
}
```

### Schema JSON-LD

```typescript
import { generateArtistSchema } from "@/lib/seo";

const schema = generateArtistSchema({
  name: "Nom de l'artiste",
  bio: "Biographie...",
  image: "/image/artist.jpg",
  url: `${SITE_URL}/artistes/slug`,
  sameAs: [
    "https://www.instagram.com/artist",
    "https://open.spotify.com/artist/...",
  ],
});

// Dans le composant
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
/>
```

### Fil d'Ariane (Breadcrumbs)

```typescript
import { Breadcrumbs } from "@/components/Breadcrumbs";

<Breadcrumbs
  items={[
    { label: "Accueil", href: "/" },
    { label: "Artistes", href: "/artistes" },
    { label: "Nom de l'artiste" }, // Dernier item sans href
  ]}
/>
```

---

## 🔍 Outils de test SEO

### Core Web Vitals
- **PageSpeed Insights** : https://pagespeed.web.dev/
- **Lighthouse** : DevTools → Lighthouse

### Structured Data
- **Rich Results Test** : https://search.google.com/test/rich-results
- **Schema Markup Validator** : https://validator.schema.org/

### Mobile-Friendly
- **Mobile-Friendly Test** : https://search.google.com/test/mobile-friendly

### Sitemap & Robots
- Robots.txt : `https://planete-hmi.vercel.app/robots.txt`
- Sitemap : `https://planete-hmi.vercel.app/sitemap.xml`

---

## 📈 Checklist SEO complète

### ✅ Fait
- [x] Métadonnées complètes (title, description, OG, Twitter)
- [x] Sitemap XML dynamique
- [x] Robots.txt
- [x] Structured Data (Schema.org)
- [x] PWA Manifest
- [x] En-têtes de sécurité
- [x] Google Search Console
- [x] Images optimisées (AVIF, WebP)
- [x] Analytics avec consentement RGPD

### 🔄 À faire
- [ ] Activer Google Analytics 4
- [ ] Ajouter domaine personnalisé
- [ ] Soumettre sitemap dans GSC
- [ ] Configurer Google My Business
- [ ] Optimiser les Core Web Vitals
- [ ] Ajouter pages dynamiques au sitemap (artistes, actualités)
- [ ] Configurer les réseaux sociaux
- [ ] Créer des backlinks
- [ ] Optimiser le contenu textuel

---

## 🎯 Bonnes pratiques

### Performance
- Images : toujours utiliser WebP/AVIF
- Fonts : précharger les polices critiques
- CSS/JS : minification automatique par Next.js

### Contenu
- Titres : 50-60 caractères
- Descriptions : 150-160 caractères
- URLs : courtes, descriptives, en minuscules
- Alt text : descriptif pour toutes les images

### Mobile
- Design responsive par défaut
- Boutons tactiles >= 44x44px
- Texte lisible sans zoom

---

## 📞 Support

Pour toute question SEO, consulter :
- [Next.js SEO Guide](https://nextjs.org/learn/seo/introduction-to-seo)
- [Google Search Central](https://developers.google.com/search)
- [Schema.org Documentation](https://schema.org/docs/documents.html)
