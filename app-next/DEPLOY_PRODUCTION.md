# 🚀 Déploiement Production - Radio System

**Plateforme:** Vercel  
**Base de données:** Supabase  
**Durée totale:** ~5 minutes  

---

## 📋 Étape 1: Exécuter la Migration Supabase (30 secondes)

### 1.1 - Accédez à Supabase

- Allez sur: https://supabase.com/dashboard
- Sélectionnez votre projet
- Cliquez sur: **SQL Editor**
- Cliquez sur: **New Query**

### 1.2 - Exécutez la Migration

1. Ouvrez le fichier: `app-next/supabase/migrations/20260817_radio_recovery.sql`
2. Copiez **TOUT** le contenu
3. Collez dans la requête Supabase
4. Appuyez sur: **Cmd+Enter** (ou Ctrl+Enter)

### 1.3 - Vérifiez le Succès

Vous devriez voir:
```
✅ Query successful
```

Et les résultats:
```
Radio System Recovery | config_count | is_live
Tables Created        | 6
RPC Functions         | 3
```

**Ne continuez pas si ça affiche une erreur!**

---

## 📋 Étape 2: Commiter et Pousser le Code (1 minute)

### 2.1 - Ajouter les Fichiers

```bash
cd app-next
git add -A
```

### 2.2 - Créer le Commit

```bash
git commit -m "feat: radio system production deployment with recovery migration

- Fixed TypeScript compilation errors (3 fixes)
- Added recovery migration for safe database setup
- All API endpoints tested and working
- Admin UI and radio player ready for production"
```

### 2.3 - Pousser le Code

```bash
git push origin main
```

**Attendez que Git affiche:**
```
To github.com:your-repo/app-next.git
   abc123..def456  main -> main
```

---

## 📋 Étape 3: Vercel Déploie Automatiquement (2-3 minutes)

### 3.1 - Allez sur Vercel Dashboard

- https://vercel.com/dashboard
- Sélectionnez votre projet Planète HMI
- Vous devriez voir un nouveau déploiement en cours

### 3.2 - Attendez la Fin

Vous verrez:
1. **"Building"** (1-2 minutes)
2. **"Deploying"** (30 secondes)
3. **"Ready"** ✅ (Vert, avec URL)

**Ne testez pas avant le "Ready"!**

### 3.3 - Vérifiez le Succès

Cliquez sur le déploiement et vérifiez:
- [ ] Status: ✅ Ready
- [ ] Pas d'erreurs de build
- [ ] Pas d'erreurs de déploiement

---

## 📋 Étape 4: Tester en Production (1-2 minutes)

### 4.1 - Page Admin Radio

**URL:** `https://votre-domaine.com/admin/radio`

Vérifiez:
- [ ] Page charge sans erreur 404
- [ ] Vous voyez la page Admin Radio
- [ ] Tabs visibles: Configuration, Playlists, Tracks, Statistics

### 4.2 - Voir les Classements

- Allez à l'onglet **Configuration**
- Vous devriez voir une liste de classements (Spotify, YouTube, etc)

### 4.3 - Appliquer une Source

1. Cliquez sur un classement dans la liste
2. Vous devriez voir les pistes en aperçu
3. Cliquez: **"✅ Appliquer cette source"**
4. Attendez le message de succès

### 4.4 - Tester la Lecture

1. Allez sur: `https://votre-domaine.com`
2. Cherchez la radio (bas-droite de la page)
3. Cliquez: ▶️ (Lecture)
4. Écoutez: La première piste devrait jouer
5. Attendez: La piste suivante devrait démarrer automatiquement

---

## ✅ Checklist de Succès

Tous les éléments ci-dessous doivent être cochés:

### Database
- [ ] Migration exécutée dans Supabase
- [ ] Pas d'erreur SQL
- [ ] Tables créées avec succès

### Code
- [ ] Git push réussi
- [ ] Vercel déploiement lancé
- [ ] Build réussi (pas d'erreurs)

### Production
- [ ] Admin page charge (`/admin/radio`)
- [ ] Classements visibles
- [ ] Aperçu des pistes marche
- [ ] "Appliquer" enregistre la config
- [ ] Radio joue sur home page
- [ ] Pas d'erreurs dans console (F12)

### Performance
- [ ] Page charge rapidement
- [ ] Audio joue sans lag
- [ ] Transition vers piste suivante fluide

---

## 🚨 Dépannage Production

### Erreur: Migration Supabase
**Symptôme:** Erreur SQL dans Supabase  
**Solution:**
1. Vérifiez l'erreur
2. Si c'est "MAX on boolean", utilisez version fixée
3. Exécutez de nouveau

### Erreur: Build Vercel
**Symptôme:** "Build failed" dans Vercel  
**Solution:**
1. Allez sur Vercel → Logs
2. Lisez le message d'erreur
3. Vérifiez TypeScript (devrait être 0 erreurs)
4. Retry le déploiement

### Erreur: Admin Page 404
**Symptôme:** Page non trouvée  
**Solution:**
1. Attendez le "Ready" complet
2. Rafraîchissez la page (Ctrl+F5)
3. Vérifiez l'URL exacte

### Erreur: Radio Ne Joue Pas
**Symptôme:** Clic play mais pas de son  
**Solution:**
1. Ouvrez DevTools (F12)
2. Allez à Console
3. Cherchez des erreurs rouges
4. Vérifiez que classement a des pistes
5. Vérifiez que audio_url n'est pas vide

---

## 📊 Résumé des Commandes

```bash
# 1. Naviguer dans le projet
cd app-next

# 2. Ajouter les fichiers
git add -A

# 3. Créer le commit
git commit -m "feat: radio system production deployment"

# 4. Pousser
git push origin main

# 5. Vérifier sur Vercel (pas de commande, juste aller sur le site)
# https://vercel.com/dashboard
```

---

## 🎯 Timeline

| Étape | Durée | Statut |
|-------|-------|--------|
| 1. Migration Supabase | 30s | ✅ |
| 2. Git add/commit/push | 1m | ✅ |
| 3. Vercel Build | 2-3m | ⏳ |
| 4. Tester Production | 1-2m | ✅ |
| **TOTAL** | **~5-7 min** | **🚀** |

---

## ✨ Vous Êtes Prêt!

**Le code est déjà compilé et prêt.**

Suivez les 4 étapes ci-dessus et vous serez en production dans ~5 minutes.

---

## 📞 Si Ça Marche Pas

1. Relisez les étapes
2. Vérifiez la migration d'abord
3. Attendez que Vercel finisse complètement
4. Testez dans une autre navigateur/incognito
5. Si toujours pas, contactez support

---

**Allons-y! Déploiement en production.** 🚀

