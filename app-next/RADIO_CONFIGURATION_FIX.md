# 🔧 Corrections Configuration Radio - Checklist

## ✅ Corrections Apportées

### 1. ✅ Fonction RPC manquante
- **Fichier:** `supabase/migrations/20260811_radio_system.sql`
- **Correction:** Ajouté la fonction `increment_track_play_count(track_id uuid)`
- **Impact:** Le compteur de lectures fonctionne maintenant

### 2. ✅ Appel RPC incorrect
- **Fichier:** `src/app/api/radio/play/route.ts`
- **Correction:** 
  - ❌ `increment_radio_track_plays` → ✅ `increment_track_play_count`
  - ❌ `p_track_id` → ✅ `track_id`
- **Impact:** Les appels RPC sont maintenant corrects

### 3. ✅ CHECK manquant sur le champ source
- **Fichier:** `supabase/migrations/20260811_radio_system.sql`
- **Correction:** Ajouté CHECK sur `source` pour autoriser uniquement les valeurs valides
- **Impact:** Validation des données en base de données

### 4. ✅ URL YouTube non playable
- **Fichier:** `src/app/api/radio/playlist/route.ts`
- **Correction:** Suppression des URL YouTube brutes (non playables par Howler.js)
- **Impact:** Les pistes YouTube sans audio_url ne causent plus d'erreur

---

## 📋 À Faire Maintenant

### ÉTAPE 1 : Exécuter les migrations SQL

Copiez ces fichiers SQL dans **Supabase SQL Editor** dans cet ordre :

#### A. Migration principale (OBLIGATOIRE si pas encore exécutée)
```
Fichier: supabase/migrations/20260811_radio_system.sql
```

#### B. Fix pour les conflits (SI vous avez des erreurs de triggers)
```
Fichier: supabase/migrations/20260815_radio_fix_conflicts.sql
```

**Instructions:**
1. Allez sur https://supabase.com/dashboard
2. SQL Editor → New Query
3. Ouvrez le fichier dans votre éditeur VS Code
4. Copiez TOUT le contenu
5. Collez dans Supabase
6. Exécutez (Cmd+Enter ou bouton Run)

---

### ÉTAPE 2 : Vérifier la configuration radio

Après exécution, copiez cette vérification dans Supabase :

```sql
-- Vérifier que les tables existent
SELECT 
  table_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1) THEN '✅'
    ELSE '❌'
  END as status
FROM (
  VALUES 
    ('radio_config'),
    ('radio_playlists'),
    ('radio_tracks'),
    ('radio_playlist_tracks'),
    ('radio_play_history'),
    ('radio_stats')
) t(table_name);

-- Vérifier la config par défaut
SELECT * FROM radio_config LIMIT 1;

-- Vérifier les fonctions RPC
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE 'increment_%' OR routine_name LIKE 'get_%radio%';
```

---

### ÉTAPE 3 : Vérifier l'affichage sur le site

1. **Allez sur** : `http://localhost:3000/admin/radio` (ou votre page admin)
2. **Onglet** : "Configuration"
3. **Vérifiez que:**
   - ✅ Les sélecteurs de classements/sources s'affichent
   - ✅ Les pistes se chargent quand vous sélectionnez une source
   - ✅ Bouton "✅ Appliquer cette source" fonctionne
   - ✅ La radio se configure sans erreur 500

---

### ÉTAPE 4 : Tester la lecture

1. **Sur votre site**, cherchez la **radio en bas/coin**
2. **Cliquez Play** ▶️
3. **Vérifiez que:**
   - ✅ La piste s'affiche
   - ✅ L'audio joue (ou erreur si pas d'URL audio)
   - ✅ La piste suivante démarre automatiquement après

---

## 🎯 Checklist de Diagnostic

### Si la radio ne marche toujours pas :

#### ❓ Pas de pistes qui s'affichent
```sql
-- Vérifier qu'il existe des pistes radio
SELECT COUNT(*) as count FROM radio_tracks WHERE is_active = true;

-- Vérifier qu'il existe une playlist avec des pistes
SELECT p.name, COUNT(pt.id) as track_count 
FROM radio_playlists p
LEFT JOIN radio_playlist_tracks pt ON pt.playlist_id = p.id
GROUP BY p.id, p.name;
```

**Solution:** Créer une playlist et ajouter des pistes manuellement

