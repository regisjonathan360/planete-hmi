# 🚀 Guide de déploiement - Nouvelles fonctionnalités artistes

## État actuel
✅ Migration SQL appliquée sur Supabase (production)  
✅ Code TypeScript compilé sans erreurs  
✅ Tous les diagnostics passent  
⏳ **En attente** : Déploiement Vercel (quota atteint jusqu'au 4 sept. 2026)

---

## Commande de déploiement

Dès que le quota Vercel est rétabli, exécuter :

```bash
cd "c:\Users\regis\Desktop\Projet planete HMI\app-next"
npx vercel --prod --yes
```

---

## Vérifications post-déploiement

### 1. Vérifier la page admin artiste
- URL : `https://planete-hmi.vercel.app/admin/artistes/[id]`
- ✅ Section "Sexe / Genre" visible avec 5 boutons radio
- ✅ Section "Autres plateformes" avec Wikipedia, Chartmetric, Shazam
- ✅ Hint Wikipedia : "✨ Extraction automatique..."

### 2. Vérifier le panneau d'enrichissement
- Cliquer sur "Enrichir depuis Wikipedia" avec une URL valide
- Exemple : `https://fr.wikipedia.org/wiki/Wyclef_Jean`
- ✅ Bio extraite
- ✅ Date/lieu de naissance extraits
- ✅ Genres ajoutés
- ✅ Image téléchargée

### 3. Vérifier la page publique artistes
- URL : `https://planete-hmi.vercel.app/artistes`
- ✅ 3 rangées de filtres :
  1. Par rôle (Chanteur, DJ, etc.)
  2. Par genre musical (Konpa, Hip-Hop, etc.)
  3. **Par sexe (Tous, 👨 Masculin, 👩 Féminin, 👥 Groupes)** ← NOUVEAU
- ✅ Filtre par sexe fonctionne correctement

### 4. Vérifier le tag Animateur
- Créer ou éditer un artiste
- Ajouter le tag "Animateur / Ambianceur"
- ✅ Icône 🎉 visible
- ✅ Couleur jaune (#fbbf24)
- ✅ Artiste apparaît dans filtre "Animateur" sur page publique

---

## Tests de régression

### Fonctionnalités existantes à vérifier
1. ✅ Enrichissement Spotify fonctionne toujours
2. ✅ Enrichissement YouTube fonctionne toujours
3. ✅ Enrichissement Deezer fonctionne toujours
4. ✅ Autres tags (Chanteur, DJ, etc.) fonctionnent toujours
5. ✅ Filtres par rôle et genre fonctionnent toujours

---

## Rollback en cas de problème

Si un problème critique survient après déploiement :

### Option 1 : Rollback via Vercel UI
1. Aller sur https://vercel.com/planete-hmi
2. Onglet "Deployments"
3. Sélectionner le déploiement précédent
4. Cliquer sur "⋯" > "Promote to Production"

### Option 2 : Rollback via CLI
```bash
vercel rollback planete-hmi
```

### Option 3 : Redéployer le commit précédent
```bash
git log --oneline  # trouver le SHA du commit précédent
git revert HEAD    # ou git reset --hard <SHA>
npx vercel --prod --yes
```

---

## Monitoring post-déploiement

### Métriques à surveiller (24h après déploiement)
- Temps de réponse page `/artistes` (objectif : <500ms)
- Erreurs JavaScript dans Vercel Analytics
- Taux de succès des enrichissements Wikipedia
- Utilisation du filtre par sexe (Google Analytics)

### Logs à vérifier
1. **Vercel Logs** : Rechercher erreurs 500 sur routes artistes
2. **Supabase Logs** : Vérifier requêtes avec `gender` colonne
3. **Next.js Build Logs** : Confirmer aucun warning TypeScript

---

## Checklist déploiement

Avant de déployer :
- [x] Migration SQL appliquée
- [x] Build local réussi (`npm run build`)
- [x] Diagnostics TypeScript OK
- [x] Tests manuels en dev (local)

Après déploiement :
- [ ] Page admin artiste accessible
- [ ] Section Sexe/Genre visible
- [ ] Champs Wikipedia/Chartmetric/Shazam visibles
- [ ] Page publique artistes accessible
- [ ] Filtre par sexe visible et fonctionnel
- [ ] Tag Animateur visible
- [ ] Test enrichissement Wikipedia réussi
- [ ] Aucune erreur dans Vercel Logs (première heure)

---

## Support technique

### Si enrichissement Wikipedia échoue
- Vérifier que l'URL est bien `https://fr.wikipedia.org/wiki/[Titre]` ou `https://en.wikipedia.org/wiki/[Titre]`
- Vérifier les logs Vercel : rechercher "enrichWikipedia"
- Vérifier que l'article Wikipedia existe et n'est pas redirigé
- Vérifier que la page Wikipedia a un infobox (sinon extraction limitée)

### Si le filtre par sexe ne fonctionne pas
- Vérifier dans la console navigateur s'il y a des erreurs JavaScript
- Vérifier que les artistes ont bien un `gender` défini en BDD
- Vérifier la requête Supabase dans l'onglet Network : `gender` doit être dans le SELECT

### Si le tag Animateur n'apparaît pas
- Vérifier que le fichier `src/lib/artists/tags.ts` contient bien "animateur"
- Vérifier que l'artiste a le tag "animateur" dans son champ `tags` en BDD
- Forcer un refresh du cache Vercel si nécessaire

---

## Contact

En cas de problème critique :
- **Vérifier** : https://status.vercel.com/
- **Vérifier** : https://status.supabase.com/
- **Rollback** : Voir section ci-dessus

---

**Document créé le** : 5 août 2026  
**Dernière mise à jour** : 5 août 2026  
**Prêt pour déploiement** : ✅ Oui (quota Vercel requis)
