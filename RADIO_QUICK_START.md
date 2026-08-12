# 🚀 Démarrage Rapide - Radio Planète HMI

## Installation en 5 étapes

### 1️⃣ Appliquer la migration SQL

Connectez-vous à votre dashboard Supabase et exécutez :

```bash
# Via CLI Supabase
supabase migration up

# Ou copiez-collez le contenu de :
# supabase/migrations/20260811_radio_system.sql
# dans l'éditeur SQL de Supabase
```

### 2️⃣ Ajouter la fonction SQL manquante

Dans l'éditeur SQL de Supabase :

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

### 3️⃣ Intégrer le lecteur dans votre layout

Modifiez `src/app/layout.tsx` :

```typescript
import { RadioPlayer } from "@/components/radio/RadioPlayer";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        {children}
        
        {/* 🎵 Radio Player */}
        <RadioPlayer />
      </body>
    </html>
  );
}
```

### 4️⃣ Créer l'API route admin config

Créez `src/app/api/admin/radio/config/route.ts` :

```typescript
import { NextResponse } from "next/server";
import { ensureAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  await ensureAdmin();
  const supabase = await createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from("radio_config")
    .update(body)
    .eq("id", body.id || (await getFirstConfigId(supabase)))
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

async function getFirstConfigId(supabase: any) {
  const { data } = await supabase.from("radio_config").select("id").limit(1).single();
  return data?.id;
}
```

### 5️⃣ Ajouter des données de test

Dans l'éditeur SQL de Supabase :

```sql
-- Créer une playlist de test
INSERT INTO radio_playlists (name, description, is_default, is_active)
VALUES ('Playlist Test', 'Ma première playlist radio', true, true);

-- Récupérer l'ID de la playlist (copiez-le)
SELECT id, name FROM radio_playlists WHERE name = 'Playlist Test';

-- Ajouter quelques pistes de test
-- ⚠️ Remplacez les URLs par de vraies URLs audio
INSERT INTO radio_tracks (title, artist_name, audio_url, duration_seconds, source, is_active)
VALUES 
  ('Test Track 1', 'Artiste Test', 'https://example.com/track1.mp3', 180, 'manual', true),
  ('Test Track 2', 'Artiste Test', 'https://example.com/track2.mp3', 200, 'manual', true),
  ('Test Track 3', 'Artiste Test', 'https://example.com/track3.mp3', 220, 'manual', true);

-- Lier les pistes à la playlist
-- ⚠️ Remplacez PLAYLIST_ID par l'ID copié ci-dessus
INSERT INTO radio_playlist_tracks (playlist_id, track_id, position)
SELECT 
  'PLAYLIST_ID'::uuid,
  id,
  ROW_NUMBER() OVER (ORDER BY created_at)
FROM radio_tracks
WHERE source = 'manual';

-- Configurer la radio pour utiliser cette playlist
UPDATE radio_config
SET 
  active_playlist_id = 'PLAYLIST_ID'::uuid,
  auto_switch_to_chart = false,
  is_live = true;
```

## ✅ Vérification

1. **Démarrez votre serveur** : `npm run dev`
2. **Visitez votre site** : http://localhost:3000
3. **Vous devriez voir le lecteur radio** en bas de page
4. **Cliquez sur Play** ▶️

## 🎛️ Accéder à l'admin

```
http://localhost:3000/admin/radio
```

Vous aurez besoin d'être connecté en tant qu'admin.

## 🎵 Utiliser de vraies URLs audio

### Option 1 : Fichiers MP3 hébergés
```
https://votre-cdn.com/musique/ma-chanson.mp3
```

### Option 2 : URLs Audiomack (si vous avez l'API)
```typescript
// Exemple d'intégration
const audiomackUrl = await getAudiomackStreamUrl(trackId);
```

### Option 3 : YouTube (nécessite extraction serveur)
```typescript
// Utilisez ytdl-core ou similaire côté serveur
import ytdl from "ytdl-core";

export async function getYouTubeAudioUrl(videoId: string) {
  const info = await ytdl.getInfo(videoId);
  const audioFormats = ytdl.filterFormats(info.formats, "audioonly");
  return audioFormats[0].url;
}
```

## 🔥 Mode Auto-Chart (Avancé)

Pour diffuser automatiquement un classement :

1. **Créez des pistes depuis vos classements** :

```sql
-- Exemple : importer le top YouTube dans la radio
INSERT INTO radio_tracks (
  title,
  artist_name,
  artist_id,
  audio_url,
  cover_image_url,
  duration_seconds,
  source,
  source_id,
  is_active
)
SELECT
  v.title,
  a.name,
  v.artist_id,
  v.audio_stream_url,  -- ⚠️ À adapter selon votre schéma
  v.thumbnail_url,
  COALESCE(v.duration_seconds, 180),
  'chart',
  'youtube-week',
  true
FROM youtube_videos v
JOIN artists a ON a.id = v.artist_id
WHERE v.ranking_position <= 20
  AND v.audio_stream_url IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  audio_url = EXCLUDED.audio_url;
```

2. **Configurez la radio** (via l'admin ou SQL) :

```sql
UPDATE radio_config
SET 
  auto_switch_to_chart = true,
  chart_source_key = 'youtube-week',
  is_live = true;
```

3. **La radio jouera automatiquement** toutes les pistes de ce classement

## 🎨 Personnalisation rapide

### Changer les couleurs

Éditez `src/components/radio/RadioPlayer.module.css` :

```css
/* Ligne 16 : Background principal */
background: linear-gradient(
  180deg,
  rgba(10, 10, 30, 0.95) 0%,
  rgba(5, 5, 20, 0.98) 100%
);

/* Ligne 27 : Couleur de la lueur */
background: linear-gradient(
  90deg,
  transparent 0%,
  #8a2be2 20%,  /* 👈 Changez ici */
  #4169e1 50%,  /* 👈 Et ici */
  #8a2be2 80%,
  transparent 100%
);
```

### Désactiver le crossfade

Dans l'admin, configurez :
- **Durée du crossfade** : `0` ms

Ou via SQL :
```sql
UPDATE radio_config SET crossfade_duration_ms = 0;
```

## 🐛 Dépannage

### Le lecteur ne s'affiche pas
- Vérifiez que `<RadioPlayer />` est dans le layout
- Vérifiez la console pour les erreurs
- Vérifiez que la config radio existe dans la DB

### Aucune piste ne joue
- Vérifiez que `is_active = true` sur les pistes
- Vérifiez que `is_live = true` dans la config
- Vérifiez que les URLs audio sont valides
- Testez une URL dans le navigateur directement

### Erreur CORS sur les fichiers audio
- Les fichiers doivent être hébergés avec les bons headers CORS
- Ajoutez `Access-Control-Allow-Origin: *` sur votre serveur de fichiers
- Ou hébergez les fichiers sur le même domaine

### "No playlist found"
- Créez au moins une playlist
- Assignez-la dans la config radio
- Ou activez le mode auto-chart

## 📚 Documentation complète

Consultez **RADIO_SETUP.md** pour :
- Architecture détaillée
- API complète
- Gestion avancée
- Intégrations
- Analytics

## 🎉 C'est tout !

Votre radio est maintenant opérationnelle !

**Prochaines étapes suggérées :**
1. Ajoutez de vraies pistes avec de vraies URLs audio
2. Créez plusieurs playlists thématiques
3. Activez le mode auto-chart pour vos classements
4. Personnalisez le design selon votre charte graphique
5. Ajoutez des analytics pour suivre l'audience

**Besoin d'aide ?** Consultez le README principal ou la documentation Supabase.
