# 🎵 Installation Complète - Radio Planète HMI

## ✅ Checklist d'installation

- [ ] 1. Appliquer les migrations SQL
- [ ] 2. Intégrer le lecteur dans le layout (FAIT ✓)
- [ ] 3. Créer des données de test
- [ ] 4. Synchroniser YouTube (optionnel)
- [ ] 5. Tester la radio
- [ ] 6. Configurer depuis l'admin

---

## 📋 Étape 1 : Appliquer les migrations SQL

### 1.1 Migration principale du système radio

Dans l'**éditeur SQL de Supabase**, exécutez :

```bash
# Fichier: supabase/migrations/20260811_radio_system.sql
```

Cette migration crée :
- 6 tables : `radio_tracks`, `radio_playlists`, `radio_playlist_tracks`, `radio_config`, `radio_play_history`, `radio_stats`
- Indexes de performance
- Fonctions SQL de base
- Policies RLS

### 1.2 Migration de synchronisation YouTube

```bash
# Fichier: supabase/migrations/20260812_radio_youtube_sync.sql
```

Cette migration ajoute :
- Fonction `sync_youtube_to_radio()` pour synchroniser automatiquement
- Fonction `get_chart_radio_tracks()` pour les classements

### 1.3 Fonction SQL manquante (Important !)

Dans l'éditeur SQL, ajoutez :

```sql
CREATE OR REPLACE FUNCTION increment_track_play_count(track_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE radio_tracks
  SET play_count = play_count + 1
  WHERE id = track_id;
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ Étape 2 : Intégration du lecteur (DÉJÀ FAIT)

Le fichier `src/app/layout.tsx` a déjà été modifié pour inclure :
```tsx
import { RadioPlayer } from "@/components/radio/RadioPlayer";
// ...
<RadioPlayer />
```

✓ Le lecteur s'affichera automatiquement en bas de toutes les pages.

---

## 🎵 Étape 3 : Créer des données de test

### Option A : Données de test avec MP3 de démonstration

Dans l'éditeur SQL de Supabase :

```bash
# Fichier: supabase/seed-radio.sql
```

Ce script crée :
- 1 playlist "Playlist Test"
- 5 pistes de test avec des MP3 gratuits de SoundHelix
- Configuration radio activée

### Option B : Créer manuellement une piste

```sql
-- 1. Créer une playlist
INSERT INTO radio_playlists (name, description, is_default, is_active)
VALUES ('Ma Playlist', 'Description', true, true)
RETURNING id;

-- 2. Ajouter une piste (remplacez URL_AUDIO par votre MP3)
INSERT INTO radio_tracks (title, artist_name, audio_url, duration_seconds, source, is_active)
VALUES ('Ma Chanson', 'Mon Artiste', 'URL_AUDIO', 180, 'manual', true)
RETURNING id;

-- 3. Lier la piste à la playlist (remplacez PLAYLIST_ID et TRACK_ID)
INSERT INTO radio_playlist_tracks (playlist_id, track_id, position)
VALUES ('PLAYLIST_ID', 'TRACK_ID', 1);

-- 4. Configurer la radio
UPDATE radio_config
SET active_playlist_id = 'PLAYLIST_ID', is_live = true;
```

---

## 🔗 Étape 4 : Synchroniser YouTube (Optionnel mais recommandé)

### 4.1 Via l'interface SQL

```bash
# Fichier: supabase/sync-youtube-to-radio.sql
```

Ce script :
- Importe toutes vos vidéos YouTube approuvées
- Crée une playlist "Top YouTube"
- Remplit la playlist avec le top 50

### 4.2 Via l'API admin (méthode recommandée)

Une fois votre site démarré :

```bash
# Depuis votre terminal
curl -X POST http://localhost:3000/api/admin/radio/sync \
  -H "Content-Type: application/json" \
  -d '{
    "playlistName": "Top YouTube",
    "limit": 50
  }'
