// =====================================================================
//  programmes.js — Logique métier : estimation du max et programmes
//  Vous pouvez modifier les valeurs des OBJECTIFS ci-dessous sans risque.
// =====================================================================

// ---------- 1. Estimation du 1RM à partir d'un test de 3 à 10 répétitions ----------
// Formule de Brzycki (1993) : 1RM = charge × 36 / (37 − répétitions)
//   3 rép. → × 1,059   5 rép. → × 1,125   8 rép. → × 1,241   10 rép. → × 1,333
//
// Pourquoi 10 répétitions au maximum ?
//  - Au-delà, la série mesure surtout l'ENDURANCE (résistance à la fatigue), très variable
//    d'une personne à l'autre : deux étudiants de même force peuvent faire 12 ou 20 répétitions.
//  - Les formules (Brzycki, Epley, Lander…) donnent des résultats proches jusqu'à 10 rép.,
//    puis s'écartent de plus de 10 % : aucune n'est fiable dans cette zone.
//  - Brzycki a été validée jusqu'à 10 répétitions ; ensuite le dénominateur (37 − rép.)
//    devient petit et le résultat s'envole.
//  - La technique se dégrade en fin de série longue.
export const REPS_MIN = 3;
export const REPS_MAX = 10;
export const REPS_TEST = 3; // valeur par défaut (et pour les anciens tests enregistrés sans répétitions)

export const MSG_REPS_TROP = "Plus de 10 répétitions : l'estimation du max n'est pas fiable (on mesure surtout l'endurance). Reposez-vous 3 à 5 min, ajoutez de la charge et refaites le test.";
export const MSG_REPS_PEU = "Faites au moins 3 répétitions : un test plus lourd n'est pas nécessaire et augmente le risque.";

export function repsValides(reps) {
  const r = Number(reps);
  return Number.isInteger(r) && r >= REPS_MIN && r <= REPS_MAX;
}

// Renvoie le message d'erreur, ou "" si le nombre de répétitions est correct
export function erreurReps(reps) {
  const r = Number(reps);
  if (!Number.isFinite(r) || r <= 0) return "";
  if (r > REPS_MAX) return MSG_REPS_TROP;
  if (r < REPS_MIN) return MSG_REPS_PEU;
  if (!Number.isInteger(r)) return "Saisissez un nombre entier de répétitions.";
  return "";
}

export function estimer1RM(charge, reps = REPS_TEST) {
  const c = Number(charge);
  if (!c || c <= 0 || !repsValides(reps)) return 0;
  return c * 36 / (37 - Number(reps));
}

// Arrondi à l'incrément de l'appareil
export function arrondir(valeur, increment = 2.5, mode = "proche") {
  const inc = Number(increment) || 1;
  const n = valeur / inc;
  const r = mode === "bas" ? Math.floor(n + 1e-9) : Math.round(n);
  return Math.round(r * inc * 100) / 100;
}

// Max affiché : arrondi INFÉRIEUR à l'incrément (estimation prudente)
export function maxAffiche(charge, increment, reps = REPS_TEST) {
  return arrondir(estimer1RM(charge, reps), increment, "bas");
}

// Nombre de répétitions d'un test enregistré (les anciens tests étaient tous à 3)
export function repsDuTest(t) {
  return Number(t?.reps) || REPS_TEST;
}

// ---------- 1 bis. Unité et charges de l'appareil ----------
// Chaque appareil a son unité : "kg" (barres, disques) ou "lbs" (piles de plaques en livres).
// Toutes les charges d'un appareil (tests, programme, carnet) sont exprimées dans SON unité :
// pour une pile en lbs, l'étudiant lit directement le chiffre gravé sur la plaque.
// Conversion identique aux étiquettes des piles Matrix (1 lb = 0,45 kg : 50 lbs → 22,5 kg).
export const LBS_EN_KG = 0.45;

export function uniteDe(machine) {
  return machine?.unite === "lbs" ? "lbs" : "kg";
}

// Garde la charge entre la plus petite et la plus grande charge de l'appareil
export function borner(charge, machine) {
  const min = Number(machine?.chargeMin) || 0;
  const max = Number(machine?.chargeMax) || 0;
  if (charge < min) charge = min;
  if (max > 0 && charge > max) charge = max;
  return charge;
}

