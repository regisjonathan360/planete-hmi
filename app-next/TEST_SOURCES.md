# 🧪 Test Sources - Debug

**Étape 1: Test endpoint public (pas d'auth)**

1. Ouvrez: https://votre-domaine.com/api/admin/radio/available-sources-public
2. Vous devriez voir JSON avec:
   - charts: [...]
   - sources: [...]
   - debug: {charts_count, sources_count, ...}

**Si vous voyez JSON:**
- ✅ La base de données fonctionne
- ✅ Les tables existent
- ⚠️ Problème: Authentification admin

**Si vous voyez erreur:**
- ❌ Problème: Base de données
- Lisez le message d'erreur exact

---

**Étape 2: Vérifier l'authentification**

Si le test public marche mais `/admin/radio` affiche erreur:

1. Vous êtes **connecté** à votre compte?
2. Votre compte est **admin** dans `user_roles`?

Pour vérifier:
- Allez à: https://supabase.com/dashboard
- SQL Editor → New Query
- Exécutez:
```sql
SELECT user_id, role FROM user_roles WHERE role = 'admin' LIMIT 10;
```

Vous devriez voir votre user_id avec role='admin'.

**Si votre user_id n'apparaît pas:**
- Vous n'êtes pas admin!
- Il faut vous ajouter

---

**Étape 3: Ajouter admin role (si besoin)**

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Remplacez `YOUR_USER_ID` par votre vrai ID (UUID).

---

**Après avoir testé, dites-moi:**
1. Le test public marche-t-il? (JSON visible?)
2. Quel est le message d'erreur exact en console (F12)?
3. Status code de la requête? (200, 401, 403, 500?)

