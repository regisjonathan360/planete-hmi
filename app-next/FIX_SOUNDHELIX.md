# 🔧 FIX: Vous Voyez Toujours SoundHelix

**Symptôme:** Admin radio affiche les pistes de test (SoundHelix)  
**Cause:** Données fictives en base de données  
**Solution:** 2 migrations à exécuter

---

## 🎯 Diagnostic

**Actuellement:** Base contient mélange données réelles + test  
**Visé:** Base contient UNIQUEMENT données réelles

---

## 🚀 Solution (2 étapes - 1 minute)

### ÉTAPE 1: Récupérer le Cleanup Script

✅ **Le script existe déjà!** Il vient d'être créé et pushé.

**Fichier:** `supabase/migrations/20260818_clean_dummy_data.sql`

---

### ÉTAPE 2: Exécuter dans Supabase (30 secondes)

1. **Supabase Dashboard:** https://supabase.com/dashboard
2. **SQL Editor → New Query**
3. **Copier:** `supabase/migrations/20260818_clean_dummy_data.sql`
4. **Coller** dans Supabase
5. **Cmd+Enter**
6. **Attendre:** ✅ Query successful

---

## ✅ Vérification

Après exécution, vous devriez voir:
```
CLEANUP COMPLETE
remaining_tracks: 0
remaining_playlists: 0
```

---

## 📊 Après Nettoyage

1. **Rafraîchissez** admin page: `/admin/radio`
2. **Attendez** 5 secondes de refresh
3. **Maintenant** vous devriez voir:
   - ❌ PAS de SoundHelix
   - ✅ Liste vide (ou vrais classements si vous en avez créé)

---

## 🎯 Prochaines Actions

### Si Admin Page Vide
✅ **C'est normal!** Il faut sélectionner un classement réel.

1. Allez à `Configuration` tab
2. Devriez voir classements réels (Spotify, YouTube, etc)
3. Cliquez sur un classement
4. Cliquez "✅ Appliquer"

### Si Admin Page Encore Pleine de SoundHelix
❌ **Le cleanup n'a pas marché**

Solutions:
1. Vérifiez que vous avez exécuté `20260818_clean_dummy_data.sql`
2. Vérifiez qu'il n'y a pas d'erreur SQL
3. Rafraîchissez la page (Ctrl+F5)

---

## 🧹 Ce Que le Script Fait

✅ Supprime toutes les pistes avec "test", "demo", "soundhelix" dans le titre  
✅ Supprime toutes les playlists de test  
✅ Vide l'historique de lecture  
✅ Réinitialise la configuration  
✅ Vérifie le résultat

---

## 📝 Avant/Après

### AVANT (Actuellement)
```
❌ SoundHelix Track 1
❌ SoundHelix Track 2
❌ SoundHelix Track 3
... (50+ pistes de test)
```

### APRÈS (Après nettoyage)
```
✅ (Aucune piste fictive)
✅ (Base vide, prête pour vraies données)
```

---

## 🎉 Résumé

1. **Exécuter:** `20260818_clean_dummy_data.sql` (30 sec)
2. **Rafraîchir:** Page admin (5 sec)
3. **Vérifier:** Plus de SoundHelix (instant)
4. **Félicitations!** ✅ Radio prête pour vraies données

---

**Allez nettoyer maintenant!** 🧹

