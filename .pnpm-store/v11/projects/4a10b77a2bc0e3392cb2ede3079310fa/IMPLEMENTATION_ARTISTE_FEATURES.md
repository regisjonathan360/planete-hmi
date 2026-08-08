# 🎯 Guide d'implémentation - Nouvelles fonctionnalités Artistes

## ✅ Ce qui est déjà fait

### 1. Migration SQL
**Fichier** : `supabase/migrations/20260805000000_artist_additional_fields.sql`
- ✅ Ajouté `url_wikipedia`, `url_chartmetric`, `url_shazam`
- ✅ Ajouté `gender` (m/f/g/o)
- ✅ Index sur `gender`

### 2. Tags et rôles
**Fichier** : `src/lib/artists/tags.ts`
- ✅ Ajouté type `"animateur"` dans `ArtistTag`
- ✅ Ajouté dans `ARTIST_TAGS` avec icon 🎉 et couleur jaune

**Fichier** : `src/lib/artists/roles.ts`
- ✅ Ajouté aliases: animateur, animatrice, ambianceur, host, mc → "animateur"

### 3. Système d'enrichissement
**Fichier** : `src/lib/artists/enrich.ts`
- ✅ Ajouté `url_wikipedia`, `url_chartmetric`, `url_shazam` dans `ENRICHABLE_FIELDS`
- ✅ Ajouté hosts attendus pour validation
- ✅ Créé fonction `enrichWikipedia()` complète qui extrait :
  - Nom de l'artiste
  - Bio (premier paragraphe)
  - Image principale
  - Genres musicaux (depuis catégories)
  - Date de naissance (depuis infobox)
  - Lieu de naissance (depuis infobox)
  - Nom réel (depuis infobox)
  - Année de début de carrière (depuis infobox)
- ✅ Ajouté dans `ENRICHERS`:
  - `url_wikipedia: enrichWikipedia`
  - `url_chartmetric: enrichGeneric`
  - `url_shazam: enrichGeneric`

---

## 📋 Ce qu'il reste à faire

### Étape 1 : Exécuter la migration SQL

```bash
# Dans le terminal
cd "c:\Users\regis\Desktop\Projet planete HMI\app-next"

# Appliquer la migration
npx supabase db push
```

**OU** si Supabase local :
```bash
npx supabase migration up
```

---

### Étape 2 : Modifier le formulaire d'édition artiste

**Fichier à modifier** : `src/app/admin/artistes/[id]/ArtistEditForm.tsx`

#### A. Ajouter les champs dans l'interface TypeScript

Cherche l'interface de l'artiste et ajoute :
```typescript
interface Artist {
  // ... champs existants
  url_wikipedia: string | null;
  url_chartmetric: string | null;
  url_shazam: string | null;
  gender: 'm' | 'f' | 'g' | 'o' | null;
}
```

#### B. Ajouter les champs dans le state du formulaire

Cherche `useState` pour l'artiste et ajoute les nouveaux champs :
```typescript
const [formData, setFormData] = useState({
  // ... champs existants
  url_wikipedia: artist.url_wikipedia || '',
  url_chartmetric: artist.url_chartmetric || '',
  url_shazam: artist.url_shazam || '',
  gender: artist.gender || null,
});
```

#### C. Ajouter la section "Sexe" dans le formulaire

Après la section "Type d'artiste", ajoute :
```tsx
{/* Sexe / Genre */}
<div className="form-section">
  <h3>Sexe / Genre</h3>
  <p className="form-hint">
    Permet aux visiteurs de filtrer les artistes par sexe sur la page publique.
  </p>
  
  <div className="gender-buttons" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
    <label className="gender-option">
      <input
        type="radio"
        name="gender"
        value="m"
        checked={formData.gender === 'm'}
        onChange={(e) => setFormData({ ...formData, gender: 'm' })}
      />
      <span>👨 Masculin</span>
    </label>
    
    <label className="gender-option">
      <input
        type="radio"
        name="gender"
        value="f"
        checked={formData.gender === 'f'}
        onChange={(e) => setFormData({ ...formData, gender: 'f' })}
      />
      <span>👩 Féminin</span>
    </label>
    
    <label className="gender-option">
      <input
        type="radio"
        name="gender"
        value="g"
        checked={formData.gender === 'g'}
        onChange={(e) => setFormData({ ...formData, gender: 'g' })}
      />
      <span>👥 Groupe</span>
    </label>
    
    <label className="gender-option">
      <input
        type="radio"
        name="gender"
        value="o"
        checked={formData.gender === 'o'}
        onChange={(e) => setFormData({ ...formData, gender: 'o' })}
      />
      <span>⚧️ Autre / Non-binaire</span>
    </label>
    
    <label className="gender-option">
      <input
        type="radio"
        name="gender"
        value=""
        checked={!formData.gender}
        onChange={(e) => setFormData({ ...formData, gender: null })}
      />
      <span>Non spécifié</span>
    </label>
  </div>
</div>
```

