# 📖 Documentation API Wikipedia - Enrichissement artistes

## Vue d'ensemble

L'enrichissement Wikipedia utilise l'**API REST v1 de Wikipedia** pour extraire automatiquement les données biographiques des artistes.

---

## Endpoints utilisés

### 1. Page Summary (métadonnées de base)

**URL** : `https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}`

**Exemple** :
```
https://fr.wikipedia.org/wiki/Wyclef_Jean
→ https://fr.wikipedia.org/api/rest_v1/page/summary/Wyclef_Jean
```

**Données extraites** :
- `title` : Nom de l'artiste
- `extract` : Premier paragraphe (bio courte)
- `description` : Résumé court (ex: "Chanteur haïtien")
- `thumbnail.source` : URL de l'image principale
- `originalimage.source` : URL de l'image en haute résolution
- `content_urls.desktop.page` : URL canonique de la page

**Exemple de réponse** :
```json
{
  "title": "Wyclef Jean",
  "extract": "Nel Ust Wyclef Jean est un rappeur, chanteur...",
  "description": "Chanteur haïtien",
  "thumbnail": {
    "source": "https://upload.wikimedia.org/.../220px-Wyclef.jpg",
    "width": 220,
    "height": 330
  },
  "originalimage": {
    "source": "https://upload.wikimedia.org/.../Wyclef.jpg",
    "width": 1000,
    "height": 1500
  }
}
```

---

### 2. Page HTML (parsing infobox)

**URL** : `https://{lang}.wikipedia.org/api/rest_v1/page/html/{title}`

**Exemple** :
```
https://fr.wikipedia.org/api/rest_v1/page/html/Wyclef_Jean
```

**Données extraites** (via parsing de l'infobox) :
- Date de naissance : `birth_date`, `date_naissance`, `naissance`
- Lieu de naissance : `birth_place`, `lieu_naissance`
- Nom réel : `real_name`, `nom_naissance`, `birth_name`
- Carrière : `career_start`, `years_active`, `activité`
- Genres : via catégories Wikipedia

**Formats de date reconnus** :
- `1969-10-17` (ISO)
- `17 octobre 1969` (français)
- `October 17, 1969` (anglais)

**Exemple de données infobox** :
```
Nom de naissance: Nel Ust Wyclef Jean
Naissance: 17 octobre 1969
           Croix-des-Bouquets (Haïti)
Activité: depuis 1987
Genre: Hip-hop, R&B, reggae
```

---

## Algorithme d'extraction

### Étape 1 : Récupération des métadonnées (Summary API)

```typescript
const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
const response = await fetch(summaryUrl);
const data = await response.json();
```

**Extraction** :
- Nom : `data.title`
- Bio : `data.extract` (limité à 500 chars)
- Image : `data.originalimage?.source || data.thumbnail?.source`

---

### Étape 2 : Récupération de la page HTML

```typescript
const htmlUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`;
const htmlResponse = await fetch(htmlUrl);
const html = await htmlResponse.text();
```

---

### Étape 3 : Parsing de l'infobox (Wikitext)

**Recherche de patterns** :
```typescript
// Date de naissance
const birthDatePatterns = [
  /(?:date_naissance|birth_date|naissance)\s*=\s*([^\n|]+)/i,
  /\{\{date\s+de\s+naissance\|([^}]+)\}\}/i,
  /\{\{Birth date\|([^}]+)\}\}/i
];

// Lieu de naissance
const birthPlacePatterns = [
  /(?:lieu_naissance|birth_place|lieu\s+de\s+naissance)\s*=\s*([^\n|]+)/i
];

// Nom réel
const realNamePatterns = [
  /(?:nom_naissance|birth_name|real_name|nom\s+de\s+naissance)\s*=\s*([^\n|]+)/i
];
```

**Nettoyage des valeurs** :
- Suppression des `{{}}` (templates Wikipedia)
- Suppression des `[[]]` (liens internes)
- Suppression des `<ref>...</ref>` (références)
- Trim et normalisation des espaces

---

### Étape 4 : Extraction des genres (catégories)

**Patterns recherchés** :
```typescript
const genrePatterns = [
  /Catégorie:Musique ([^|\]]+)/gi,
  /Category:([^|\]]+) music/gi,
  /Genre:\s*\[\[([^\]]+)\]\]/gi
];
```

**Genres reconnus** :
- Hip-hop, Rap, R&B, Reggae, Pop, Rock
- Konpa, Raboday, Kompa, Zouk
- Jazz, Blues, Soul, Funk
- Afrobeat, Dancehall, Soca

---

## Format de retour de `enrichWikipedia()`

```typescript
interface PlatformData {
  platform: "wikipedia";
  name: string | null;
  description: string | null;  // Bio courte (500 chars max)
  images: CollectedImage[];    // Jusqu'à 4 tailles
  genres: string[];            // Genres extraits
  details: {
    birth_date_raw: string | null;      // Format brut à parser
    birth_place: string | null;          // Ville/pays
    real_name: string | null;            // Nom de naissance
    career_start_year: number | null;    // Année de début
    language: "fr" | "en";               // Langue de la page
    page_title: string;                  // Titre exact Wikipedia
  };
  method: "wikipedia_api";
  warnings: string[];           // Avertissements éventuels
  error: string | null;
  fetchedAt: string;           // ISO timestamp
}
```

---

## Exemples de résultats

### Exemple 1 : Extraction complète (Wyclef Jean)

**URL** : `https://fr.wikipedia.org/wiki/Wyclef_Jean`