// "50 lbs (22,5 kg)" pour une pile en livres, "52,5 kg" sinon
export function fmtCharge(v, machine) {
  const n = Math.round(Number(v) * 100) / 100;
  if (uniteDe(machine) !== "lbs") return fmtKg(n);
  return `${String(n).replace(".", ",")} lbs (${fmtKg(Math.round(n * LBS_EN_KG * 10) / 10)})`;
}
// Version courte, sans conversion : "50 lbs" ou "52,5 kg"
export function fmtChargeCourt(v, machine) {
  return String(Math.round(Number(v) * 100) / 100).replace(".", ",") + " " + uniteDe(machine);
}
// Équivalent en kg seul, ou "" pour un appareil déjà en kg : "22,5 kg"
export function enKg(v, machine) {
  return uniteDe(machine) === "lbs" ? fmtKg(Math.round(Number(v) * LBS_EN_KG * 10) / 10) : "";
}

// Photos : deux sources possibles, dans cet ordre de priorité
//  1. photos du catalogue, livrées avec l'appli dans img/appareils/<dossier>/ :
//     appareil.webp (photo de l'appareil), consigne.webp (pictogramme), pile.webp (pile de charges)
//  2. sinon, photo prise depuis l'espace enseignant (bouton 📷, sur téléphone), stockée dans Firestore
// Le navigateur essaie d'abord la photo du catalogue ; si elle n'existe pas, il bascule sur la photo prise.
export const TYPES_PHOTOS = [
  ["appareil", "L'appareil"],
  ["consigne", "La consigne"],
  ["pile", "Les charges"]
];
let PHOTOS = {}; // { idAppareil: { appareil: "data:image/jpeg;base64,…", consigne: …, pile: … } }
export function definirPhotos(map) { PHOTOS = map || {}; }
export function photosDe(machineId) { return PHOTOS[machineId] || {}; }

export function urlCatalogue(machine, type) {
  const d = String(machine?.dossier || "").trim();
  return d ? `img/appareils/${encodeURIComponent(d)}/${type}.webp` : "";
}

// Première photo à essayer (catalogue, sinon photo prise), "" s'il n'y en a aucune
export function urlPhoto(machine, type) {
  return urlCatalogue(machine, type) || PHOTOS[machine?.id]?.[type] || "";
}

// Attributs d'une balise <img> avec bascule automatique : catalogue → photo prise → rien.
// absent : ce qu'on fait s'il n'y a aucune photo : "retirer" (enlève le bloc parent) ou "camera" (affiche 📷)
export function attrsPhoto(machine, type, absent = "retirer") {
  const url = urlPhoto(machine, type);
  return `src="${url}" data-m="${String(machine?.id || "").replace(/"/g, "")}" data-t="${type}" data-absent="${absent}" onerror="photoSuivante(this)"`;
}
function photoSuivante(img) {
  const prise = PHOTOS[img.dataset.m]?.[img.dataset.t];
  if (prise && !img.src.startsWith("data:")) { img.src = prise; return; }
  img.onerror = null;
  if (img.dataset.absent === "camera") img.replaceWith(Object.assign(document.createElement("span"), { textContent: "📷" }));
  else img.parentElement?.remove();
}
if (typeof window !== "undefined") window.photoSuivante = photoSuivante;

