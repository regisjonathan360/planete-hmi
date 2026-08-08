# 🔧 Fix Google Analytics - Variable Vercel manquante

## Problème identifié

La variable `NEXT_PUBLIC_GA_MEASUREMENT_ID` est dans `.env.local` (local) mais **pas dans Vercel** (production).

---

## Solution : Ajouter la variable dans Vercel

### Option 1 : Via l'interface Vercel (5 minutes)

#### 1. Ouvrir Vercel Dashboard
👉 **https://vercel.com/dashboard**

#### 2. Sélectionner le projet
Clique sur **"planete-hmi"** (ou le nom exact de ton projet)

#### 3. Aller dans Settings
En haut, clique sur **"Settings"**

#### 4. Environment Variables
Dans le menu de gauche, clique sur **"Environment Variables"**

#### 5. Ajouter la variable
Clique sur **"Add New"** et remplis :

| Champ | Valeur |
|-------|--------|
| **Name** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| **Value** | `G-57C9XWTSYY` |

**Environments à cocher :**
- ☑️ **Production**
- ☑️ **Preview**  
- ☑️ **Development**

#### 6. Save
Clique sur **"Save"**

#### 7. Redéployer
**IMPORTANT** : La variable ne sera active qu'après un nouveau déploiement !

**Méthode A - Via l'interface :**
1. Va dans l'onglet **"Deployments"** (en haut)
2. Trouve le dernier déploiement
3. Clique sur les **3 points "..."**
4. Clique sur **"Redeploy"**
5. Confirme

**Méthode B - Via le terminal :**
```bash
cd "c:\Users\regis\Desktop\Projet planete HMI\app-next"
npx vercel --prod
```

---

### Option 2 : Via Vercel CLI (alternative)

Si tu préfères le terminal :

```bash
cd "c:\Users\regis\Desktop\Projet planete HMI\app-next"

# Installer Vercel CLI (si pas déjà fait)
npm i -g vercel

# Se connecter
vercel login

# Ajouter la variable
vercel env add NEXT_PUBLIC_GA_MEASUREMENT_ID

# Quand demandé :
# - Value: G-57C9XWTSYY
# - Environments: Production, Preview, Development

# Redéployer
vercel --prod
```

---

## Vérification après redéploiement

### 1. Vérifier la variable dans Vercel
1. **Settings** → **Environment Variables**
2. Tu devrais voir `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-57C9XWTSYY`

### 2. Tester sur le site
1. Ouvre **https://planete-hmi.vercel.app**
2. **F12** → Console
3. Tape : `window.gtag`
4. Tu devrais voir : `ƒ gtag(){...}` ✅

### 3. Vérifier dans Google Analytics
1. Ouvre **https://analytics.google.com**
2. **Rapports** → **Temps réel**
3. Ouvre ton site dans un autre onglet
4. **Accepte les cookies** : "Tout accepter"
5. Dans GA, tu devrais voir **"1 utilisateur en ce moment"**

---

## Pourquoi ça ne marchait pas ?

### Variables d'environnement Next.js

Next.js a **2 types** de variables :

#### 1. Variables serveur (privées)
```bash
SECRET_KEY=abc123
```
- Disponibles uniquement côté serveur
- Jamais envoyées au navigateur
- Sécurisées

#### 2. Variables publiques (NEXT_PUBLIC_*)
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-57C9XWTSYY
```
- Disponibles côté client (navigateur)
- Envoyées au navigateur
- **Doivent être dans Vercel pour la production**

### Le fichier .env.local

Le fichier `.env.local` ne fonctionne que **en local** (sur ton PC).

Pour la **production** (sur Vercel), il faut ajouter les variables dans :
- **Vercel Dashboard** → **Settings** → **Environment Variables**

---

## ✅ Checklist

- [ ] Variable ajoutée dans Vercel Dashboard
- [ ] Trois environnements cochés (Production, Preview, Development)
- [ ] Variable sauvegardée
- [ ] Site redéployé
- [ ] Attendre 2-3 minutes après le déploiement
- [ ] Tester : `window.gtag` dans la console
- [ ] Accepter les cookies sur le site
- [ ] Vérifier dans GA Temps réel

---

## 🆘 Si ça ne marche toujours pas

### Checklist de debug

1. **La variable est-elle dans Vercel ?**
   - Settings → Environment Variables
   - Cherche `NEXT_PUBLIC_GA_MEASUREMENT_ID`

2. **Le site a-t-il été redéployé APRÈS avoir ajouté la variable ?**
   - Les variables ne sont actives qu'après redéploiement

3. **As-tu attendu 2-3 minutes après le déploiement ?**
   - Les caches CDN peuvent prendre un peu de temps

4. **As-tu accepté les cookies sur le site ?**
   - Clique sur "Tout accepter" dans la bannière

5. **Es-tu sur le bon site ?**
   - https://planete-hmi.vercel.app (pas localhost)

6. **Es-tu dans la bonne propriété GA ?**
   - Vérifie que tu es dans "Planète HMI"
   - ID : G-57C9XWTSYY

### Commandes de debug

#### Dans la console du site (F12)
```javascript
// Vérifier que gtag existe
window.gtag

// Vérifier le dataLayer
window.dataLayer

// Forcer un événement de test
window.gtag('event', 'test_event', { test: true })
```

#### Vérifier les requêtes réseau
1. F12 → Onglet **"Réseau"** (Network)
2. Filtre : `gtag` ou `google-analytics`
3. Rafraîchis la page
4. Tu devrais voir des requêtes vers `www.google-analytics.com`

---

## 📞 Support

**Documentation Vercel Environment Variables :**
https://vercel.com/docs/projects/environment-variables

**Documentation Next.js Environment Variables :**
https://nextjs.org/docs/app/building-your-application/configuring/environment-variables

---

## 🎯 Résumé

1. **Problème** : Variable dans `.env.local` mais pas dans Vercel
2. **Solution** : Ajouter dans Vercel Settings → Environment Variables
3. **Important** : Redéployer après avoir ajouté la variable
4. **Test** : Vérifier `window.gtag` dans la console
5. **Validation** : Voir l'utilisateur dans GA Temps réel

**Temps estimé** : 5 minutes pour ajouter + 2 minutes de redéploiement = 7 minutes total
