# 📊 Guide complet : Configuration Google Analytics 4

## Étape 1 : Créer un compte Google Analytics

### 1.1 Accéder à Google Analytics
1. Va sur : **https://analytics.google.com**
2. Connecte-toi avec ton compte Google
3. Si c'est ta première fois, clique sur **"Commencer à mesurer"**
4. Si tu as déjà un compte, clique sur **"Admin"** (⚙️ en bas à gauche)

---

## Étape 2 : Créer une propriété GA4

### 2.1 Configuration du compte
Si tu crées un nouveau compte :
1. **Nom du compte** : `Planète HMI` (ou ce que tu veux)
2. Coche les cases de partage de données (optionnel)
3. Clique sur **"Suivant"**

### 2.2 Configuration de la propriété
1. **Nom de la propriété** : `Planète HMI - Site Web`
2. **Fuseau horaire** : Sélectionne `(GMT-05:00) Heure de l'Est (États-Unis et Canada)` ou ton fuseau
3. **Devise** : `Dollar américain (USD)` ou `Gourde haïtienne (HTG)`
4. Clique sur **"Suivant"**

### 2.3 Informations sur l'entreprise
1. **Secteur d'activité** : `Arts et divertissement` > `Musique`
2. **Taille de l'entreprise** : Choisis selon ta situation
3. **Comment comptez-vous utiliser Google Analytics** :
   - ☑️ Examiner le comportement des utilisateurs
   - ☑️ Mesurer les performances publicitaires (optionnel)
4. Clique sur **"Créer"**
5. Accepte les conditions d'utilisation

---

## Étape 3 : Configurer le flux de données Web

### 3.1 Créer un flux de données
Après avoir créé la propriété, tu verras "Configurer votre flux de données" :

1. Clique sur **"Web"** (icône de navigateur)

### 3.2 Configurer le flux Web
Remplis les informations :

1. **URL du site Web** : `https://planete-hmi.vercel.app`
2. **Nom du flux** : `Planète HMI - Production`
3. Clique sur **"Créer un flux"**

---

## Étape 4 : Récupérer ton Measurement ID

### 4.1 Copier l'ID de mesure
Après avoir créé le flux, tu verras une page avec :

```
ID de mesure
G-XXXXXXXXXX
```

**C'EST CE CODE QUE TU DOIS COPIER !**

Il ressemble à : `G-ABC123XYZ9` (commence toujours par `G-`)

### 4.2 Où le trouver plus tard
Si tu fermes la page :
1. Va dans **Admin** (⚙️ en bas à gauche)
2. Colonne du milieu : **Propriété** > **Flux de données**
3. Clique sur ton flux Web
4. Tu verras **"ID de mesure : G-XXXXXXXXXX"** en haut

---

## Étape 5 : Ajouter l'ID dans ton projet

### 5.1 Ouvrir le fichier .env.local
Dans le dossier `app-next`, ouvre (ou crée) le fichier `.env.local`

### 5.2 Ajouter la variable
Ajoute cette ligne en remplaçant `G-XXXXXXXXXX` par ton vrai ID :

```bash
# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**EXEMPLE CONCRET :**
```bash
# Google Analytics 4
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-ABC123XYZ9
```

### 5.3 Sauvegarder le fichier
Sauvegarde le fichier `.env.local`

---

## Étape 6 : Déployer sur Vercel

### 6.1 Option A : Via les variables d'environnement Vercel (RECOMMANDÉ)

**Dans le dashboard Vercel :**
1. Va sur https://vercel.com/dashboard
2. Clique sur ton projet **"planete-hmi"**
3. Va dans **Settings** > **Environment Variables**
4. Ajoute une nouvelle variable :
   - **Key** : `NEXT_PUBLIC_GA_MEASUREMENT_ID`
   - **Value** : `G-XXXXXXXXXX` (ton ID)
   - **Environments** : Coche **Production**, **Preview**, **Development**
5. Clique sur **Save**

**Redéployer :**
- Va dans l'onglet **Deployments**
- Clique sur les 3 points **"..."** du dernier déploiement
- Clique sur **"Redeploy"**
- Attends la fin du déploiement

### 6.2 Option B : Via Git (alternative)

**Si tu préfères utiliser Git :**

```bash
# Dans le terminal, dans le dossier app-next
cd "c:\Users\regis\Desktop\Projet planete HMI\app-next"

# Ajouter le fichier .env.local (il ne sera pas commité car dans .gitignore)
# Puis commit et push les autres changements si nécessaire

