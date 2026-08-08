# 🚀 Configuration Google Analytics dans Vercel

## Ton ID Google Analytics
```
G-57C9XWTSYY
```

## 📋 Étapes à suivre (2 minutes)

### 1. Ouvrir Vercel Dashboard
👉 **https://vercel.com/dashboard**

### 2. Sélectionner ton projet
- Clique sur le projet **"planete-hmi"** (ou "planete-hmi" selon le nom)

### 3. Aller dans Settings
- Clique sur l'onglet **"Settings"** (dans le menu du haut)

### 4. Aller dans Environment Variables
- Dans le menu de gauche, clique sur **"Environment Variables"**

### 5. Ajouter la variable
Clique sur **"Add New"** ou **"Add"** et remplis :

| Champ | Valeur |
|-------|--------|
| **Key (Name)** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| **Value** | `G-57C9XWTSYY` |
| **Environments** | ☑️ Production<br>☑️ Preview<br>☑️ Development |

### 6. Sauvegarder
- Clique sur **"Save"**

### 7. Redéployer le site
**Option A - Via l'interface Vercel :**
1. Va dans l'onglet **"Deployments"**
2. Trouve le dernier déploiement
3. Clique sur les **3 points "..."** à droite
4. Clique sur **"Redeploy"**
5. Confirme en cliquant sur **"Redeploy"**

**Option B - Via le terminal (plus rapide) :**
```bash
cd "c:\Users\regis\Desktop\Projet planete HMI\app-next"
echo y | npx vercel --prod
```

### 8. Attendre la fin du déploiement
- Attends 1-2 minutes que le déploiement se termine
- Tu verras "✅ Ready" quand c'est fini

---

## ✅ Vérification

### 1. Tester que GA fonctionne
1. Ouvre **https://planete-hmi.vercel.app**
2. **IMPORTANT** : Clique sur **"Tout accepter"** dans la bannière cookies
3. Navigue sur quelques pages
4. Ouvre la console du navigateur (F12)
5. Va dans l'onglet **"Réseau"** (Network)
6. Cherche des requêtes vers `google-analytics.com` ou `gtag`

### 2. Vérifier dans Google Analytics
1. Va sur **https://analytics.google.com**
2. Sélectionne ta propriété **"Planète HMI"**
3. Dans le menu de gauche : **Rapports** > **Temps réel**
4. Tu devrais voir **"1 utilisateur en ce moment"** avec ta visite

**Si tu ne vois rien :**
- Attends 2-3 minutes (temps de propagation)
- Vide le cache du navigateur (Ctrl + Shift + Suppr)
- Réessaye en navigation privée

---

## 🎯 Résultat attendu

Une fois configuré, Google Analytics trackera automatiquement :
- ✅ Pages vues
- ✅ Temps passé sur le site
- ✅ Navigations entre pages
- ✅ Localisation des visiteurs
- ✅ Appareils utilisés
- ✅ Sources de trafic

**Et tout ça en respectant le RGPD** grâce au système de consentement déjà en place ! 🎉

---

## 🆘 Besoin d'aide ?

Si tu as un problème :
1. Vérifie que la variable est bien sauvegardée dans Vercel
2. Vérifie que le site a bien été redéployé
3. Vérifie que tu as accepté les cookies sur le site
4. Attends 5-10 minutes après le déploiement

---

## 📊 Prochaine étape importante

Une fois que GA fonctionne, n'oublie pas de **lier Google Analytics à Google Search Console** :

1. Dans Google Analytics : **Admin** (⚙️)
2. Colonne de droite : **Liens vers les produits**
3. Clique sur **"Liens Search Console"**
4. Clique sur **"Associer"**
5. Sélectionne ta propriété Search Console
6. Confirme

Cela te donnera des données SEO directement dans Analytics ! 🚀
