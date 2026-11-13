# Muscu SUAPS — Guide d'installation

Application web gratuite pour la salle de musculation :
- **`index.html`** : page étudiant (téléphone). Accès par code ou QR code, test de charge (3 à 10 répétitions), objectif, programme, carnet.
- **`prof.html`** : espace enseignant (PC), avec **connexion par compte Google (Gmail)**. Étudiants, appareils, QR codes, export CSV.

Hébergement : **GitHub Pages** (gratuit). Données : **Firebase Firestore** (offre gratuite Spark).

Les étudiants n'ont **pas** de compte Google à créer : ils utilisent uniquement leur code ou leur QR code.

---

## 0. Tester tout de suite (mode démo)

Tant que `js/firebase-config.js` n'est pas rempli, l'appli tourne en **mode démo** et tout est stocké dans le navigateur.
Ouvrez `prof.html` et cliquez sur « Se connecter avec Google » : en démo, l'espace enseignant s'ouvre directement.
Créez des étudiants, puis cliquez sur « Voir » puis « Ouvrir sa vue étudiant ».

> ⚠️ Les fichiers utilisent des modules JavaScript : un double-clic sur `index.html` ne suffit pas. Utilisez GitHub Pages
> (étape 4) ou l'extension « Live Server » de VS Code.

---

## 1. Créer le projet Firebase

Connectez-vous à Firebase **avec le compte Gmail que vous utiliserez comme enseignant**.

1. Allez sur <https://console.firebase.google.com> et cliquez sur **Ajouter un projet** (ex. `muscu-suaps`). Google Analytics est inutile.
2. Allez dans **Build > Firestore Database**, puis *Créer une base de données*. Choisissez le mode **production** et l'emplacement **`europe-west9 (Paris)`** (ou `eur3`).
3. Allez dans **Build > Authentication** et cliquez sur *Commencer*.
   - Dans l'onglet *Sign-in method*, choisissez **Google** et cliquez sur **Activer**.
   - Choisissez votre Gmail comme « Adresse e-mail d'assistance » et enregistrez.
   - Inutile de créer un utilisateur à la main : votre compte apparaîtra dans *Users* à la première connexion.
4. Ouvrez ⚙️ **Paramètres du projet**, section *Vos applications*. Cliquez sur l'icône **`</>`** (Web), donnez le nom `muscu` et enregistrez.
   Copiez le bloc `firebaseConfig`.

## 2. Configurer les fichiers

✅ **Déjà fait pour le projet `muscu-suaps`.**

- **`js/firebase-config.js`** contient la configuration du projet `muscu-suaps`.
- **`firestore.rules`** autorise deux comptes enseignants : `florianeude@gmail.com` et `mzubaloff@gmail.com`.
  Pour ajouter un collègue, ajoutez son adresse en minuscules dans la liste, puis republiez les règles (étape 3) :
  ```
  && request.auth.token.email.lower() in ["florianeude@gmail.com", "mzubaloff@gmail.com", "collegue@gmail.com"];
  ```

## 3. Publier les règles de sécurité

Dans la console Firebase, ouvrez **Firestore Database > Règles**. Collez tout le contenu de `firestore.rules`, puis cliquez sur **Publier**.

Ce que garantissent ces règles :
- **seul votre compte Gmail** peut lister, créer ou supprimer des étudiants et modifier les appareils. N'importe qui peut se connecter avec Google, mais un autre compte voit le message « compte non autorisé » et n'accède à rien ;
- un étudiant n'accède qu'à **son** profil, grâce à son code (6 caractères, environ 900 millions de combinaisons) ;
- un étudiant peut seulement enregistrer ses tests, son objectif et ses séances.

## 4. Mettre en ligne sur GitHub Pages

1. Créez un dépôt **public** sur GitHub (ex. `muscu-suaps`). Le dépôt public est obligatoire pour Pages gratuit.
2. Déposez-y tout le contenu du dossier, par glisser-déposer dans *Add file > Upload files*.
3. Allez dans **Settings > Pages**. Dans *Source*, choisissez `Deploy from a branch`, puis la branche `main` et le dossier `/ (root)`. Cliquez sur *Save*.
4. Après 1 à 2 minutes, le site est en ligne à l'adresse `https://VOTRE-PSEUDO.github.io/muscu-suaps/` :
   - les étudiants utilisent `.../muscu-suaps/` (ou leur QR code) ;
   - vous utilisez `.../muscu-suaps/prof.html`.
