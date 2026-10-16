// =====================================================================
//  db.js — Accès aux données (Firebase Firestore ou mode démo local)
// =====================================================================
import { firebaseConfig } from "./firebase-config.js";
import { MACHINES_DEFAUT, genererCode } from "./programmes.js";

export const MODE_DEMO = String(firebaseConfig.apiKey || "").includes("COLLER");

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
let fs, au, db, auth;

async function fb() {
  if (db) return;
  const app = await import(FB + "firebase-app.js");
  fs = await import(FB + "firebase-firestore.js");
  au = await import(FB + "firebase-auth.js");
  const a = app.initializeApp(firebaseConfig);
  db = fs.getFirestore(a);
  auth = au.getAuth(a);
}

// ---------- Stockage démo (navigateur) ----------
const CLE = "muscu-suaps-demo";
let memoire = null;
function lireDemo() {
  // relecture à chaque appel : plusieurs onglets (prof + étudiant) partagent les données
  try { const lu = JSON.parse(localStorage.getItem(CLE)); if (lu) memoire = lu; } catch (e) { /* on garde la mémoire */ }
  if (!memoire) memoire = { etudiants: {}, machines: clone(MACHINES_DEFAUT) };
  return memoire;
}
function ecrireDemo() {
  try { localStorage.setItem(CLE, JSON.stringify(memoire)); } catch (e) { /* stockage indisponible */ }
}
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- Authentification enseignant ----------
// Connexion avec un compte Google (Gmail)
export async function profConnexion() {
  if (MODE_DEMO) { sessionStorageSafe("set", "prof", "1"); return true; }
  await fb();
  const provider = new au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await au.signInWithPopup(auth, provider);
  } catch (e) {
    // fenêtre bloquée (certains navigateurs / téléphones) → redirection
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await au.signInWithRedirect(auth, provider);
    } else throw e;
  }
  return true;
}
export async function profDeconnexion() {
  if (MODE_DEMO) { sessionStorageSafe("del", "prof"); return; }
  await fb(); await au.signOut(auth);
}
export async function surEtatProf(cb) {
  if (MODE_DEMO) { cb(sessionStorageSafe("get", "prof") === "1"); return; }
  await fb();
  au.onAuthStateChanged(auth, u => cb(!!u, u));
}
function sessionStorageSafe(op, k, v) {
  try {
    if (op === "get") return sessionStorage.getItem(k);
    if (op === "set") sessionStorage.setItem(k, v);
    if (op === "del") sessionStorage.removeItem(k);
  } catch (e) { return null; }
}

// ---------- Appareils ----------
export async function getMachines() {
  if (MODE_DEMO) return clone(lireDemo().machines);
  await fb();
  const s = await fs.getDoc(fs.doc(db, "config", "machines"));
  return s.exists() ? s.data().liste : clone(MACHINES_DEFAUT);
}
export async function saveMachines(liste) {
  if (MODE_DEMO) { lireDemo().machines = clone(liste); ecrireDemo(); return; }
  await fb();
  await fs.setDoc(fs.doc(db, "config", "machines"), { liste });
}

// ---------- Étudiants ----------
export async function getEtudiant(code) {
  code = String(code || "").trim().toUpperCase();
  if (!code) return null;
  if (MODE_DEMO) {
    const e = lireDemo().etudiants[code];
    if (!e) return null;
    const { seances, ...reste } = e;
    return clone(reste);
  }
  await fb();
  const s = await fs.getDoc(fs.doc(db, "etudiants", code));
  return s.exists() ? s.data() : null;
}

export async function majEtudiant(code, champs) {
  champs = { ...champs, majLe: new Date().toISOString() };
  if (MODE_DEMO) {
    Object.assign(lireDemo().etudiants[code], clone(champs)); ecrireDemo(); return;
  }
  await fb();
  await fs.updateDoc(fs.doc(db, "etudiants", code), champs);
}

export async function creerEtudiant({ nom, prenom, groupe }) {
  let code;
  for (let i = 0; i < 10; i++) {
    code = genererCode(6);
    if (!(await getEtudiant(code))) break;
  }
  const e = {
    code, nom: nom.trim(), prenom: prenom.trim(), groupe: (groupe || "").trim(),
    creeLe: new Date().toISOString(), majLe: new Date().toISOString(),
    tests: {}, objectif: null
  };
  if (MODE_DEMO) { lireDemo().etudiants[code] = { ...clone(e), seances: [] }; ecrireDemo(); return e; }
  await fb();
  await fs.setDoc(fs.doc(db, "etudiants", code), e);
  return e;
}

export async function supprimerEtudiant(code) {
  if (MODE_DEMO) { delete lireDemo().etudiants[code]; ecrireDemo(); return; }
  await fb();
  const ss = await fs.getDocs(fs.collection(db, "etudiants", code, "seances"));
  for (const d of ss.docs) await fs.deleteDoc(d.ref);
  await fs.deleteDoc(fs.doc(db, "etudiants", code));
}

export async function listerEtudiants() {
  if (MODE_DEMO) {
    return Object.values(lireDemo().etudiants).map(({ seances, ...r }) => ({ ...clone(r), nbSeances: seances.length }));
  }
  await fb();
  const s = await fs.getDocs(fs.collection(db, "etudiants"));
  return s.docs.map(d => d.data());
}

// ---------- Séances (carnet d'entraînement) ----------
export async function ajouterSeance(code, seance) {
  seance = { ...seance, date: new Date().toISOString() };
  if (MODE_DEMO) {
    const e = lireDemo().etudiants[code];
    e.seances.push({ id: genererCode(10), ...clone(seance) }); ecrireDemo(); return;
  }
  await fb();
  await fs.addDoc(fs.collection(db, "etudiants", code, "seances"), seance);
}

export async function listerSeances(code) {
  if (MODE_DEMO) {
    const e = lireDemo().etudiants[code];
    return e ? clone(e.seances).sort((a, b) => a.date.localeCompare(b.date)) : [];
  }
  await fb();
  const s = await fs.getDocs(fs.query(fs.collection(db, "etudiants", code, "seances"), fs.orderBy("date")));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