**Résultat** :
```json
{
  "platform": "wikipedia",
  "name": "Wyclef Jean",
  "description": "Nel Ust Wyclef Jean est un rappeur, chanteur, producteur et acteur américano-haïtien, né le 17 octobre 1969 à Croix-des-Bouquets (Haïti).",
  "images": [
    {
      "url": "https://upload.wikimedia.org/.../Wyclef_Jean.jpg",
      "label": "Wyclef Jean",
      "type": "avatar"
    }
  ],
  "genres": ["hip-hop", "r-b", "reggae"],
  "details": {
    "birth_date_raw": "17 octobre 1969",
    "birth_place": "Croix-des-Bouquets, Haïti",
    "real_name": "Nel Ust Wyclef Jean",
    "career_start_year": 1987,
    "language": "fr",
    "page_title": "Wyclef Jean"
  },
  "method": "wikipedia_api",
  "warnings": [],
  "error": null,
  "fetchedAt": "2026-08-05T10:30:00.000Z"
}
```

---

### Exemple 2 : Extraction partielle (page courte)

**URL** : `https://fr.wikipedia.org/wiki/Artiste_Peu_Connu`

**Résultat** :
```json
{
  "platform": "wikipedia",
  "name": "Artiste Peu Connu",
  "description": "Artiste Peu Connu est un chanteur haïtien.",
  "images": [],
  "genres": ["konpa"],
  "details": {
    "birth_date_raw": null,
    "birth_place": null,
    "real_name": null,
    "career_start_year": null,
    "language": "fr",
    "page_title": "Artiste_Peu_Connu"
  },
  "method": "wikipedia_api",
  "warnings": ["Infobox incomplète : certaines données biographiques sont manquantes"],
  "error": null,
  "fetchedAt": "2026-08-05T10:35:00.000Z"
}
```

---

### Exemple 3 : Erreur (page inexistante)

**URL** : `https://fr.wikipedia.org/wiki/Artiste_Inexistant_123`

**Résultat** :
```json
{
  "platform": "wikipedia",
  "name": null,
  "description": null,
  "images": [],
  "genres": [],
  "details": {
    "language": "fr",
    "page_title": "Artiste_Inexistant_123"
  },
  "method": "wikipedia_api",
  "warnings": [],
  "error": "Page Wikipedia introuvable (404)",
  "fetchedAt": "2026-08-05T10:40:00.000Z"
}
```

---

## Gestion des erreurs

### Codes HTTP

| Code | Signification | Action |
|------|---------------|--------|
| 200  | Succès | Extraction normale |
| 301/302 | Redirection | Suivre automatiquement |
| 404 | Page introuvable | Retourner erreur avec message clair |
| 429 | Trop de requêtes | Attendre et réessayer (rate limit) |
| 500+ | Erreur serveur | Retourner erreur temporaire |

### Cas particuliers

**1. Page de redirection**
```
https://fr.wikipedia.org/wiki/Michel_Joseph_Martelly
→ Redirige vers → https://fr.wikipedia.org/wiki/Michel_Martelly
```
**Action** : Suivre la redirection, utiliser le nouveau titre

**2. Page d'homonymie**
```
https://fr.wikipedia.org/wiki/Jean_Claude
→ Page listant plusieurs Jean Claude
```
**Action** : Retourner warning "Page d'homonymie détectée"

**3. Infobox manquante**
```
Article sans infobox structurée
```
**Action** : Extraire uniquement summary (nom + bio), retourner warning

**4. Timeout**
```
Requête > 10 secondes
```
**Action** : Annuler, retourner erreur "Délai d'attente dépassé"

---

## Limites et contraintes

### Rate limiting
- **Wikipedia** : ~200 requêtes/seconde (très élevé)
- **Notre implémentation** : 1 enrichissement à la fois par utilisateur
- **Recommandation** : Ajouter un cache (24h) pour éviter requêtes répétées

### Qualité des données
- ✅ **Bon** : Artistes internationaux célèbres (Wyclef Jean, Michel Martelly)
- ⚠️ **Moyen** : Artistes locaux avec page courte
- ❌ **Faible** : Artistes sans page Wikipedia

### Langues supportées
- ✅ `fr` : Français (prioritaire)
- ✅ `en` : Anglais (fallback)
- ❌ Autres langues : Non supportées actuellement

---

## Améliorations futures

### Court terme
1. **Cache des résultats** : Redis ou BDD (24h TTL)
2. **Fallback en→fr** : Si page fr inexistante, essayer en
3. **Parsing amélioré** : Gérer plus de formats de dates
4. **Images multiples** : Extraire toutes les images de l'article

### Moyen terme
1. **Wikidata** : Utiliser Wikidata pour données structurées
2. **DBpedia** : Alternative pour données sémantiques
3. **Batch import** : Enrichir plusieurs artistes en une fois
4. **Validation humaine** : Interface pour corriger données extraites

---

## Ressources

### Documentation officielle
- API REST Wikipedia : https://www.mediawiki.org/wiki/API:REST_API
- Page Summary : https://www.mediawiki.org/wiki/API:Page_summary
- Wikidata : https://www.wikidata.org/wiki/Wikidata:Main_Page

### Outils de test
- Tester Summary API : https://fr.wikipedia.org/api/rest_v1/page/summary/Wyclef_Jean
- Tester HTML API : https://fr.wikipedia.org/api/rest_v1/page/html/Wyclef_Jean
- Valider Wikitext : https://www.mediawiki.org/wiki/Wikitext

---

**Document créé le** : 5 août 2026  
**Version** : 1.0  
**Fonction** : `enrichWikipedia()` dans `src/lib/artists/enrich.ts`