#### D. Ajouter les nouveaux champs URLs

Dans la section des plateformes, ajoute (après les autres URLs) :
```tsx
{/* Wikipedia */}
<div className="form-field">
  <label>
    <span>Wikipedia</span>
    <input
      type="url"
      value={formData.url_wikipedia || ''}
      onChange={(e) => setFormData({ ...formData, url_wikipedia: e.target.value })}
      placeholder="https://fr.wikipedia.org/wiki/Nom_Artiste"
    />
  </label>
  <p className="field-hint">
    ✨ Extraction automatique : bio, date/lieu naissance, nom réel, genres, image
  </p>
</div>

{/* Chartmetric */}
<div className="form-field">
  <label>
    <span>Chartmetric</span>
    <input
      type="url"
      value={formData.url_chartmetric || ''}
      onChange={(e) => setFormData({ ...formData, url_chartmetric: e.target.value })}
      placeholder="https://chartmetric.com/artist/..."
    />
  </label>
</div>

{/* Shazam */}
<div className="form-field">
  <label>
    <span>Shazam</span>
    <input
      type="url"
      value={formData.url_shazam || ''}
      onChange={(e) => setFormData({ ...formData, url_shazam: e.target.value })}
      placeholder="https://www.shazam.com/artist/..."
    />
  </label>
</div>
```

#### E. Ajouter dans le panneau d'enrichissement

Dans le composant qui liste les plateformes enrichissables, ajoute :
```typescript
const platforms = [
  // ... plateformes existantes
  { key: 'url_wikipedia', label: 'Wikipedia', icon: '📖' },
  { key: 'url_chartmetric', label: 'Chartmetric', icon: '📊' },
  { key: 'url_shazam', label: 'Shazam', icon: '🎵' },
];
```

---

### Étape 3 : Ajouter le filtre sexe sur la page publique

**Fichier à modifier** : `src/app/artistes/ArtistesGrid.tsx`

#### A. Ajouter le filtre dans le state

```typescript
const [genderFilter, setGenderFilter] = useState<string>("all");
```

#### B. Ajouter le filtre dans la logique

Dans le `useMemo` du filtrage :
```typescript
if (genderFilter !== "all") {
  result = result.filter((a) => a.gender === genderFilter);
}
```

#### C. Ajouter l'UI du filtre

Après les filtres de genre musical :
```tsx
{/* Filtre par sexe */}
<nav className="artistes-filters" aria-label="Filtrer par sexe">
  <button
    type="button"
    className={genderFilter === "all" ? "filter-btn is-active" : "filter-btn"}
    onClick={() => setGenderFilter("all")}
  >
    Tous
  </button>
  <button
    type="button"
    className={genderFilter === "m" ? "filter-btn is-active" : "filter-btn"}
    onClick={() => setGenderFilter("m")}
  >
    👨 Masculin
  </button>
  <button
    type="button"
    className={genderFilter === "f" ? "filter-btn is-active" : "filter-btn"}
    onClick={() => setGenderFilter("f")}
  >
    👩 Féminin
  </button>
  <button
    type="button"
    className={genderFilter === "g" ? "filter-btn is-active" : "filter-btn"}
    onClick={() => setGenderFilter("g")}
  >
    👥 Groupes
  </button>
</nav>
```

#### D. Mettre à jour l'interface PublicArtist

**Fichier** : `src/app/artistes/page.tsx`

Ajouter `gender` dans l'interface :
```typescript
export interface PublicArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  tags: string[];
  genres: string[];
  bestPosition: number | null;
  gender: string | null; // ← AJOUTER
  productionCount?: number;
}
```

Et dans la requête Supabase, ajouter `gender` dans le `.select()` :
```typescript
.select("id, name, slug, image_url, tags, artist_type, gender")
```

---

### Étape 4 : Ajouter le CSS pour les nouveaux éléments

**Fichier** : `public/assets/css/style.css` (ou fichier CSS admin)