// ---------- 2. Les objectifs (repris du guide + référentiels EPS) ----------
// pct = [début de cycle, fin de cycle] en % du max estimé
// reps = [fin de cycle, début de cycle] → on commence plus léger avec plus de répétitions
// seances = longueur conseillée du cycle (dernière séance = séance bilan / re-test)
export const OBJECTIFS = {
  force: {
    nom: "Force maximale",
    icone: "🏋️",
    resume: "Devenir plus fort sans prendre beaucoup de volume.",
    seances: 8,
    series: [4, 5], reps: [3, 5], pct: [80, 90],
    recup: "2 à 3 min", recupSec: 150,
    format: "classique",
    consigne: "Mouvement contrôlé, technique parfaite. Pareur obligatoire ou barres de sécurité réglées.",
    effets: "Gain de force surtout nerveux : visible dès 4 à 6 semaines."
  },
  hypertrophie: {
    nom: "Volume musculaire",
    icone: "💪",
    resume: "Développer la masse musculaire (hypertrophie).",
    seances: 10,
    series: [3, 4], reps: [8, 12], pct: [70, 80],
    recup: "1 min 30", recupSec: 90,
    format: "classique",
    consigne: "Descente lente (2-3 s), remontée dynamique. Recherche de congestion sur les dernières répétitions.",
    effets: "Le gain de volume demande de la régularité : au moins 8 à 10 séances."
  },
  endurance: {
    nom: "Endurance musculaire",
    icone: "🔋",
    resume: "Résister à la fatigue, tonifier.",
    seances: 8,
    series: [3, 4], reps: [15, 20], pct: [50, 60],
    recup: "30 s à 1 min", recupSec: 45,
    format: "classique",
    consigne: "Rythme régulier sans pause. Sensation de brûlure en fin de série = normal.",
    effets: "Adaptation rapide : progrès sensibles en 6 à 8 séances."
  },
  puissance: {
    nom: "Puissance / Explosivité",
    icone: "⚡",
    resume: "Produire de la force le plus vite possible.",
    seances: 8,
    series: [4, 5], reps: [5, 8], pct: [50, 60],
    recup: "2 à 2 min 30", recupSec: 135,
    format: "classique",
    consigne: "Descente contrôlée, remontée la plus rapide possible. On arrête la série dès que la vitesse baisse.",
    effets: "Amélioration de la vitesse d'exécution en 6 à 8 séances."
  },
  affiner: {
    nom: "Affiner la silhouette",
    icone: "🔥",
    resume: "Dépense calorique élevée en préservant le muscle.",
    seances: 10,
    series: [3, 4], reps: [12, 15], pct: [55, 65],
    recup: "45 à 60 s", recupSec: 50,
    format: "circuit",
    consigne: "Circuit : enchaînez les appareils, récupérez seulement après chaque tour.",
    effets: "À associer à une activité cardio et une alimentation équilibrée. Visible après 8 à 10 séances."
  },
  sculpter: {
    nom: "Sculpter & entretenir",
    icone: "✨",
    resume: "Raffermir, recomposition corporelle, maintien des acquis.",
    seances: 10,
    series: [3, 4], reps: [8, 12], pct: [65, 75],
    recup: "1 min à 1 min 30", recupSec: 75,
    format: "classique",
    consigne: "Tempo régulier, amplitude complète, gainage permanent.",
    effets: "Résultats progressifs : prévoir 8 à 12 séances."
  }
};

// ---------- 3. Calcul de la séance N d'un cycle ----------
// Renvoie la prescription pour un appareil donné
export function prescription(objectifId, numSeance, max1RM, machine, ajustKg = 0) {
  const o = OBJECTIFS[objectifId];
  if (!o) return null;
  const total = o.seances;
  if (numSeance >= total) {
    return { bilan: true, texte: "Séance bilan : refaites le test sur cet appareil pour mesurer vos progrès." };
  }
  // Phase de 0 (début) à 1 (fin du cycle, hors séance bilan)
  const t = total > 2 ? (numSeance - 1) / (total - 2) : 0;
  const pct = o.pct[0] + (o.pct[1] - o.pct[0]) * t;
  const reps = Math.round(o.reps[1] - (o.reps[1] - o.reps[0]) * t);
  const series = t < 0.34 ? o.series[0] : o.series[1];
  const inc = Number(machine.increment) || 2.5;
  const charge = borner(arrondir(max1RM * pct / 100 + ajustKg, inc), machine);
  return {
    bilan: false, series, reps, pct: Math.round(pct), charge,
    recup: o.recup, recupSec: o.recupSec, consigne: o.consigne,
    echauffement: echauffement(objectifId, max1RM, machine)
  };
}

// Échauffement progressif
export function echauffement(objectifId, max1RM, machine) {
  const inc = Number(machine.increment) || 2.5;
  const paliers = [[10, 40], [6, 55]];
  if (["force", "hypertrophie", "puissance", "sculpter"].includes(objectifId)) paliers.push([3, 70]);
  if (objectifId === "force") paliers.push([1, 80]);
  return paliers.map(([r, p]) => ({ reps: r, charge: borner(arrondir(max1RM * p / 100, inc), machine) }));
}

// ---------- 4. Régulation de la charge ----------
// statut d'une ligne de carnet : "facile" | "ok" | "echec"
export function statutLigne(ligne, seriesPrevues) {
  if (ligne.seriesReussies < seriesPrevues - 1 || ligne.ressenti >= 10) return "echec";
  if (ligne.seriesReussies >= seriesPrevues && ligne.ressenti <= 6) return "facile";
  return "ok"; // une seule série manquée = on maintient la charge
}