```

Ou utilisez cette route dans un bouton admin (à créer).

### 4.3 Configurer pour utiliser le classement YouTube

```sql
UPDATE radio_config
SET 
  auto_switch_to_chart = false,  -- false = utilise la playlist
  active_playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Top YouTube' LIMIT 1),
  is_live = true;
```

---

## 🚀 Étape 5 : Démarrer et tester

### 5.1 Démarrer le serveur Next.js

```bash
cd app-next
npm run dev
```

### 5.2 Vérifier la radio

1. **Ouvrez votre navigateur** : http://localhost:3000
2. **Le lecteur radio devrait apparaître** en bas de la page
3. **Cliquez sur Play** ▶️
4. **La première piste devrait jouer**

### 5.3 Dépannage si rien ne s'affiche

```sql
-- Vérifier qu'il y a une config
SELECT * FROM radio_config;

-- Vérifier qu'il y a des pistes
SELECT COUNT(*) FROM radio_tracks WHERE is_active = true;

-- Vérifier qu'il y a une playlist active
SELECT 
  rc.is_live,
  rp.name,
  COUNT(rpt.id) as track_count
FROM radio_config rc
LEFT JOIN radio_playlists rp ON rp.id = rc.active_playlist_id
LEFT JOIN radio_playlist_tracks rpt ON rpt.playlist_id = rp.id
GROUP BY rc.id, rc.is_live, rp.name;
```

Si `track_count` = 0, vous devez ajouter des pistes !

---

## 🎛️ Étape 6 : Configuration depuis l'admin

### 6.1 Accéder au panel admin

```
http://localhost:3000/admin/radio
```

Vous devez être connecté en tant qu'administrateur.

### 6.2 Configurer la radio

**Onglet "Configuration"** :

1. **Choisir le mode** :
   - **Playlist manuelle** : sélectionnez "Playlist Test" ou "Top YouTube"
   - **Auto-chart** : entrez `youtube-week` (si vous avez des classements)

2. **Réglages** :
   - Pistes à précharger : `3` (recommandé)
   - Crossfade : `2000` ms (2 secondes)

3. **Activer** :
   - Cochez "Radio en direct (LIVE)"

4. **Enregistrer**

### 6.3 Gérer les playlists

**Onglet "Playlists"** :
- Créez de nouvelles playlists thématiques
- Ajoutez/retirez des pistes
- Réorganisez l'ordre

### 6.4 Gérer les pistes

**Onglet "Pistes"** :
- Recherchez des pistes
- Filtrez par source (YouTube, manual, etc.)
- Écoutez les aperçus
- Modifiez les métadonnées

---

## 🎯 Cas d'usage recommandés

### 1. Radio du Top YouTube (automatique)

```sql
-- Synchroniser d'abord les vidéos
SELECT * FROM sync_youtube_to_radio();

-- Configurer la radio
UPDATE radio_config
SET 
  active_playlist_id = (SELECT id FROM radio_playlists WHERE name = 'Top YouTube'),
  auto_switch_to_chart = false,
  is_live = true;
```

**Avantages** :
- ✅ Toujours à jour avec vos vidéos approuvées
- ✅ Ordre par nombre de vues
- ✅ Facile à maintenir

### 2. Playlists thématiques multiples

```sql
-- Créer plusieurs playlists
INSERT INTO radio_playlists (name, description, is_active) VALUES
  ('Konpa Hits', 'Les meilleurs hits konpa', true),
  ('Découvertes', 'Nouveaux talents à découvrir', true),
  ('Classics', 'Les classiques intemporels', true);
```

Changez manuellement la playlist active depuis l'admin.

### 3. Mode auto-chart (avancé)

Si vous avez déjà un système de classements avec `source_key` :

```sql
UPDATE radio_config
SET 
  auto_switch_to_chart = true,
  chart_source_key = 'youtube-week',  -- Votre clé de classement
  is_live = true;
