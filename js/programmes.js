// =====================================================================
//  programmes.js — Logique métier : estimation du max et programmes
//  Vous pouvez modifier les valeurs des OBJECTIFS ci-dessous sans risque.
// =====================================================================

// ---------- 1. Estimation du 1RM à partir du 3RM ----------
// Formule de Brzycki (1993) : 1RM = charge × 36 / (37 − répétitions)
// Pour 3 répétitions : 1RM = charge × 36/34 ≈ charge × 1,059
export const REPS_TEST = 3;

export function estimer1RM(charge3RM, reps = REPS_TEST) {
  const c = Number(charge3RM);
  if (!c || c <= 0) return 0;
  return c * 36 / (37 - reps);
}

// Arrondi à l'incrément de l'appareil
export function arrondir(valeur, increment = 2.5, mode = "proche") {
  const inc = Number(increment) || 1;
  const n = valeur / inc;
  const r = mode === "bas" ? Math.floor(n + 1e-9) : Math.round(n);
  return Math.round(r * inc * 100) / 100;
}

// Max affiché : arrondi INFÉRIEUR à l'incrément (estimation prudente)
export function maxAffiche(charge3RM, increment) {
  return arrondir(estimer1RM(charge3RM), increment, "bas");
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
    return { bilan: true, texte: "Séance bilan : refaites le test 3RM sur cet appareil pour mesurer vos progrès." };
  }
  // Phase de 0 (début) à 1 (fin du cycle, hors séance bilan)
  const t = total > 2 ? (numSeance - 1) / (total - 2) : 0;
  const pct = o.pct[0] + (o.pct[1] - o.pct[0]) * t;
  const reps = Math.round(o.reps[1] - (o.reps[1] - o.reps[0]) * t);
  const series = t < 0.34 ? o.series[0] : o.series[1];
  const inc = Number(machine.increment) || 2.5;
  const min = Number(machine.chargeMin) || 0;
  let charge = arrondir(max1RM * pct / 100 + ajustKg, inc);
  if (charge < min) charge = min;
  return {
    bilan: false, series, reps, pct: Math.round(pct), charge,
    recup: o.recup, recupSec: o.recupSec, consigne: o.consigne,
    echauffement: echauffement(objectifId, max1RM, machine)
  };
}

// Échauffement progressif
export function echauffement(objectifId, max1RM, machine) {
  const inc = Number(machine.increment) || 2.5;
  const min = Number(machine.chargeMin) || 0;
  const paliers = [[10, 40], [6, 55]];
  if (["force", "hypertrophie", "puissance", "sculpter"].includes(objectifId)) paliers.push([3, 70]);
  if (objectifId === "force") paliers.push([1, 80]);
  return paliers.map(([r, p]) => ({ reps: r, charge: Math.max(min, arrondir(max1RM * p / 100, inc)) }));
}

// ---------- 4. Régulation de la charge ----------
// statut d'une ligne de carnet : "facile" | "ok" | "echec"
export function statutLigne(ligne, seriesPrevues) {
  if (ligne.seriesReussies < seriesPrevues - 1 || ligne.ressenti >= 10) return "echec";
  if (ligne.seriesReussies >= seriesPrevues && ligne.ressenti <= 6) return "facile";
  return "ok"; // une seule série manquée = on maintient la charge
}

// Calcule le nouvel ajustement (en kg) à partir de l'historique de l'appareil
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
    consigne: "Pareur obligatoire. Pieds au sol, omoplates serrées, barre au niveau des pectoraux." }
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