5. ⚠️ **Étape indispensable pour Google :** dans Firebase, ouvrez **Authentication > Paramètres > Domaines autorisés**. Cliquez sur **Ajouter un domaine** et saisissez `VOTRE-PSEUDO.github.io`.
   Sans cette étape, la connexion Google affiche « Ce site n'est pas autorisé dans Firebase ».

> La clé `apiKey` visible dans le code est normale pour Firebase : la sécurité repose sur les règles Firestore.

## 5. Première connexion

1. Ouvrez `.../prof.html` et cliquez sur **Se connecter avec Google**.
2. Choisissez votre compte Gmail enseignant dans la fenêtre Google.
3. Si la fenêtre ne s'ouvre pas, autorisez les fenêtres pop-up pour le site. L'appli bascule automatiquement sur une redirection si le navigateur les bloque.
4. Vous restez connecté d'une séance à l'autre sur ce PC, jusqu'au clic sur **Déconnexion**.

| Message affiché | Cause | Solution |
|---|---|---|
| « Ce site n'est pas autorisé dans Firebase » | Domaine GitHub non déclaré | Étape 4.5 |
| « Le compte … n'est pas autorisé » | Mauvais compte Google, ou adresse mal recopiée dans les règles | Vérifiez l'adresse en minuscules dans `firestore.rules`, puis republiez les règles (étape 3) |
| La fenêtre Google se ferme sans rien faire | Pop-up bloquée | Autorisez les pop-ups pour le site |

## 6. Utilisation

