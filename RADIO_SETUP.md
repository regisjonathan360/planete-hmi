# 🎵 Système de Radio Planète HMI

## Vue d'ensemble

Un système de radio web complet et professionnel pour diffuser de la musique sur votre site, avec :

- **Lecteur radio fixe** en bas de page avec design cosmique
- **Panel d'administration** complet pour gérer toute la radio
- **Préchargement intelligent** des pistes pour des transitions fluides
- **Mode auto-chart** pour diffuser automatiquement un classement
- **Crossfade** entre les pistes
- **Statistiques** de lecture et d'audience

---

## 📁 Structure des fichiers créés

### Migration de base de données
```
supabase/migrations/
└── 20260811_radio_system.sql  # Tables et fonctions SQL
```

### Bibliothèques (lib)
```
src/lib/radio/
├── types.ts                    # Types TypeScript
├── queries.ts                  # Requêtes Supabase
└── useRadioPlayer.ts          # Hook React pour le lecteur
```

### Composants
```
src/components/radio/
├── RadioPlayer.tsx            # Lecteur radio (client)
└── RadioPlayer.module.css     # Styles du lecteur

src/components/admin/radio/
├── RadioAdminDashboard.tsx           # Dashboard admin principal
├── RadioAdminDashboard.module.css
├── RadioConfigPanel.tsx              # Configuration de la radio
├── RadioConfigPanel.module.css
├── PlaylistManager.tsx               # Gestion des playlists (à créer)
├── TrackManager.tsx                  # Gestion des pistes (à créer)
└── RadioStatsPanel.tsx               # Statistiques (à créer)
```

### Routes API
```
src/app/api/radio/
├── playlist/route.ts          # GET playlist active
└── play/route.ts             # POST enregistrer écoute

src/app/api/admin/radio/
└── config/route.ts           # PUT configuration (à créer)
```

### Pages
```
src/app/admin/radio/
└── page.tsx                   # Page admin de la radio
```

---

## 🚀 Installation

### 1. Appliquer la migration Supabase

```bash
# Si vous utilisez Supabase CLI
supabase migration up

# Ou appliquez manuellement le SQL depuis :
# supabase/migrations/20260811_radio_system.sql
```

### 2. Ajouter la fonction SQL manquante

La fonction `increment_track_play_count` doit être créée dans Supabase :

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

### 3. Intégrer le lecteur dans le layout

Ajoutez le `RadioPlayer` dans votre layout principal :

```tsx
// src/app/layout.tsx
import { RadioPlayer } from "@/components/radio/RadioPlayer";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <RadioPlayer />  {/* Ajoutez ceci */}
      </body>
    </html>
  );
}
```

### 4. Créer les routes API admin manquantes

#### `/api/admin/radio/config/route.ts`

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
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

---

## 🎯 Fonctionnalités principales

### 1. Modes de diffusion

#### Mode Playlist manuelle
- Créez des playlists personnalisées
- Ajoutez/retirez des pistes manuellement
- Ordre personnalisable
- Shuffle et repeat

#### Mode Auto-chart
- Diffuse automatiquement un classement
- Exemple : `youtube-week`, `audiomack-top`
- Se met à jour quand le classement change
- Parfait pour toujours diffuser le top actuel

### 2. Préchargement intelligent

Le système précharge automatiquement les prochaines pistes :
- Par défaut : 3 pistes en avance
- Configurable dans l'admin
- Économise la bande passante
- Garantit des transitions sans coupure

### 3. Crossfade (fondu enchaîné)

Transitions fluides entre les pistes :
- Durée configurable (0 à 10 000 ms)
- 2000 ms par défaut (2 secondes)
- 0 ms = transition instantanée

### 4. Statistiques

Le système enregistre :
- Historique de lecture
- Compteur d'écoutes par piste
- Nombre d'auditeurs en temps réel (à implémenter via WebSocket)

---

## 🛠️ Utilisation Admin

### Accéder au panel admin

```
https://votre-site.com/admin/radio
```

### Configuration de base

1. **Choisir le mode**
   - Playlist manuelle : sélectionnez une playlist créée
   - Auto-chart : entrez la `source_key` du classement

2. **Régler le préchargement**
   - 1-3 pistes : économe en bande passante
   - 3-5 pistes : très fluide, consomme plus

3. **Configurer le crossfade**
   - 0 ms : changement brutal (style radio)
   - 2000 ms : transition douce (recommandé)
   - 5000 ms : très progressif

4. **Activer la radio**
   - Cochez "Radio en direct (LIVE)"
   - Le lecteur apparaît sur toutes les pages

### Gérer les playlists

1. Créer une nouvelle playlist
2. Ajouter des pistes (manuelles ou depuis les classements)
3. Réorganiser l'ordre
4. Activer/désactiver

### Ajouter des pistes

Sources possibles :
- **Manuel** : upload ou URL directe
- **Chart** : importer depuis un classement
- **YouTube** : liens vers vos vidéos musicales
- **Audiomack / Spotify** : intégrations API

---

## 🎨 Personnalisation du design

### Modifier les couleurs

Éditez `RadioPlayer.module.css` :

```css
/* Couleurs principales */
.radioPlayer {
  background: linear-gradient(
    180deg,
    rgba(10, 10, 30, 0.95) 0%,    /* Changez ici */
    rgba(5, 5, 20, 0.98) 100%
  );
}

/* Effet cosmique */
.cosmicGlow {
  background: linear-gradient(
    90deg,
    transparent 0%,
    #8a2be2 20%,   /* Violet principal */
    #4169e1 50%,   /* Bleu */
    #8a2be2 80%,
    transparent 100%
  );
}
```

### Changer la position

Par défaut : fixe en bas. Pour changer :

