# Checklist SEO Technique - Planète HMI

Cette checklist vous guide pour implémenter le SEO sur chaque type de page.

## ✅ Pages statiques

### Structure minimale

```typescript
import { generatePageMetadata } from "@/lib/seo";

export const metadata = generatePageMetadata({
  title: "Titre de la page",
  description: "Description optimisée pour Google (150-160 caractères)",
  path: "/chemin",
});

export default function Page() {
  return <main>{/* Contenu */}</main>;
}
```

### Avec breadcrumbs

```typescript
import { Breadcrumbs } from "@/components/seo";

export default function Page() {
  return (
    <main>
      <Breadcrumbs 
        items={[
          { name: "Accueil", url: "/" },
          { name: "Page actuelle", url: "/page" },
        ]}
      />
      {/* Contenu */}
    </main>
  );
}
```

---

## ✅ Pages d'artistes

### Métadonnées

```typescript
import { generateArtistMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: Props) {
  const artist = await getArtist(params.slug);
  
  return generateArtistMetadata({
    name: artist.name,
    description: artist.bio,
    image: artist.image,
    slug: artist.slug,
  });
}
```

### Données structurées

```typescript
import { generateMusicGroupSchema } from "@/lib/seo";
import { StructuredData } from "@/components/seo";

<StructuredData 
  data={generateMusicGroupSchema({
    name: artist.name,
    url: `${SITE_URL}/artistes/${artist.slug}`,
    image: artist.image,
    description: artist.bio,
    genre: ["Kompa", "Rap Kreyòl"],
  })}
/>
```

### Breadcrumbs

```typescript
<Breadcrumbs 
  items={[
    { name: "Accueil", url: "/" },
    { name: "Artistes", url: "/artistes" },
    { name: artist.name, url: `/artistes/${artist.slug}` },
  ]}
/>
```

---

## ✅ Pages d'actualités

### Métadonnées

```typescript
import { generateNewsMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: Props) {
  const article = await getArticle(params.slug);
  
  return generateNewsMetadata({
    title: article.title,
    description: article.excerpt,
    image: article.coverImage,
    slug: article.slug,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
  });
}
```

### Données structurées

```typescript
import { generateArticleSchema } from "@/lib/seo";
import { StructuredData } from "@/components/seo";

<StructuredData 
  data={generateArticleSchema({
    title: article.title,
    description: article.excerpt,
    url: `${SITE_URL}/actualites/${article.slug}`,
    image: article.coverImage,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: article.author || "Planète HMI",
  })}
/>
```

### Breadcrumbs

```typescript
<Breadcrumbs 
  items={[
    { name: "Accueil", url: "/" },
    { name: "Actualités", url: "/actualites" },
    { name: article.title, url: `/actualites/${article.slug}` },
  ]}
/>
```

---

## ✅ Pages d'événements

### Métadonnées

```typescript
import { generateEventMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: Props) {
  const event = await getEvent(params.slug);
  
  return generateEventMetadata({
    name: event.name,
    description: event.description,
    image: event.image,
    slug: event.slug,
    startDate: event.startDate,
  });
}
```

### Données structurées

```typescript
import { generateEventSchema } from "@/lib/seo";
import { StructuredData } from "@/components/seo";

<StructuredData 
  data={generateEventSchema({
    name: event.name,
    description: event.description,
    url: `${SITE_URL}/evenements/${event.slug}`,
    startDate: event.startDate,
    endDate: event.endDate,
    location: {
      name: event.venueName,
      address: event.venueAddress,
    },
    image: event.image,
  })}
/>
```

### Breadcrumbs

```typescript
<Breadcrumbs 
  items={[
    { name: "Accueil", url: "/" },
    { name: "Événements", url: "/evenements" },
    { name: event.name, url: `/evenements/${event.slug}` },
  ]}
/>
```

---

## 🔍 Validation SEO

### Tester localement

```bash
# Démarrer le serveur de dev
pnpm dev

# Vérifier :
# - Sitemap : http://localhost:3000/sitemap.xml
# - Robots : http://localhost:3000/robots.txt
# - Balise Google : http://localhost:3000/google6d44388fef967718.html
```

### Tester en production

```bash
# Vérifier sur Vercel
# - Sitemap : https://planete-hmi.vercel.app/sitemap.xml
# - Robots : https://planete-hmi.vercel.app/robots.txt
```

### Outils de validation

- **Métadonnées** : https://metatags.io/
- **Données structurées** : https://search.google.com/test/rich-results
- **Performance** : https://pagespeed.web.dev/
- **Mobile-friendly** : https://search.google.com/test/mobile-friendly

---

## 📊 Sitemap dynamique

### Ajouter les pages d'artistes

Dans `src/app/sitemap.ts` :

```typescript
// Récupérer tous les artistes
const artists = await getAllArtists();

// Créer les entrées du sitemap
const artistPages: MetadataRoute.Sitemap = artists.map((artist) => ({
  url: `${SITE_URL}/artistes/${artist.slug}`,
  lastModified: artist.updatedAt || new Date(),
  changeFrequency: "weekly",
  priority: 0.7,
}));

// Les ajouter au sitemap
return [...staticPages, ...artistPages];
```

### Ajouter les actualités

```typescript
const news = await getAllNews();

const newsPages: MetadataRoute.Sitemap = news.map((article) => ({
  url: `${SITE_URL}/actualites/${article.slug}`,
  lastModified: article.updatedAt || article.publishedAt,
  changeFrequency: "monthly",
  priority: 0.6,
}));

return [...staticPages, ...artistPages, ...newsPages];
```

### Ajouter les événements

```typescript
const events = await getAllEvents();

const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
  url: `${SITE_URL}/evenements/${event.slug}`,
  lastModified: event.updatedAt || new Date(),
  changeFrequency: "weekly",
  priority: 0.7,
}));

return [...staticPages, ...artistPages, ...newsPages, ...eventPages];
```

---

## 🎯 Priorités SEO

### Core Web Vitals

- ✅ LCP (Largest Contentful Paint) < 2.5s
- ✅ FID (First Input Delay) < 100ms
- ✅ CLS (Cumulative Layout Shift) < 0.1

### Images

- ✅ Format WebP/AVIF
- ✅ Attribut `alt` descriptif
- ✅ `loading="lazy"` pour images below the fold
- ✅ Dimensions width/height définies

### Liens

- ✅ Texte descriptif (pas de "cliquez ici")
- ✅ Liens internes vers contenu pertinent
- ✅ `rel="noopener noreferrer"` sur liens externes

### Contenu

- ✅ Un seul `<h1>` par page
- ✅ Hiérarchie de titres (`h1` → `h2` → `h3`)
- ✅ Paragraphes courts et lisibles
- ✅ Mots-clés naturellement intégrés

---

## 🚀 Déploiement

Après chaque changement SEO :

```bash
# Build local pour vérifier
pnpm build

# Déployer sur Vercel
vercel --prod

# Vérifier en production
# - Métadonnées avec l'inspecteur du navigateur
# - Sitemap : https://planete-hmi.vercel.app/sitemap.xml
# - Google Search Console : indexation des nouvelles pages
```

---

## 📈 Monitoring

### Google Search Console

- Surveiller l'indexation
- Vérifier les erreurs 404
- Analyser les requêtes de recherche
- Suivre les Core Web Vitals

### Analytics

- Trafic organique
- Pages les plus visitées
- Taux de rebond
- Temps sur la page

---

## 🔗 Ressources

- [Guide SEO complet](./SEO_GUIDE.md)
- [Next.js Metadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Schema.org Music](https://schema.org/MusicGroup)
- [Google Search Central](https://developers.google.com/search)
