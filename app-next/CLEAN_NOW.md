# 🧹 NETTOYER LES PISTES DE TEST

**Problème:** Vous voyez toujours "SoundHelix" et autres pistes de test  
**Cause:** Données fictives encore en base  
**Solution:** Exécuter le script de nettoyage

---

## 🎯 Faire Maintenant (30 secondes)

1. **Supabase Dashboard:** https://supabase.com/dashboard
2. **SQL Editor → New Query**
3. **Ouvrez:** `supabase/migrations/20260818_clean_dummy_data.sql`
4. **Copiez TOUT**
5. **Collez** dans Supabase
6. **Cmd+Enter**
7. **Attendez:** ✅ Query successful

---

## ✅ Résultat Attendu

Vous devriez voir:
```
CLEANUP COMPLETE
remaining_tracks: 0
remaining_playlists: 0
```

---

## 📊 Après Nettoyage

1. Rafraîchissez la page admin: `/admin/radio`
2. Vous ne devriez **PAS** voir SoundHelix
3. Vous devriez voir les **vrais classements** (Spotify, YouTube, etc)

---

## 🚀 Prochaine Étape

Après nettoyage:
1. Sélectionnez un classement réel
2. Cliquez "✅ Appliquer"
3. Testez la radio

---

**Let's clean this up!** 🧹