```css
/* Boutons radio de sexe */
.gender-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.gender-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 2px solid var(--admin-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.gender-option:hover {
  background: var(--admin-hover);
  border-color: var(--admin-primary);
}

.gender-option input[type="radio"] {
  margin: 0;
}

.gender-option input[type="radio"]:checked + span {
  font-weight: 600;
  color: var(--admin-primary);
}

.gender-option span {
  font-size: 0.95rem;
}
```

---

## 🧪 Tests à effectuer

### 1. Test Wikipedia
1. Créer/éditer un artiste
2. Ajouter une URL Wikipedia (ex: `https://fr.wikipedia.org/wiki/Wyclef_Jean`)
3. Cliquer sur "Enrichir depuis Wikipedia"
4. Vérifier que les données sont extraites :
   - Bio dans `description`
   - Date de naissance dans `birth_date_raw` (details)
   - Lieu dans `birth_place` (details)
   - Nom réel dans `real_name` (details)
   - Genres dans `genres`
   - Image dans `images`

### 2. Test Chartmetric & Shazam
1. Ajouter les URLs
2. Cliquer sur "Enrichir"
3. Vérifier que les métadonnées OpenGraph sont extraites

### 3. Test Rôle Animateur
1. Dans le formulaire, ajouter le tag "Animateur / Ambianceur"
2. Sauvegarder
3. Vérifier que l'artiste apparaît sur la page publique avec le filtre "Animateur"

### 4. Test Filtre Sexe
1. Définir le sexe de plusieurs artistes (m/f/g)
2. Aller sur `/artistes`
3. Utiliser les filtres par sexe
4. Vérifier que le filtrage fonctionne

---

## 📊 Workflow utilisateur final

### Admin - Ajout d'un artiste avec Wikipedia

1. Admin crée un nouvel artiste
2. Admin remplit le nom
3. Admin ajoute l'URL Wikipedia
4. Admin clique sur "Enrichir depuis Wikipedia"
5. **Système extrait automatiquement** :
   - Bio → pré-remplit le champ "bio"
   - Date de naissance → pré-remplit "birth_date"
   - Lieu → pré-remplit "city" ou "birth_city"
   - Nom réel → pré-remplit "real_name"
   - Genres → ajoute aux tags
   - Image → télécharge et set comme photo de profil
6. Admin vérifie/ajuste les données
7. Admin définit le sexe
8. Admin sauvegarde

### Visiteur - Filtrage par sexe

1. Visiteur va sur `/artistes`
2. Voit les filtres : Rôles, Genres, **Sexe** (nouveau)
3. Clique sur "👩 Féminin"
4. Ne voit que les artistes féminines
5. Peut combiner avec autres filtres (ex: Féminines + Chanteuses + Konpa)

---

## 🚀 Déploiement

Une fois toutes les modifications faites :

```bash
# 1. Vérifier qu'il n'y a pas d'erreurs TypeScript
npm run build

# 2. Appliquer la migration SQL
npx supabase db push

# 3. Déployer sur Vercel
npx vercel --prod
```

---

## 📝 Notes importantes

### Extraction Wikipedia
- Fonctionne avec URLs **fr.wikipedia.org** et **en.wikipedia.org**
- Extrait les données de l'infobox (format Wikitext)
- Robuste : gère les variations de format (date de naissance, birth_date, etc.)
- Limite la bio à 500 caractères (premier paragraphe)
- Extrait jusqu'à 4 tailles d'image si disponibles

### Mapping des données Wikipedia
Les données extraites sont stockées dans `base.details` et peuvent être utilisées pour pré-remplir les champs :
- `birth_date_raw` → parser et mettre dans `artist.birth_date`
- `birth_place` → mettre dans `artist.city` ou `artist.birth_city`
- `real_name` → mettre dans `artist.real_name`
- `career_start_year` → mettre dans `artist.career_start_year`

### Icônes suggérées pour le sexe
- Masculin : 👨 ou ♂️
- Féminin : 👩 ou ♀️
- Groupe : 👥
- Autre/Non-binaire : ⚧️ ou ⚥

---

## ✅ Checklist finale

- [ ] Migration SQL exécutée
- [ ] Tags "animateur" visibles dans le formulaire
- [ ] Champs Wikipedia, Chartmetric, Shazam dans le formulaire
- [ ] Champ "Sexe" avec radio buttons dans le formulaire
- [ ] Fonction enrichWikipedia testée et fonctionnelle
- [ ] Filtre par sexe sur la page publique `/artistes`
- [ ] CSS ajouté pour les nouveaux éléments
- [ ] Tests effectués
- [ ] Déployé en production