// Calcule le nouvel ajustement (dans l'unité de l'appareil) à partir de l'historique de l'appareil
// Règle : 2 séances "facile" consécutives → +1 incrément ; 1 "échec" → −1 incrément
export function nouvelAjustement(ajustActuel, historiqueStatuts, increment) {
  const inc = Number(increment) || 2.5;
  const n = historiqueStatuts.length;
  if (n === 0) return ajustActuel;
  const dernier = historiqueStatuts[n - 1];
  if (dernier === "echec") return ajustActuel - inc;
  if (dernier === "facile" && n >= 2 && historiqueStatuts[n - 2] === "facile") return ajustActuel + inc;
  return ajustActuel;
}

export const RESSENTIS = [
  [4, "Très facile"], [6, "Facile"], [7, "Correct"],
  [8, "Difficile"], [9, "Très difficile"], [10, "Échec / impossible"]
];

// ---------- 5. Appareils par défaut ----------
export const MACHINES_DEFAUT = [
  { id: "squat", nom: "Squat", increment: 2.5, chargeMin: 20, actif: true,
    consigne: "Barres de sécurité réglées sous la hauteur de descente. Dos neutre, genoux dans l'axe des pieds." },
  { id: "dc", nom: "Développé couché", increment: 2.5, chargeMin: 20, actif: true,
    consigne: "Pareur obligatoire. Pieds au sol, omoplates serrées, barre au niveau des pectoraux." },
  { id: "triceps-pressdown", nom: "Triceps pressdown", unite: "lbs",
    increment: 5, chargeMin: 5, chargeMax: 100, dossier: "triceps-pressdown", actif: true,
    consigne: "Coudes collés au corps, seuls les avant-bras bougent. Écartez la corde en bas du mouvement." }
];

