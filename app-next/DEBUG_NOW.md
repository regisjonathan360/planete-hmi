# 🔍 DEBUG - Erreur Chargement Sources

**Vous voyez:** "Erreur de chargement" pour toutes les sources  
**Solution:** Diagnostic rapide

---

## 🚀 Test 1: Endpoint Public (30 sec)

1. Ouvrez dans navigateur:
```
https://votre-domaine.com/api/admin/radio/available-sources-public
```

2. Vous devriez voir:
```json
{
  "charts": [...],
  "sources": [...],
  "debug": {...}
}
```

**Si vous voyez JSON:**
- ✅ Base de données OK
- ⚠️ Problème: Vous n'êtes pas admin
- **Allez à Test 2**

**Si vous voyez erreur JSON:**
- ❌ Base de données a problème
- Lisez le message d'erreur
- **Contactez moi avec le message**

---

## 🧪 Test 2: Vérifier Votre Rôle Admin

1. **Supabase Dashboard:** https://supabase.com/dashboard
2. **SQL Editor → New Query**
3. Exécutez:
```sql
SELECT user_id, role FROM user_roles WHERE role = 'admin';
```

4. **Vous voyez votre user_id?**
   - ✅ OUI → Vous êtes admin
   - ❌ NON → Il faut vous ajouter (voir Test 3)

---

## 🔧 Test 3: Ajouter Rôle Admin (Si besoin)

1. **SQL Editor → New Query**
2. Copiez et exécutez:
```sql
-- Remplacez YOUR_USER_ID par votre ID (copié de Session ci-dessous)
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

3. **Où trouver YOUR_USER_ID?**
   - Supabase Dashboard → Account → Session
   - Copier le `sub` (c'est votre user_id)

4. **Après insertion:**
   - Rafraîchissez `/admin/radio`
   - Ça devrait marcher maintenant!

---

## 📊 Résumé

| Test | Résultat | Action |
|------|----------|--------|
| Endpoint public | ✅ JSON | Vous n'êtes pas admin → Test 2 |
| Endpoint public | ❌ Erreur | Base problème → Contact moi |
| user_roles | ✅ Votre ID | Vous êtes admin → Testez /admin/radio |
| user_roles | ❌ Vide | Ajoutez rôle → Test 3 |

---

**Testez d'abord l'endpoint public et dites-moi le résultat!** 🔍

