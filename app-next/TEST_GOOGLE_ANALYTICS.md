# ✅ Test Google Analytics - Checklist

## 📊 Ton ID : G-57C9XWTSYY

---

## Test 1 : Vérifier que le code est chargé

### Étape 1 : Ouvrir le site
👉 **https://planete-hmi.vercel.app**

### Étape 2 : Ouvrir la console développeur
- Appuie sur **F12** (ou clic droit > Inspecter)
- Va dans l'onglet **"Console"**

### Étape 3 : Vérifier gtag
Dans la console, tape :
```javascript
window.gtag
```

**✅ Résultat attendu :** Tu devrais voir `ƒ gtag(){...}` (une fonction)  
**❌ Si undefined :** Le script GA n'est pas chargé

### Étape 4 : Vérifier dataLayer
Dans la console, tape :
```javascript
window.dataLayer
```

**✅ Résultat attendu :** Tu devrais voir un tableau `[...]` avec des objets  
**❌ Si undefined :** Le script GA n'est pas initialisé

---

## Test 2 : Vérifier les requêtes réseau

### Étape 1 : Ouvrir l'onglet Réseau
- Dans les outils développeur (F12)
- Clique sur l'onglet **"Réseau"** (Network)

### Étape 2 : Rafraîchir la page
- Appuie sur **Ctrl + F5** (ou Cmd + R sur Mac)
- Accepte les cookies quand la bannière apparaît : **"Tout accepter"**

### Étape 3 : Filtrer les requêtes
Dans la barre de filtre, tape : `gtag` ou `google-analytics`

**✅ Résultat attendu :**
- Tu devrais voir des requêtes vers `www.google-analytics.com/g/collect`
- Statut : **200 OK**
- Type : **img** ou **ping**

---

## Test 3 : Temps réel dans Google Analytics

### Étape 1 : Ouvrir Google Analytics
👉 **https://analytics.google.com**

### Étape 2 : Sélectionner ta propriété
- Clique sur **"Planète HMI"** (ou le nom que tu as donné)

### Étape 3 : Aller dans Temps réel
- Menu de gauche : **Rapports** > **Temps réel**

### Étape 4 : Naviguer sur le site
Dans un autre onglet :
1. Ouvre **https://planete-hmi.vercel.app**
2. **Accepte les cookies** : "Tout accepter"
3. Clique sur plusieurs pages :
   - Accueil
   - Artistes
   - Charts
   - Actualités

### Étape 5 : Vérifier dans GA
Dans le rapport Temps réel, tu devrais voir :

**✅ Ce que tu dois voir :**
- **"1 utilisateur en ce moment"** (ou plus si d'autres visitent)
- **Ton pays** (ex: Haïti, États-Unis, etc.)
- **Les pages** que tu consultes en temps réel
- **L'appareil** (Desktop, Mobile, etc.)

**Délai :** Les données apparaissent en **moins de 30 secondes**

---

## Test 4 : Vérifier le consentement RGPD

### Sans accepter les cookies
1. Ouvre le site en navigation privée
2. **NE PAS accepter les cookies** (ferme juste la bannière)
3. Vérifie la console (F12)

**✅ Résultat attendu :**
- `window.gtag` existe quand même
- Mais les requêtes vers GA sont **bloquées** ou **refusées**
- Dans GA Temps réel : **tu ne devrais PAS apparaître**

### Après avoir accepté les cookies
1. Clique sur **"Tout accepter"**
2. Vérifie la console

**✅ Résultat attendu :**
- Les requêtes vers `google-analytics.com` commencent
- Dans GA Temps réel : **tu apparais maintenant**

---

## Test 5 : Vérifier sur mobile (optionnel)

### Sur ton téléphone
1. Ouvre **https://planete-hmi.vercel.app**
2. Accepte les cookies
3. Navigue un peu

### Dans Google Analytics
- Va dans **Temps réel**
- Tu devrais voir :
  - **Plateforme** : Mobile
  - **Système d'exploitation** : Android ou iOS

---

## 🐛 Problèmes courants

### ❌ "Je ne vois rien dans Temps réel"

**Checklist :**
- [ ] As-tu accepté les cookies ? ("Tout accepter")
- [ ] As-tu attendu 30 secondes - 1 minute ?
- [ ] La variable est-elle bien dans Vercel Environment Variables ?
- [ ] Le site a-t-il été redéployé APRÈS avoir ajouté la variable ?
- [ ] Es-tu sur la bonne propriété GA ? (vérifie l'ID : G-57C9XWTSYY)

**Solutions :**
1. Vide le cache du navigateur (Ctrl + Shift + Suppr)
2. Essaye en navigation privée
3. Vérifie dans la console qu'il n'y a pas d'erreurs rouges
4. Attends 5-10 minutes (propagation des variables)

### ❌ "window.gtag est undefined"

**Causes possibles :**
- La variable n'est pas dans Vercel
- Le site n'a pas été redéployé
- Extension de navigateur qui bloque GA (ex: uBlock, AdBlock)

**Solutions :**
1. Vérifie Vercel : Settings > Environment Variables
2. Redéploie le site
3. Désactive les bloqueurs de pub temporairement

### ❌ "Les requêtes sont bloquées"

**Causes possibles :**
- Bloqueur de publicité actif
- Extension anti-tracking
- Cookies refusés

**Solutions :**
1. Désactive uBlock/AdBlock
2. Accepte les cookies sur le site
3. Essaye en navigation privée sans extensions

---

## 📊 Métriques disponibles après 24-48h

Une fois que GA collecte des données, tu pourras voir :

### Dans "Rapports" > "Acquisition" :
- D'où viennent tes visiteurs (Google, réseaux sociaux, direct, etc.)
- Quels mots-clés utilisent les gens pour te trouver

### Dans "Rapports" > "Engagement" :
- Pages les plus visitées
- Temps moyen sur le site
- Taux de rebond

### Dans "Rapports" > "Utilisateurs" :
- Pays des visiteurs
- Appareils utilisés (mobile, desktop)
- Navigateurs

### Dans "Rapports" > "Événements" :
- Page views automatiques
- (Tu pourras ajouter des événements personnalisés plus tard)

---

## 🎯 Checklist finale

- [ ] Site déployé avec la variable `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- [ ] `window.gtag` existe dans la console
- [ ] `window.dataLayer` existe dans la console
- [ ] Requêtes vers `google-analytics.com` visibles dans Network
- [ ] Cookies acceptés sur le site
- [ ] Visible dans GA Temps réel
- [ ] Pas d'erreurs dans la console
- [ ] Fonctionne sur mobile aussi

---

## 🚀 Prochaines étapes

### 1. Lier Google Analytics à Search Console
1. Dans GA : **Admin** > **Liens vers les produits**
2. **Liens Search Console** > **Associer**
3. Sélectionne ta propriété GSC
4. Confirme

### 2. Configurer des objectifs (optionnel)
Plus tard, tu pourras tracker :
- Clics sur "Écouter" (vers Spotify, YouTube, etc.)
- Ajout aux favoris
- Donations
- Soumissions d'artistes

### 3. Créer des audiences (optionnel)
Pour remarketing ou analyses :
- Visiteurs récurrents
- Fans d'un artiste spécifique
- Visiteurs d'un pays spécifique

---

## ✅ Résultat final

**Google Analytics 4 est maintenant actif** et collecte des données en temps réel !

📊 **Dashboard** : https://analytics.google.com  
🌐 **Ton site** : https://planete-hmi.vercel.app  
🔑 **Ton ID** : G-57C9XWTSYY

**Respect du RGPD ✅** : Les données ne sont collectées qu'après consentement explicite.