```

La radio jouera automatiquement ce classement.

---

## 📊 Vérification finale

### Checklist de validation

- [ ] Le lecteur s'affiche en bas de page
- [ ] Le bouton Play fonctionne
- [ ] La musique se lance
- [ ] Le titre et l'artiste s'affichent
- [ ] Le bouton Suivant change de piste
- [ ] Le volume est réglable
- [ ] L'admin `/admin/radio` est accessible
- [ ] Les onglets de l'admin fonctionnent
- [ ] La config peut être modifiée

### Requêtes SQL de validation

```sql
-- État global de la radio
SELECT 
  'Configuration' as type,
  CASE WHEN is_live THEN '✅ EN DIRECT' ELSE '❌ Hors ligne' END as status,
  CASE WHEN auto_switch_to_chart THEN 'Auto-chart: ' || chart_source_key ELSE 'Playlist: ' || (SELECT name FROM radio_playlists WHERE id = active_playlist_id) END as mode,
  preload_count || ' pistes préchargées' as preload,
  crossfade_duration_ms || ' ms de crossfade' as crossfade
FROM radio_config
LIMIT 1;

-- Pistes disponibles
SELECT 
  source,
  COUNT(*) as count,
  SUM(play_count) as total_plays
FROM radio_tracks
WHERE is_active = true
GROUP BY source;

-- Playlists et leur contenu
SELECT 
  p.name,
  p.is_active,
  COUNT(pt.id) as track_count
FROM radio_playlists p
LEFT JOIN radio_playlist_tracks pt ON pt.playlist_id = p.id
GROUP BY p.id, p.name, p.is_active;
```

---

## 🔧 Maintenance

### Synchronisation automatique (Cron)

Pour mettre à jour automatiquement la radio depuis YouTube :

**Option 1 : Supabase Edge Function**
```typescript
// Créez une edge function qui appelle :
await supabase.rpc('sync_youtube_to_radio');
```

**Option 2 : Vercel Cron Job**
```typescript
// app/api/cron/sync-radio/route.ts
export async function GET() {
  await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/radio/sync`, {
    method: 'POST',
  });
  return new Response('OK');
}
```

Configurez dans `vercel.json` :
```json
{
  "crons": [{
    "path": "/api/cron/sync-radio",
    "schedule": "0 6 * * *"
  }]
}
```

### Backup des données

```sql
-- Exporter la configuration
COPY (SELECT * FROM radio_config) TO '/tmp/radio_config.csv' CSV HEADER;

-- Exporter les playlists
COPY (SELECT * FROM radio_playlists) TO '/tmp/radio_playlists.csv' CSV HEADER;

-- Exporter les pistes
COPY (SELECT * FROM radio_tracks) TO '/tmp/radio_tracks.csv' CSV HEADER;
```

---

## 🎉 Félicitations !

Votre radio Planète HMI est maintenant **100% opérationnelle** !

### Ce que vous avez maintenant :

✅ **Lecteur radio professionnel** avec préchargement intelligent
✅ **Panel d'administration complet** pour tout gérer
✅ **Synchronisation automatique** depuis YouTube
✅ **Support de playlists multiples** avec gestion visuelle
✅ **Statistiques** de lecture et d'audience
✅ **Mode auto-chart** pour les classements
✅ **Documentation complète** en français

### Prochaines étapes suggérées :

1. Ajoutez vos vraies URLs audio (extraction YouTube ou hébergement)
2. Créez plusieurs playlists thématiques
3. Activez la synchronisation automatique
4. Personnalisez les couleurs selon votre charte
5. Ajoutez des analytics avancés

**Besoin d'aide ?** Consultez :
- `RADIO_SETUP.md` - Documentation détaillée
- `RADIO_QUICK_START.md` - Guide rapide
- `RADIO_SUMMARY.md` - Vue d'ensemble

---

**Développé pour Planète HMI** 🎵
*Profitez de votre radio !*