```css
.radioPlayer {
  position: fixed;
  bottom: 0;     /* ou top: 0 pour le haut */
  left: 0;
  right: 0;
}
```

---

## 🔗 Intégration avec les classements

### Lier un classement à la radio

1. Récupérez la `source_key` de votre classement
   - Exemple : `youtube-week`, `audiomack-month`

2. Créez des pistes radio depuis le classement :

```sql
-- Exemple : importer les vidéos YouTube dans la radio
INSERT INTO radio_tracks (
  title,
  artist_name,
  audio_url,
  cover_image_url,
  duration_seconds,
  source,
  source_id,
  artist_id
)
SELECT
  v.title,
  a.name,
  v.audio_stream_url,      -- À adapter selon votre structure
  v.thumbnail_url,
  v.duration_seconds,
  'youtube',
  'youtube-week',          -- source_key du classement
  v.artist_id
FROM youtube_videos v
JOIN artists a ON a.id = v.artist_id
WHERE v.ranking_position <= 50
  AND v.audio_stream_url IS NOT NULL;
```

3. Activez le mode auto-chart dans l'admin
4. Entrez `youtube-week` comme `chart_source_key`

### Automatiser avec un cron

Mettez à jour la radio chaque semaine :

```typescript
// Edge Function Supabase ou cron externe
export async function syncRadioFromChart() {
  const { data: videos } = await supabase
    .from("youtube_videos")
    .select("*")
    .lte("ranking_position", 50)
    .not("audio_stream_url", "is", null);

  for (const video of videos) {
    await supabase.from("radio_tracks").upsert({
      id: video.id,
      title: video.title,
      artist_name: video.artist_name,
      audio_url: video.audio_stream_url,
      cover_image_url: video.thumbnail_url,
      duration_seconds: video.duration_seconds,
      source: "youtube",
      source_id: "youtube-week",
      artist_id: video.artist_id,
    });
  }
}
```

---

## 🎵 Sources audio supportées

### URLs directes (MP3, OGG, WebM)
```typescript
{
  audio_url: "https://cdn.example.com/track.mp3"
}
```

### YouTube (via extraction)
```typescript
{
  audio_url: "https://youtube.com/watch?v=...",
  // Nécessite une extraction côté serveur
}
```

### Streaming services
- Audiomack
- SoundCloud
- Spotify (via API)

---

## 📊 Métriques et analytics

### Données collectées

1. **Historique de lecture** (`radio_play_history`)
   - Quelle piste a été jouée
   - Quand
   - Combien d'auditeurs
   - Complétée ou skippée

2. **Compteurs de lecture** (`radio_tracks.play_count`)
   - Nombre total d'écoutes par piste
   - Permet de calculer les tops

3. **Stats en temps réel** (`radio_stats`)
   - Piste en cours
   - Nombre d'auditeurs actifs
   - Horodatage de début

### Implémenter le comptage d'auditeurs

Pour compter les auditeurs en temps réel, utilisez Supabase Realtime :

```typescript
// Côté client
const channel = supabase
  .channel("radio-listeners")
  .on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const count = Object.keys(state).length;
    // Mettre à jour le compteur
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ online_at: new Date().toISOString() });
    }
  });
```

---

## 🐛 Débogage

### La radio ne charge pas

1. Vérifiez que la migration SQL est appliquée
2. Vérifiez qu'il y a des pistes dans `radio_tracks`
3. Vérifiez que `radio_config` a une entrée
4. Vérifiez la console navigateur pour les erreurs

### Les pistes ne se chargent pas

1. Testez les URLs audio directement dans un navigateur
2. Vérifiez les CORS si hébergement externe
3. Vérifiez que `is_active = true` sur les pistes
4. Regardez les logs côté serveur

### Le préchargement ne fonctionne pas

1. Vérifiez `preload_count` dans la config
2. Vérifiez que Howler.js peut charger les fichiers
3. Testez avec `preload_count = 1` d'abord
4. Vérifiez la bande passante réseau

---

## 🚀 Améliorations futures

### Court terme
- [ ] Composants `PlaylistManager` et `TrackManager` complets
- [ ] Upload de fichiers audio
- [ ] Éditeur de métadonnées des pistes
- [ ] Prévisualisation audio dans l'admin

### Moyen terme
- [ ] Shuffle et repeat utilisateur
- [ ] File d'attente personnalisée
- [ ] Favoris et historique utilisateur
- [ ] Partage social de la piste en cours

### Long terme
- [ ] Podcasts et emissions
- [ ] Animateurs et créneaux horaires
- [ ] Publicités programmées
- [ ] Analytics avancés
- [ ] Application mobile

---

## 📝 Licence et crédits

Système de radio développé pour **Planète HMI**

**Technologies utilisées :**
- Next.js 16
- Supabase (PostgreSQL + Realtime)
- Howler.js (lecteur audio)
- React Icons

**Inspiré par :**
- Dynasty Haiti Radio (https://dynastyhaiti.com/en)

---

## 📞 Support

Pour toute question ou problème :
1. Consultez ce README
2. Vérifiez la documentation Supabase
3. Consultez la doc Howler.js : https://howlerjs.com/

---

## ✅ Checklist de déploiement

- [ ] Migration SQL appliquée sur Supabase
- [ ] Fonction `increment_track_play_count` créée
- [ ] Au moins 1 playlist créée avec des pistes
- [ ] Configuration radio définie (mode + playlist/chart)
- [ ] `RadioPlayer` ajouté au layout
- [ ] Routes API admin créées
- [ ] Permissions RLS configurées
- [ ] Tests sur mobile et desktop
- [ ] URLs audio accessibles et valides
- [ ] Badge LIVE activé si souhaité

**Félicitations ! 🎉 Votre radio est prête à diffuser !**