1. **Appareils** : vérifiez Squat et Développé couché (incrément 2,5 kg, barre 20 kg) et ajoutez vos machines.
   **Photos** : à la salle, ouvrez `prof.html` sur votre téléphone, onglet *Appareils*, et touchez 📷 sous chaque appareil (photo de l'appareil, de la consigne, des charges).
   La photo est compressée (≈ 100 Ko) et enregistrée tout de suite dans Firestore : rien à déposer sur GitHub, aucune règle à republier.
   **Priorité** : la photo du catalogue (marquée 📚) s'affiche en priorité ; votre photo de téléphone n'est utilisée que si le catalogue n'en a pas.
   **Catalogue** : le bouton « 📚 Catalogue » ouvre la liste des 27 appareils chargeables des brochures Matrix (Magnum, Varsity, G1),
   avec photo, unité, pas, charge de départ (fiches techniques Matrix) et consigne de sécurité. Cochez ceux de votre salle (ou « Tout cocher »),
   puis « Ajouter la sélection ». Un appareil du même type déjà créé (ex. « Leg curl ») est mis à jour sans perdre les tests des étudiants.
   Les fiches marquées « départ à vérifier » n'ont pas de résistance de départ publiée : lisez l'étiquette sur la machine.
   Le catalogue se complète dans `CATALOGUE` de `js/programmes.js` ; les photos sont dans `img/appareils/<id>/appareil.webp`.
   **Zones** : chaque appareil a un groupe musculaire (colonne « Muscle », deviné d'après le nom si vide). Les appareils, les maxima
   et les fiches sont rangés par zone : membres inférieurs, membres supérieurs, abdos & tronc.
   **Sélection par cycle** : au début d'un cycle, l'appli choisit les appareils de l'étudiant, un par groupe musculaire en alternant
   bas et haut du corps (force et puissance : 4 ; volume, sculpter et endurance : 6 ; affiner en circuit : 8), en priorité parmi les appareils testés.
   La sélection reste la même jusqu'au bilan pour suivre la progression. Si un appareil est occupé, « Remplacer » propose un appareil
   de la même zone pour la séance du jour. Réglages : `NB_APPAREILS` et `ORDRE_SELECTION` dans `js/programmes.js`. Le catalogue se complète dans `CATALOGUE` de `js/programmes.js`.
2. **Étudiants** : ajoutez-les un par un, ou collez une liste `Nom;Prénom;Groupe` copiée depuis un tableur.
3. **QR codes** : filtrez par groupe, cliquez sur *Imprimer les cartes* et distribuez-les.
4. L'étudiant scanne sa carte, fait son test de charge (3 à 10 répétitions) sur chaque appareil, choisit un objectif, puis suit ses séances et remplit son carnet.
5. Suivi : tableau des maxima, fiche détaillée par étudiant, **export CSV** (s'ouvre dans Excel).

---

## Ce que fait l'appli

### Estimation du max (1RM)
L'étudiant choisit une charge qu'il soulève proprement **entre 3 et 10 fois**, puis saisit la charge et le nombre de répétitions réussies.
L'appli estime le max avec la formule de **Brzycki** : `1RM = charge × 36 / (37 − répétitions)`.

| Répétitions | Coefficient | Exemple avec 50 kg |
|---|---|---|
| 3 | × 1,059 | 52,9 kg |
| 5 | × 1,125 | 56,3 kg |
| 8 | × 1,241 | 62,1 kg |
| 10 | × 1,333 | 66,7 kg |

Le résultat est arrondi à l'**incrément inférieur** de l'appareil, pour une estimation prudente.
Exemple : 3 × 50 kg donne 52,9 kg, affiché **52,5 kg**.

#### Pourquoi pas plus de 10 répétitions ?
Au-delà de 10 répétitions, l'estimation **n'est plus fiable**, et l'appli refuse la saisie :
- **l'endurance prend le dessus sur la force.** Une série longue mesure surtout la résistance à la fatigue, qui varie beaucoup d'une personne à l'autre. Deux étudiants de même force peuvent faire 12 ou 20 répétitions avec la même charge ;
- **les formules divergent.** Jusqu'à 10 répétitions, les formules courantes (Brzycki, Epley, Lander…) donnent des résultats proches. Au-delà, l'écart entre elles dépasse souvent 10 %, ce qui montre qu'aucune n'est fiable dans cette zone ;
- **la formule de Brzycki a été validée jusqu'à 10 répétitions** (Brzycki, 1993). Plus le nombre de répétitions approche de 37, plus le dénominateur `37 − répétitions` est petit et plus le résultat s'envole ;
- **la technique se dégrade en fin de série longue.** Les dernières répétitions sont souvent mal exécutées, donc moins représentatives.

**Conseil à donner aux étudiants :** si vous dépassez 10 répétitions, la charge est trop légère. Reposez-vous 3 à 5 minutes, ajoutez de la charge et refaites le test.
Avec des débutants, visez **5 à 8 répétitions** : c'est un bon compromis entre sécurité et précision.

Les tests enregistrés avant cette mise à jour restent valables : ils sont comptés comme des tests à 3 répétitions.

### Cycles par objectif
| Objectif | Séances | Séries | Rép. (début → fin) | % du max | Récup. |
|---|---|---|---|---|---|
| Force maximale | 8 | 4 → 5 | 5 → 3 | 80 → 90 % | 2-3 min |
| Volume musculaire | 10 | 3 → 4 | 12 → 8 | 70 → 80 % | 1 min 30 |
| Endurance | 8 | 3 → 4 | 20 → 15 | 50 → 60 % | 30 s-1 min |
| Puissance | 8 | 4 → 5 | 8 → 5 | 50 → 60 % | 2-2 min 30 |
| Affiner (circuit) | 10 | 3 → 4 tours | 15 → 12 | 55 → 65 % | 45-60 s |
| Sculpter & entretenir | 10 | 3 → 4 | 12 → 8 | 65 → 75 % | 1-1 min 30 |

La dernière séance de chaque cycle est une **séance bilan avec re-test** (3 à 10 répétitions).
Chaque séance propose aussi un **échauffement progressif** calculé (40 %, 55 %, 70 %…) et un **minuteur de récupération**.

### Régulation automatique
À chaque séance, l'étudiant indique ses séries réussies et son ressenti :
- 2 séances « faciles » de suite (tout réussi, ressenti « facile » ou mieux) : **+1 incrément** ;
- échec (2 séries manquées ou plus, ou ressenti « impossible ») : **−1 incrément** ;
- un nouveau test remet la régulation à zéro.

Toutes ces valeurs se modifient dans **`js/programmes.js`**.

### Références
- Brzycki M. (1993), *Strength testing: predicting a one-rep max from reps-to-fatigue*, JOPERD.
- Référentiels CA5 musculation, académie de Grenoble (BCP et CAP).
- Ressource musculation lycée, académie de Nancy-Metz.
- Guide des profils et programmes de musculation (document de l'enseignant).

### Données personnelles
Seuls le nom, le prénom, le groupe et les performances sont stockés, sur un serveur européen. Les étudiants ne donnent aucune adresse email.
Pensez à les en informer, ainsi que le DPO de l'université si nécessaire. Supprimez les profils en fin d'année depuis l'espace enseignant.

## Structure
```
index.html            page étudiant
prof.html             espace enseignant (connexion Google)
css/style.css         styles (clair / sombre automatique)
js/programmes.js      formule, objectifs, régulation  ← à personnaliser
js/db.js              accès Firestore / mode démo
js/etudiant.js        logique page étudiant
js/prof.js            logique espace enseignant
js/firebase-config.js clés Firebase                   ← à remplir
firestore.rules       règles de sécurité               ← votre Gmail à remplir
```
