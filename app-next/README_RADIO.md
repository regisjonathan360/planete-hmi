# 🎵 Radio Planète HMI - Vue d'ensemble

Un système de radio web complet et professionnel, inspiré de [Dynasty Haiti](https://dynastyhaiti.com/en), avec contrôle administrateur total et préchargement intelligent.

---

## 🎯 Fonctionnalités principales

### Pour les utilisateurs
- 🎵 **Lecteur fixe** en bas de toutes les pages
- 🌌 **Design cosmique** cohérent avec Planète HMI
- ⚡ **Préchargement intelligent** des prochaines pistes
- 🎛️ **Contrôles complets** : play, pause, suivant, précédent, volume
- 🔴 **Badge LIVE** pour indiquer la diffusion
- 🎨 **Pochette, titre, artiste** affichés en temps réel
- 📱 **Responsive** mobile et desktop

### Pour les administrateurs
- 🎛️ **Panel admin complet** à `/admin/radio`
- 📋 **Gestion des playlists** : créer, modifier, réorganiser
- 🎵 **Gestion des pistes** : ajouter, rechercher, filtrer
- ⚙️ **Configuration avancée** :
  - Mode playlist manuelle ou auto-chart
  - Nombre de pistes préchargées (1-10)
  - Durée du crossfade (0-10000ms)
  - Activation/désactivation
- 🔗 **Synchronisation YouTube** automatique
- 📊 **Statistiques** en temps réel

---

## 📁 Architecture

```
src/
├── lib/radio/
│   ├── types.ts                 # Types TypeScript
│   ├── queries.ts               # Requêtes Supabase
│   └── useRadioPlayer.ts        # Hook React + Howler.js
├── components/
│   ├── radio/
│   │   ├── RadioPlayer.tsx      # Lecteur (client)
│   │   └── RadioPlayer.module.css
│   └── admin/radio/
│       ├── RadioAdminDashboard.tsx
│       ├── RadioConfigPanel.tsx
│       ├── PlaylistManager.tsx
│       ├── TrackManager.tsx
│       └── RadioStatsPanel.tsx
└── app/
    ├── api/radio/
    │   ├── playlist/route.ts    # GET playlist active
    │   └── play/route.ts        # POST enregistrer écoute
    └── api/admin/radio/
        ├── config/route.ts      # PUT configuration
        ├── playlists/route.ts   # POST/GET playlists
        └── sync/route.ts        # POST sync YouTube

supabase/
├── migrations/
│   ├── 20260811_radio_system.sql           # Tables principales
│   └── 20260812_radio_youtube_sync.sql     # Fonctions sync
├── seed-radio.sql                          # Données de test
└── sync-youtube-to-radio.sql              # Script sync manuel
```

---

## 🚀 Installation rapide

### 1. Appliquer les migrations
```sql
-- Dans l'éditeur SQL de Supabase
-- Exécutez : supabase/migrations/20260811_radio_system.sql
-- Puis : supabase/migrations/20260812_radio_youtube_sync.sql
```

### 2. Le lecteur est déjà intégré
✅ `RadioPlayer` est déjà dans `layout.tsx`

### 3. Ajouter des données
```sql
-- Exécutez : supabase/seed-radio.sql
```

### 4. Démarrer
```bash
npm run dev
```

### 5. Visiter
- Site : http://localhost:3000 (le lecteur apparaît en bas)
- Admin : http://localhost:3000/admin/radio

---

## 📚 Documentation complète

| Document | Description |
|----------|-------------|
| **RADIO_INSTALLATION_COMPLETE.md** | 📖 Guide d'installation pas à pas détaillé |
| **RADIO_QUICK_START.md** | ⚡ Démarrage rapide en 5 minutes |
| **RADIO_SETUP.md** | 🔧 Documentation technique complète |
| **RADIO_SUMMARY.md** | 📋 Résumé et vue d'ensemble |

---

## 🎨 Personnalisation

### Changer les couleurs
Éditez `components/radio/RadioPlayer.module.css` :
- Ligne 16 : Background du lecteur
- Ligne 27 : Couleur de la lueur cosmique

### Ajuster le comportement
Dans `useRadioPlayer` :
```typescript
useRadioPlayer({
  autoPlay: true,      // Démarre automatiquement
  volume: 0.7,         // Volume initial (0-1)
  preloadCount: 3,     // Nombre de pistes préchargées
  crossfadeDuration: 2000  // Durée du fondu (ms)
})
```

---

## 🔗 Intégrations

### Synchroniser YouTube
```bash
# Via API
curl -X POST http://localhost:3000/api/admin/radio/sync

# Via SQL
-- Exécutez : supabase/sync-youtube-to-radio.sql
```

### Mode auto-chart
```sql
UPDATE radio_config
SET 
  auto_switch_to_chart = true,
  chart_source_key = 'youtube-week';
```

---

## 📊 Base de données

### Tables principales
- `radio_tracks` - Pistes audio disponibles
- `radio_playlists` - Playlists créées
- `radio_playlist_tracks` - Liaison playlists ↔ pistes
- `radio_config` - Configuration globale
- `radio_play_history` - Historique d'écoute
- `radio_stats` - Statistiques temps réel

### Fonctions RPC
- `sync_youtube_to_radio()` - Synchronise YouTube → Radio
- `get_chart_radio_tracks(chart_key)` - Récupère pistes d'un classement
- `increment_track_play_count(track_id)` - Incrémente compteur

---

## 🛠️ Stack technique

- **Next.js 16** - Framework React
- **Supabase** - Base de données PostgreSQL + Realtime
- **Howler.js** - Lecteur audio robuste
- **TypeScript** - Typage strict
- **CSS Modules** - Styles scoped

---

## ⚡ Performance

- **Préchargement intelligent** : 3 pistes en avance par défaut
- **Crossfade** : transitions fluides entre pistes
- **Lazy loading** : composants chargés à la demande
- **Indexes SQL** : requêtes optimisées
- **RLS Policies** : sécurité des données

---

## 🐛 Dépannage

### Le lecteur ne s'affiche pas
1. Vérifiez que `<RadioPlayer />` est dans `layout.tsx` ✅
2. Vérifiez la console navigateur
3. Vérifiez qu'il y a une config radio dans la DB

### Aucune piste ne joue
1. Vérifiez que les pistes ont `is_active = true`
2. Vérifiez que la config a `is_live = true`
3. Testez les URLs audio dans le navigateur
4. Vérifiez les CORS si hébergement externe

### Erreur "No playlist found"
```sql
-- Créez une playlist et configurez-la
INSERT INTO radio_playlists (name, is_active) VALUES ('Ma Playlist', true);
UPDATE radio_config SET active_playlist_id = (SELECT id FROM radio_playlists LIMIT 1);
```

---

## 📈 Prochaines fonctionnalités

- [ ] Upload de fichiers audio
- [ ] Drag & drop pour réorganiser playlists
- [ ] Visualisations de statistiques avancées
- [ ] Synchronisation WebSocket temps réel
- [ ] File d'attente utilisateur
- [ ] Favoris et historique par utilisateur
- [ ] Podcasts et émissions

---

## 🎯 Exemples d'utilisation

### Radio du top YouTube
```typescript
// Synchroniser automatiquement le top 50 YouTube
await fetch('/api/admin/radio/sync', {
  method: 'POST',
  body: JSON.stringify({ limit: 50 })
});
```

### Playlist thématique
```sql
-- Créer une playlist Konpa
INSERT INTO radio_playlists (name, description) 
VALUES ('Konpa Classics', 'Les meilleurs hits konpa');
```

### Mode découverte artistes
```sql
-- Playlist avec nouveaux artistes
INSERT INTO radio_playlists (name, shuffle_enabled)
VALUES ('Découvertes', true);
```

---

## 📞 Support

Pour toute question :
1. Consultez la documentation complète
2. Vérifiez les logs serveur et console
3. Consultez la doc Howler.js : https://howlerjs.com/
4. Consultez la doc Supabase : https://supabase.com/docs

---

## ✅ État actuel

🟢 **Système complet et prêt à l'emploi**

- [x] Base de données (migrations + fonctions)
- [x] Composant lecteur radio
- [x] Panel d'administration
- [x] Routes API
- [x] Intégration YouTube
- [x] Documentation complète
- [x] Intégration dans le layout
- [x] Scripts de seed

**Il ne reste qu'à :**
1. Appliquer les migrations SQL
2. Ajouter des données (test ou YouTube)
3. Tester !

---

**Radio Planète HMI** 🎵
*Diffusez la meilleure musique haïtienne en continu*