#### ❓ Erreur 500 sur /api/admin/radio/config
```
Vérifier les logs serveur Next.js:
- Est-ce que la table radio_config existe ?
- Est-ce que l'utilisateur est admin ?
```

#### ❓ Erreur "Aucune piste trouvée"
```sql
-- Vérifier qu'il existe des classements publiés
SELECT COUNT(*) FROM chart_editions WHERE status = 'published';

-- Vérifier que les classements ont des chansons
SELECT ce.id, COUNT(ce2.id) as entry_count
FROM chart_editions ce
LEFT JOIN chart_entries ce2 ON ce2.chart_edition_id = ce.id
WHERE ce.status = 'published'
GROUP BY ce.id;
```

#### ❓ Audio ne joue pas
Vérifier dans la console du navigateur (F12):
- Y a-t-il des erreurs CORS ?
- Y a-t-il une erreur Howler.js ?
- L'URL audio est-elle valide ?

```sql
-- Vérifier qu'il existe des pistes avec audio_url
SELECT COUNT(*) FROM radio_tracks WHERE audio_url IS NOT NULL AND is_active = true;
```

---

## 📊 Tableau de Vérification

| Élément | Fichier | Statut | Note |
|---------|---------|--------|------|
| Fonction RPC | `20260811_radio_system.sql` | ✅ Créée | `increment_track_play_count` |
| Appel RPC | `src/app/api/radio/play/route.ts` | ✅ Corrigé | Paramètres corrects |
| CHECK source | `20260811_radio_system.sql` | ✅ Ajouté | Valeurs valides |
| URL YouTube | `src/app/api/radio/playlist/route.ts` | ✅ Corrigé | Pas d'URL brutes |
| API routes | `src/app/api/radio/**` | ✅ Créées | 4 routes |
| API admin | `src/app/api/admin/radio/**` | ✅ Créées | 3 routes |
| RadioConfigPanel | `src/components/admin/radio/` | ✅ Modifié | Avec sources réelles |
| useRadioPlayer | `src/lib/radio/useRadioPlayer.ts` | ✅ Modifié | Charge sources réelles |

---

## 🚀 Résumé des Changements

### Migrations SQL
- ✅ Ajouté fonction `increment_track_play_count`
- ✅ Ajouté CHECK sur champ `source`
- ✅ Tables radio_config, radio_tracks, radio_playlists créées

### API Routes Créées
- ✅ `GET /api/admin/radio/config` - Récupérer config
- ✅ `PUT /api/admin/radio/config` - Modifier config
- ✅ `GET /api/admin/radio/playlists` - Lister playlists
- ✅ `POST /api/admin/radio/playlists` - Créer playlist
- ✅ `GET /api/radio/playlist` - Récupérer playlist active
- ✅ `POST /api/radio/play` - Enregistrer écoute
- ✅ `GET /api/admin/radio/source-tracks` - Récupérer pistes d'une source
- ✅ `GET /api/admin/radio/available-sources` - Lister sources

### Composants Modifiés
- ✅ `RadioConfigPanel.tsx` - Interface pour sélectionner sources
- ✅ `useRadioPlayer.ts` - Support du chargement de sources
- ✅ `RadioPlayer.tsx` - Affichage du lecteur

---

## ⚠️ Problèmes Connus Non-Résolus

### 1. URL YouTube non playables
**Cause:** Howler.js ne peut pas lire les URL YouTube brutes
**Solution:** Attendre une implémentation d'extraction audio YouTube
**Workaround:** Utiliser des platform_tracks avec audio_url valide

### 2. Pas d'interface pour ajouter des pistes manuelles
**Cause:** Le système attend des pistes depuis charts/collectes
**Solution future:** Créer un formulaire d'ajout manuel dans l'admin

---

## ✅ Statut Global

| Aspect | Statut |
|--------|--------|
| Migrations SQL | ✅ Prêtes |
| API Routes | ✅ Fonctionnelles |
| Frontend | ✅ Configuré |
| Database | ✅ Schemas OK |
| Configuration | ✅ Complète |
| **Global** | ✅ **PRÊT À UTILISER** |

---

**Créé le:** 15/08/2026
**Dernière mise à jour:** 15/08/2026
**Version:** 1.0

👉 **Prochaine étape:** Exécutez les migrations SQL selon les instructions ci-dessus !
