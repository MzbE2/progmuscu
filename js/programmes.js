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

// Photos : deux sources possibles
//  1. prises depuis l'espace enseignant (bouton 📷, sur téléphone) → stockées dans Firestore
//  2. déposées sur GitHub dans img/appareils/<dossier>/ :
//     appareil.webp (photo de l'appareil), consigne.webp (pictogramme), pile.webp (pile de charges)
// Une photo prise depuis l'appli est prioritaire sur celle du dossier GitHub.
export const TYPES_PHOTOS = [
  ["appareil", "L'appareil"],
  ["consigne", "La consigne"],
  ["pile", "Les charges"]
];
let PHOTOS = {}; // { idAppareil: { appareil: "data:image/jpeg;base64,…", consigne: …, pile: … } }
export function definirPhotos(map) { PHOTOS = map || {}; }
export function photosDe(machineId) { return PHOTOS[machineId] || {}; }

export function urlPhoto(machine, type) {
  const prise = PHOTOS[machine?.id]?.[type];
  if (prise) return prise;
  const d = String(machine?.dossier || "").trim();
  return d ? `img/appareils/${encodeURIComponent(d)}/${type}.webp` : "";
}

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
    motsCles: ["leg press", "presse", "legpress"],
    unite: "kg", increment: 2.5, chargeMin: 75, chargeMax: 490, dossier: "leg-press-45", actif: true,
    info: "Le chariot vide pèse déjà 75 kg (charge de départ indiquée par Matrix). Saisissez toujours la charge totale : 75 kg + les disques chargés.",
    consigne: "Dos et bassin collés au dossier. Pieds à plat, largeur du bassin, genoux dans l'axe des pieds. Réglez la butée basse avant de commencer. Déverrouillez le chariot seulement pieds en place, reverrouillez avant de descendre. Ne verrouillez pas les genoux en haut. Chargez et déchargez les disques des deux côtés en même temps." }
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