// ---------- Catalogue : appareils pré-remplis (photo, charges, consigne) ----------
// Bouton « Ajouter depuis le catalogue » dans l'onglet Appareils de l'espace enseignant.
// motsCles : sert à repérer un appareil déjà créé à la main, pour le mettre à jour au lieu d'en créer un second.
export const CATALOGUE = [
  { id: "leg-press-45", nom: "Presse à cuisses 45°", modele: "Matrix Magnum MG-PL70",
    motsCles: ["leg press", "legpress", "presse a cuisses", "presse cuisses", "presse 45"],
    unite: "kg", increment: 2.5, chargeMin: 75, chargeMax: 490, dossier: "leg-press-45", actif: true,
    info: "Le chariot vide pèse déjà 75 kg (charge de départ indiquée par Matrix). Saisissez toujours la charge totale : 75 kg + les disques chargés.",
    consigne: "Dos et bassin collés au dossier. Pieds à plat, largeur du bassin, genoux dans l'axe des pieds. Réglez la butée basse avant de commencer. Déverrouillez le chariot seulement pieds en place, reverrouillez avant de descendre. Ne verrouillez pas les genoux en haut. Chargez et déchargez les disques des deux côtés en même temps." },

  // Réglages (lbs, pas de 5, 5 à 100) relevés sur la pile de la machine de la salle :
  // la brochure Matrix annonce une pile de 87,1 kg / 192 lbs pour le MG-942, différente de celle de la salle.
  { id: "triceps-pressdown", nom: "Triceps pressdown", modele: "Matrix Magnum MG-942",
    motsCles: ["pressdown", "pushdown", "push down", "poulie triceps"],
    unite: "lbs", increment: 5, chargeMin: 5, chargeMax: 100, dossier: "triceps-pressdown", actif: true,
    info: "La pile est graduée en livres (lbs) : placez la goupille sur le chiffre indiqué par l'appli (100 lbs ≈ 45 kg).",
    consigne: "Debout face à la poulie, pieds largeur du bassin, genoux légèrement fléchis, buste un peu penché en avant. Coudes collés au corps : seuls les avant-bras bougent. Écartez la corde en bas du mouvement, remontez lentement sans laisser la pile claquer. Changez la goupille seulement pile au repos." },

  { id: "leg-curl-couche", nom: "Leg curl couché", modele: "Matrix Varsity VY-402",
    motsCles: ["leg curl", "legcurl", "ischio", "curl jambe"],
    unite: "kg", increment: 1.25, chargeMin: 10, actif: true, dossier: "leg-curl-couche",
    info: "Machine à disques : le bras vide équivaut déjà à environ 10 kg (21 lb indiqués par Matrix). Saisissez toujours la charge totale : 10 kg + les disques chargés.",
    consigne: "Allongé sur le ventre, genoux juste au-delà du bord du banc (alignés avec l'axe de rotation), boudin posé au-dessus des talons. Bassin plaqué contre le banc, ne cambrez pas le dos. Montez et descendez lentement, sans à-coup. Chargez et déchargez les disques bras posé en butée basse." },

  // ---- Ajouts : tous les appareils chargeables des brochures Matrix (résistances de départ : fiches techniques Matrix) ----
  { id: "vertical-bench-press", nom: "Développé vertical (disques)", modele: "Matrix Magnum MG-PL12",
    motsCles: ["developpe vertical", "vertical bench", "chest press", "presse pectoraux"],
    unite: "kg", increment: 2.5, chargeMin: 7.5, dossier: "vertical-bench-press", actif: true,
    info: "Le bras vide équivaut déjà à 6,8 kg (valeur Matrix). Saisissez toujours la charge totale : 7,5 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez le siège pour que les poignées soient à hauteur de poitrine. Dos et tête collés au dossier, pieds au sol. Poussez sans verrouiller les coudes, revenez lentement sans laisser les charges se poser. Chargez les disques des deux côtés." },
  { id: "supine-bench-press", nom: "Développé couché guidé (disques)", modele: "Matrix Magnum MG-PL13",
    motsCles: ["supine", "couche guide", "développé couché machine"],
    unite: "kg", increment: 2.5, chargeMin: 5, dossier: "supine-bench-press", actif: true,
    info: "Le bras vide équivaut déjà à 4,5 kg (valeur Matrix). Saisissez toujours la charge totale : 5 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Allongé, yeux sous les poignées, dos et fessiers en contact avec le banc, pieds au sol. Poussez sans verrouiller les coudes, descendez lentement jusqu'à hauteur de poitrine. Chargez les disques des deux côtés." },
  { id: "incline-bench-press", nom: "Développé incliné (disques)", modele: "Matrix Magnum MG-PL14",
    motsCles: ["incline", "incliné", "incline bench"],
    unite: "kg", increment: 2.5, chargeMin: 5, dossier: "incline-bench-press", actif: true,
    info: "Le bras vide équivaut déjà à 5,4 kg (valeur Matrix). Saisissez toujours la charge totale : 5 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez le siège pour que les poignées soient au niveau du haut de la poitrine. Dos collé au dossier, pieds au sol. Poussez sans verrouiller les coudes, revenez lentement. Chargez les disques des deux côtés." },
  { id: "vertical-decline-press", nom: "Développé décliné (disques)", modele: "Matrix Magnum MG-PL15",
    motsCles: ["decline", "décliné"],
    unite: "kg", increment: 2.5, chargeMin: 7.5, dossier: "vertical-decline-press", actif: true,
    info: "Le bras vide équivaut déjà à 6,8 kg (valeur Matrix). Saisissez toujours la charge totale : 7,5 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez le siège pour que les poignées soient au niveau du bas de la poitrine. Dos collé au dossier, pieds au sol. Poussez vers le bas et l'avant sans verrouiller les coudes, revenez lentement. Chargez les disques des deux côtés." },
  { id: "shoulder-press-disques", nom: "Développé épaules (disques)", modele: "Matrix Magnum MG-PL23",
    motsCles: ["developpe epaules", "développé épaules", "shoulder press", "militaire"],
    unite: "kg", increment: 2.5, chargeMin: 5, dossier: "shoulder-press-disques", actif: true,
    info: "Le bras vide équivaut déjà à 5,4 kg (valeur Matrix). Saisissez toujours la charge totale : 5 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez le siège pour que les poignées partent à hauteur d'épaules. Dos collé au dossier, ne cambrez pas. Poussez sans verrouiller les coudes, redescendez lentement. Chargez les disques des deux côtés." },
  { id: "lat-pulldown-disques", nom: "Tirage vertical (disques)", modele: "Matrix Magnum MG-PL33",
    motsCles: ["tirage vertical disques", "lat pulldown disques"],
    unite: "kg", increment: 2.5, chargeMin: 0, dossier: "lat-pulldown-disques", actif: true,
    info: "Résistance de départ non communiquée par Matrix : regardez l'étiquette « Starting resistance » sur la machine, puis indiquez-la comme charge minimum. En attendant, saisissez seulement le poids des disques, toujours de la même façon.",
    consigne: "Réglez le boudin sur les cuisses pour bien les bloquer. Buste droit, légèrement penché en arrière. Tirez les poignées vers le haut de la poitrine en serrant les omoplates, remontez lentement bras presque tendus. Chargez les disques des deux côtés." },
  { id: "seated-row-disques", nom: "Tirage horizontal assis (disques)", modele: "Matrix Magnum MG-PL34",
    motsCles: ["tirage horizontal disques", "seated row", "rowing assis"],
    unite: "kg", increment: 2.5, chargeMin: 10, dossier: "seated-row-disques", actif: true,
    info: "Le bras vide équivaut déjà à 11,3 kg (valeur Matrix). Saisissez toujours la charge totale : 10 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez le siège pour que les poignées soient à hauteur de poitrine, buste contre l'appui. Dos droit, épaules basses. Tirez en serrant les omoplates, coudes près du corps, revenez lentement bras presque tendus. Chargez les disques des deux côtés." },
  { id: "ab-crunch-bench", nom: "Banc crunch abdos (disques)", modele: "Matrix Magnum MG-PL50",
    motsCles: ["crunch", "abdo"],
    unite: "kg", increment: 1.25, chargeMin: 10, dossier: "ab-crunch-bench", actif: true,
    info: "Le bras vide équivaut déjà à 11,3 kg (valeur Matrix). Saisissez toujours la charge totale : 10 kg + les disques chargés. Charge maximale prévue : 34 kg.",
    consigne: "Pieds calés sous les rouleaux, mains sur les poignées. Enroulez le buste en rapprochant les côtes du bassin, sans tirer avec les bras ni sur la nuque. Revenez lentement sans reposer la charge." },
  { id: "smith-magnum", nom: "Smith machine (Magnum)", modele: "Matrix Magnum MG-PL62",
    motsCles: ["smith"],
    unite: "kg", increment: 2.5, chargeMin: 10, dossier: "smith-magnum", actif: true,
    info: "Le bras vide équivaut déjà à 11,3 kg (valeur Matrix). Saisissez toujours la charge totale : 10 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez les butées de sécurité juste sous le point le plus bas du mouvement AVANT de commencer. Décrochez la barre par rotation des poignets, raccrochez-la à chaque fin de série. Disques identiques des deux côtés, colliers mis. Ne travaillez jamais sans butées." },
  { id: "hack-squat", nom: "Hack squat", modele: "Matrix Magnum MG-PL71",
    motsCles: ["hack"],
    unite: "kg", increment: 2.5, chargeMin: 47.5, dossier: "hack-squat", actif: true,
    info: "Le bras vide équivaut déjà à 47,6 kg (valeur Matrix). Saisissez toujours la charge totale : 47,5 kg + les disques chargés.",
    consigne: "Dos et épaules bien calés contre les appuis, pieds à plat à largeur de bassin, genoux dans l'axe des pieds. Réglez la butée basse, déverrouillez le chariot pieds en place. Descendez contrôlé sans décoller les talons, ne verrouillez pas les genoux en haut. Reverrouillez avant de sortir." },
  { id: "standing-calf", nom: "Mollets debout (disques)", modele: "Matrix Magnum MG-PL76",
    motsCles: ["mollet debout", "standing calf", "mollets debout"],
    unite: "kg", increment: 2.5, chargeMin: 30, dossier: "standing-calf", actif: true,
    info: "Le bras vide équivaut déjà à 30,4 kg (valeur Matrix). Saisissez toujours la charge totale : 30 kg + les disques chargés.",
    consigne: "Réglez les épaulières à votre taille. Avant des pieds sur la plateforme, talons dans le vide, genoux tendus mais non verrouillés. Montez sur la pointe des pieds, redescendez lentement en étirant le mollet. Gardez le dos droit." },
  { id: "seated-calf", nom: "Mollets assis (disques)", modele: "Matrix Magnum MG-PL77",
    motsCles: ["mollet assis", "seated calf", "mollets assis"],
    unite: "kg", increment: 2.5, chargeMin: 10, dossier: "seated-calf", actif: true,
    info: "Le bras vide équivaut déjà à 11,3 kg (valeur Matrix). Saisissez toujours la charge totale : 10 kg + les disques chargés.",
    consigne: "Réglez les appuis sur le bas des cuisses. Avant des pieds sur la plateforme, talons libres. Débloquez la barre de sécurité, montez sur la pointe des pieds puis redescendez lentement. Rebloquez avant de sortir." },
  { id: "glute-trainer", nom: "Hip thrust (Glute trainer)", modele: "Matrix Magnum MG-PL78",
    motsCles: ["glute", "hip thrust", "fessier"],
    unite: "kg", increment: 2.5, chargeMin: 22.5, dossier: "glute-trainer", actif: true,
    info: "Le bras vide équivaut déjà à 22,7 kg (valeur Matrix). Saisissez toujours la charge totale : 22,5 kg + les disques chargés.",
    consigne: "Haut du dos sur l'appui, ceinture du boudin sur les hanches, pieds à plat largeur de bassin. Poussez avec les talons jusqu'à l'alignement épaules-hanches-genoux, sans cambrer le bas du dos. Redescendez lentement." },
  { id: "squat-lunge", nom: "Squat / fente guidé (disques)", modele: "Matrix Magnum MG-PL79",
    motsCles: ["squat lunge", "squat / fente", "fente"],
    unite: "kg", increment: 2.5, chargeMin: 15, dossier: "squat-lunge", actif: true,
    info: "Le bras vide équivaut déjà à 16,3 kg (valeur Matrix). Saisissez toujours la charge totale : 15 kg + les disques chargés. Charge maximale efficace : 144 kg.",
    consigne: "Épaules sous les appuis, buste droit, pieds largeur de bassin. Descendez contrôlé, genoux dans l'axe des pieds, talons au sol. Ne verrouillez pas les genoux en haut. Pour la fente, gardez le genou avant au-dessus de la cheville." },
  { id: "reverse-back-extension", nom: "Extension lombaire inversée (disques)", modele: "Matrix Magnum MG-405",
    motsCles: ["reverse", "lombaire", "hyperextension"],
    unite: "kg", increment: 2.5, chargeMin: 7.5, dossier: "reverse-back-extension", actif: true,
    info: "Le bras vide équivaut déjà à 7 kg (valeur Matrix). Saisissez toujours la charge totale : 7,5 kg + les disques chargés.",
    consigne: "Buste allongé sur l'appui, hanches au bord, mains sur les poignées. Montez les jambes jusqu'à l'horizontale sans cambrer au-delà, redescendez lentement. Réglez le point de départ selon votre souplesse ; débutez léger." },
  { id: "lat-pulldown-pile", nom: "Tirage vertical (pile)", modele: "Matrix Magnum MG-921",
    motsCles: ["tirage vertical", "lat pulldown", "tirage poitrine"],
    unite: "lbs", increment: 10, chargeMin: 10, dossier: "lat-pulldown-pile", actif: true,
    info: "Machine à pile : placez la goupille sur la charge indiquée par l'appli. Vérifiez l'unité (lbs ou kg) et le pas inscrits sur la pile, et corrigez-les dans la fiche appareil si besoin.",
    consigne: "Réglez le boudin pour bloquer les cuisses. Prise un peu plus large que les épaules, buste légèrement en arrière. Tirez la barre devant vers le haut de la poitrine (jamais derrière la nuque), remontez lentement sans laisser la pile claquer." },
  { id: "low-row-pile", nom: "Tirage horizontal (pile)", modele: "Matrix Magnum MG-926",
    motsCles: ["tirage horizontal", "low row", "rowing"],
    unite: "lbs", increment: 10, chargeMin: 10, dossier: "low-row-pile", actif: true,
    info: "Machine à pile : placez la goupille sur la charge indiquée par l'appli. Vérifiez l'unité (lbs ou kg) et le pas inscrits sur la pile, et corrigez-les dans la fiche appareil si besoin.",
    consigne: "Pieds calés sur les appuis, genoux légèrement fléchis, dos droit. Tirez la poignée vers le nombril en serrant les omoplates, sans basculer le buste en arrière. Revenez lentement sans arrondir le dos." },
  { id: "lat-low-row-pile", nom: "Tirage vertical / horizontal (pile)", modele: "Matrix Magnum MG-946",
    motsCles: ["tirage vertical / horizontal", "lat pulldown / low row"],
    unite: "lbs", increment: 10, chargeMin: 10, dossier: "lat-low-row-pile", actif: true,
    info: "Machine à pile : placez la goupille sur la charge indiquée par l'appli. Vérifiez l'unité (lbs ou kg) et le pas inscrits sur la pile, et corrigez-les dans la fiche appareil si besoin.",
    consigne: "Une seule pile pour deux exercices : faites un test séparé si vous utilisez les deux postes. Tirage vertical : cuisses bloquées, barre devant vers la poitrine. Tirage horizontal : dos droit, poignée vers le nombril. Retour lent sans faire claquer la pile." },
  { id: "angled-smith", nom: "Smith machine inclinée (Varsity)", modele: "Matrix Varsity VY-M49",
    motsCles: ["smith incline", "smith inclin", "angled smith"],
    unite: "kg", increment: 2.5, chargeMin: 10, dossier: "angled-smith", actif: true,
    info: "Le bras vide équivaut déjà à 11,3 kg (valeur Matrix). Saisissez toujours la charge totale : 10 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez les butées de sécurité juste sous le point le plus bas AVANT de commencer. Décrochez et raccrochez la barre par rotation des poignets. Disques identiques des deux côtés, colliers mis. Ne travaillez jamais sans butées." },
  { id: "smith-g1", nom: "Smith machine (G1)", modele: "Matrix G1-FW161",
    motsCles: ["smith g1"],
    unite: "kg", increment: 2.5, chargeMin: 20, dossier: "smith-g1", actif: true,
    info: "Le bras vide équivaut déjà à 20 kg (valeur Matrix). Saisissez toujours la charge totale : 20 kg + les disques chargés (additionnez les disques des deux côtés).",
    consigne: "Réglez les butées de sécurité juste sous le point le plus bas AVANT de commencer. Décrochez et raccrochez la barre par rotation des poignets. Disques identiques des deux côtés, colliers mis. Ne travaillez jamais sans butées." },
  { id: "perfect-squat", nom: "Perfect squat (Varsity)", modele: "Matrix Varsity VY-400",
    motsCles: ["perfect squat"],
    unite: "kg", increment: 2.5, chargeMin: 0, dossier: "perfect-squat", actif: true,
    info: "Résistance de départ non communiquée par Matrix : regardez l'étiquette « Starting resistance » sur la machine, puis indiquez-la comme charge minimum. En attendant, saisissez seulement le poids des disques, toujours de la même façon.",
    consigne: "Épaules sous les appuis, dos contre le dossier, pieds à plat sur la plateforme, largeur de bassin. Descendez contrôlé, genoux dans l'axe des pieds, talons au sol. Ne verrouillez pas les genoux en haut. Réglez la hauteur de départ avant de charger." },
  { id: "leg-extension", nom: "Leg extension (Varsity)", modele: "Matrix Varsity VY-401",
    motsCles: ["leg extension", "extension jambe", "quadriceps"],
    unite: "kg", increment: 1.25, chargeMin: 0, dossier: "leg-extension", actif: true,
    info: "Résistance de départ non communiquée par Matrix : regardez l'étiquette « Starting resistance » sur la machine, puis indiquez-la comme charge minimum. En attendant, saisissez seulement le poids des disques, toujours de la même façon.",
    consigne: "Réglez le dossier pour aligner le genou avec l'axe de rotation, boudin posé sur le bas du tibia. Dos collé au dossier, mains sur les poignées. Tendez les jambes sans verrouiller les genoux, redescendez lentement." },
  { id: "biceps-curl-pupitre", nom: "Curl biceps au pupitre (Varsity)", modele: "Matrix Varsity VY-431",
    motsCles: ["biceps", "curl biceps", "pupitre"],
    unite: "kg", increment: 1.25, chargeMin: 0, dossier: "biceps-curl-pupitre", actif: true,
    info: "Résistance de départ non communiquée par Matrix : regardez l'étiquette « Starting resistance » sur la machine, puis indiquez-la comme charge minimum. En attendant, saisissez seulement le poids des disques, toujours de la même façon.",
    consigne: "Réglez le siège pour que le dos des bras repose entièrement sur le pupitre, coudes alignés avec l'axe de rotation. Fléchissez les bras sans décoller les coudes, redescendez lentement sans verrouiller en bas." },
  { id: "triceps-extension", nom: "Extension triceps (Varsity)", modele: "Matrix Varsity VY-432",
    motsCles: ["extension triceps", "triceps extension"],
    unite: "kg", increment: 1.25, chargeMin: 0, dossier: "triceps-extension", actif: true,
    info: "Résistance de départ non communiquée par Matrix : regardez l'étiquette « Starting resistance » sur la machine, puis indiquez-la comme charge minimum. En attendant, saisissez seulement le poids des disques, toujours de la même façon.",
    consigne: "Réglez le siège pour aligner les coudes avec l'axe de rotation, bras posés sur l'appui. Tendez les bras sans verrouiller les coudes, revenez lentement. Gardez le dos contre le dossier." }
];

export function genererCode(longueur = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(longueur);
  crypto.getRandomValues(arr);
  return Array.from(arr, v => alphabet[v % alphabet.length]).join("");
}

export function fmtKg(v) {
  return (Math.round(v * 100) / 100).toString().replace(".", ",") + " kg";
}
export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
