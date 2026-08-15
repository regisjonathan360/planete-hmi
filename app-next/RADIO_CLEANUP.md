# 🧹 Nettoyage Radio - Suppression Données Fictives

## ✅ Changements Apportés

### 1. ✅ Suppression de tous les fichiers seed fictifs
- **Fichier:** `supabase/seed-radio.sql`
- **Avant:** Contenait 5 pistes de test fictives (SoundHelix)
- **Après:** Contient UNIQUEMENT la configuration de base (aucune donnée fictive)

### 2. ✅ Création d'un script de nettoyage
- **Fichier:** `supabase/migrations/20260816_remove_dummy_data.sql`
- **Action:** Supprime toutes les pistes/playlists de test existantes en base

### 3. ✅ Configuration radio réinitialisée
- Pas de playlist active (NULL)
- Pas d'auto-chart actif
- Configuration standard (3 pistes préchargées, 2000ms crossfade)

---

## 🎯 Comment Utiliser

### ÉTAPE 1 : Nettoyer la base de données

**Si vous avez des données fictives en base, exécutez ce script:**

```
Fichier: supabase/migrations/20260816_remove_dummy_data.sql
```

**Instructions:**
1. Allez sur https://supabase.com/dashboard
2. SQL Editor → New Query
3. Copiez le contenu du fichier
4. Exécutez (Cmd+Enter)

**Ce que ça fait:**
- ✅ Supprime toutes les pistes de test
- ✅ Supprime les playlists "Playlist Test" et "Top YouTube"
- ✅ Vide l'historique de lecture
- ✅ Réinitialise la configuration

---

### ÉTAPE 2 : Maintenant, remplir avec VOS VRAIES DONNÉES

#### Option A : Utiliser un classement existant
1. Allez sur `/admin/radio` → Configuration
2. Sélectionnez un classement (ex: "Top Spotify Week 1")
3. Les pistes s'affichent automatiquement
4. Cliquez "✅ Appliquer cette source"

#### Option B : Créer une playlist manuelle et ajouter vos pistes
1. Allez sur `/admin/radio` → Playlists
2. Créez une nouvelle playlist
3. Ajoutez vos pistes réelles (depuis base de données)
4. Sélectionnez-la dans Configuration

---

## 📊 Vérification du Nettoyage

Après exécution du script de nettoyage, vérifiez:

```sql
-- Vérifier qu'il n'y a plus de données fictives
SELECT COUNT(*) as count FROM radio_tracks WHERE source = 'manual';
-- Résultat attendu: 0

-- Vérifier les playlists existantes
SELECT name FROM radio_playlists;
-- Ne devrait PAS contenir "Playlist Test" ou "Top YouTube"

-- Vérifier la configuration
SELECT * FROM radio_config;
-- Tous les IDs devraient être NULL (aucune source sélectionnée)
```

---

## 🚨 Données Conservées

Ces données sont **conservées** (ce sont des vraies données) :

✅ **chart_editions** - Classements publiés
✅ **chart_entries** - Entrées des classements
✅ **tracks** - Chansons du catalogue
✅ **youtube_videos** - Vidéos YouTube approuvées
✅ **platform_tracks** - Pistes depuis Spotify/Audiomack/etc.

---

## 🗑️ Données Supprimées

Ces données sont **supprimées** (données fictives) :

❌ **radio_tracks** (source='manual') - Pistes de test
❌ **radio_playlists** - Playlists de test
❌ **radio_playlist_tracks** - Associations test
❌ **radio_play_history** - Historique de test
❌ **radio_stats** - Stats de test

---

## 📋 Fichiers Modifiés

| Fichier | Avant | Après |
|---------|-------|-------|
| `supabase/seed-radio.sql` | ❌ 5 pistes fictives | ✅ Vide (config de base) |
| NOUVEAU: `20260816_remove_dummy_data.sql` | - | ✅ Script de nettoyage |
| `supabase/migrations/20260811_radio_system.sql` | Inchangé | Inchangé |

---

## ✅ État Final

| Élément | Statut |
|---------|--------|
| Données fictives | ✅ Supprimées |
| Configuration de base | ✅ Créée |
| Prêt pour données réelles | ✅ OUI |
| **Radio** | ✅ **PRÊTE** |

---

## 🎵 Prochaines Étapes

1. ✅ Exécutez `20260816_remove_dummy_data.sql` pour nettoyer
2. ✅ Allez sur `/admin/radio` pour configurer
3. ✅ Sélectionnez un classement ou créez une playlist
4. ✅ Testez la lecture avec vos vraies données

---

**Radio 100% nettoyée et prête à être utilisée avec vos vraies données !** 🚀

*Créé le : 15/08/2026*