# Vercel redéployera automatiquement
```

**⚠️ IMPORTANT :** Le fichier `.env.local` ne doit **JAMAIS** être commité dans Git. Il est déjà dans `.gitignore`.

---

## Étape 7 : Vérifier que ça fonctionne

### 7.1 Tester en temps réel
1. Retourne dans Google Analytics
2. Menu de gauche : **Rapports** > **Temps réel**
3. Ouvre ton site : https://planete-hmi.vercel.app
4. Dans les **30 secondes**, tu devrais voir :
   - **1 utilisateur actif**
   - La page que tu consultes
   - Ton pays

### 7.2 Accepter les cookies
**IMPORTANT** : N'oublie pas d'accepter les cookies sur le site pour que GA fonctionne !
1. Ouvre https://planete-hmi.vercel.app
2. Clique sur **"Tout accepter"** dans la bannière cookies
3. Navigue sur le site
4. Vérifie dans GA Temps réel

---

## Étape 8 : Configuration recommandée

### 8.1 Exclure le trafic interne (optionnel)
Pour ne pas compter tes propres visites :

1. **Admin** > **Flux de données** > Clique sur ton flux
2. Descends jusqu'à **"Paramètres de marquage"**
3. Clique sur **"Afficher tout"**
4. Active **"Exclure le trafic provenant d'adresses IP spécifiques"**
5. Ajoute ton adresse IP (cherche "quelle est mon ip" sur Google)

### 8.2 Activer les signaux Google (recommandé)
1. **Admin** > **Paramètres des données** > **Collecte de données**
2. Active **"Signaux Google"** (pour remarketing et rapports démographiques)

### 8.3 Lier à Google Search Console (IMPORTANT)
1. **Admin** > **Liens vers les produits** > **Liens Search Console**
2. Clique sur **"Associer"**
3. Sélectionne ta propriété Search Console
4. Confirme

---

## Configuration avancée (optionnel)

### Événements personnalisés
Le code est prêt pour tracker automatiquement :
- ✅ Pages vues
- ✅ Changements de page (navigation)
- ✅ Respect du consentement RGPD

Tu peux ajouter des événements personnalisés plus tard :
```typescript
// Exemple : tracker un clic sur un artiste
window.gtag?.('event', 'artist_click', {
  artist_name: 'Nom de l\'artiste',
  artist_id: 'id-123'
});
```

---

## ✅ Checklist finale

- [ ] Compte Google Analytics créé
- [ ] Propriété GA4 créée
- [ ] Flux de données Web configuré
- [ ] ID de mesure copié (format `G-XXXXXXXXXX`)
- [ ] Variable ajoutée dans Vercel Environment Variables
- [ ] Site redéployé
- [ ] Test en temps réel effectué (visible dans GA)
- [ ] Cookies acceptés sur le site
- [ ] Lien avec Google Search Console fait

---

## 🆘 Problèmes courants

### "Je ne vois pas de données en temps réel"
1. Vérifie que tu as bien accepté les cookies sur le site
2. Vérifie que l'ID commence bien par `G-` (pas `UA-`)
3. Vérifie que la variable est bien dans Vercel (Settings > Environment Variables)
4. Attends 5-10 minutes après le déploiement
5. Vide le cache de ton navigateur (Ctrl + F5)

### "L'ID de mesure n'apparaît pas"
1. Va dans **Admin** > **Flux de données**
2. Clique sur le flux Web
3. L'ID est en haut de la page

### "Les données ne sont pas collectées"
1. Ouvre la console du navigateur (F12)
2. Rafraîchis la page
3. Cherche les erreurs liées à `gtag` ou `analytics`
4. Vérifie que le consentement est accordé

---

## 📞 Support

- **Documentation GA4** : https://support.google.com/analytics/
- **Vercel Environment Variables** : https://vercel.com/docs/environment-variables
- **Aide GA4** : https://support.google.com/analytics/answer/9304153

---

## 🎯 Résumé en 5 minutes

1. Va sur https://analytics.google.com
2. Crée un compte + propriété GA4
3. Configure un flux Web : `https://planete-hmi.vercel.app`
4. Copie l'ID de mesure (`G-XXXXXXXXXX`)
5. Dans Vercel : Settings > Environment Variables
   - Ajoute `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX`
6. Redéploie le site
7. Teste : ouvre le site + accepte cookies + vérifie dans GA Temps réel

**C'est tout ! 🎉**
