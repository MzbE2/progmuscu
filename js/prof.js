// =====================================================================
//  prof.js — Espace enseignant (PC)
// =====================================================================
import * as DB from "./db.js";
import { OBJECTIFS, maxAffiche, estimer1RM, erreurReps, repsDuTest, REPS_MIN, REPS_MAX, REPS_TEST, fmtKg, fmtDate, RESSENTIS, uniteDe, fmtChargeCourt, urlPhoto, attrsPhoto, TYPES_PHOTOS, definirPhotos, photosDe, CATALOGUE, grouperParZone, MUSCLES, muscleDe, zoneDe, ZONES } from "./programmes.js";

const app = document.getElementById("app");
const modal = document.getElementById("modal");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let etudiants = [], machines = [];
let onglet = "etudiants", filtreGroupe = "", recherche = "", groupeQR = "";

if (DB.MODE_DEMO) document.getElementById("demo").classList.remove("cache");

function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
const urlEtudiant = code => new URL("index.html#" + code, location.href).href;

// Fenêtre de confirmation intégrée à la page
function demander(message, libelle = "Confirmer") {
  return new Promise(res => {
    const d = document.createElement("div");
    d.className = "modal-fond"; d.style.zIndex = 70;
    d.innerHTML = `<div class="modal" style="max-width:420px"><p>${esc(message)}</p>
      <div class="ligne" style="justify-content:flex-end;margin-top:16px">
        <button id="cf-non">Annuler</button><button class="primaire" id="cf-oui">${esc(libelle)}</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector("#cf-non").onclick = () => { d.remove(); res(false); };
    d.querySelector("#cf-oui").onclick = () => { d.remove(); res(true); };
  });
}
const groupes = () => [...new Set(etudiants.map(e => e.groupe).filter(Boolean))].sort();

// ---------------- Connexion ----------------
DB.surEtatProf(async (connecte, user) => {
  if (!connecte) return vueConnexion();
  await entrer(user);
});

async function entrer(user) {
  try {
    await charger();
  } catch (e) {
    // Les règles Firestore refusent ce compte : ce n'est pas l'enseignant autorisé
    console.error(e);
    await DB.profDeconnexion();
    return vueConnexion(`Le compte ${user?.email || ""} n'est pas autorisé. Connectez-vous avec le compte Gmail enseignant.`);
  }
  document.getElementById("btn-deco").classList.remove("cache");
  rendre();
}

function vueConnexion(err = "") {
  document.getElementById("btn-deco").classList.add("cache");
  app.innerHTML = `
    <div class="carte" style="max-width:420px;margin:40px auto">
      <h2>Connexion enseignant</h2>
      <p class="muted small">Connectez-vous avec votre compte Gmail enseignant.</p>
      ${err ? `<p class="small" style="color:var(--bad)">${esc(err)}</p>` : ""}
      <button id="btn-google" class="primaire plein" style="margin-top:14px">Se connecter avec Google</button>
    </div>`;
  document.getElementById("btn-google").onclick = async () => {
    try {
      await DB.profConnexion();
      if (DB.MODE_DEMO) await entrer();
      // en mode Firebase, surEtatProf prend le relais après la connexion
    } catch (e) {
      console.error(e);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      vueConnexion(e.code === "auth/unauthorized-domain"
        ? "Ce site n'est pas autorisé dans Firebase (Authentication > Paramètres > Domaines autorisés)."
        : "Connexion impossible. Réessayez.");
    }
  };
}
document.getElementById("btn-deco").onclick = async () => { await DB.profDeconnexion(); vueConnexion(); };

async function charger() {
  [etudiants, machines] = await Promise.all([DB.listerEtudiants(), DB.getMachines()]);
  try { definirPhotos(await DB.getPhotos(machines)); } catch (e) { /* sans photos */ }
  etudiants.sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, "fr"));
}

// ---------------- Rendu ----------------
function rendre() {
  app.innerHTML = `
    <nav class="onglets no-print">
      ${[["etudiants", `Étudiants (${etudiants.length})`], ["appareils", "Appareils"], ["qr", "QR codes"], ["programmes", "Programmes"]]
        .map(([id, l]) => `<button data-o="${id}" class="${onglet === id ? "actif" : ""}">${l}</button>`).join("")}
    </nav>
    <section id="contenu"></section>`;
  app.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { onglet = b.dataset.o; rendre(); });
  const c = document.getElementById("contenu");
  ({ etudiants: vueEtudiants, appareils: vueAppareils, qr: vueQR, programmes: vueProgrammes })[onglet](c);
}

// ---------------- Étudiants ----------------
function vueEtudiants(c) {
  const actifs = machines.filter(m => m.actif !== false);
  const liste = etudiants.filter(e =>
    (!filtreGroupe || e.groupe === filtreGroupe) &&
    (!recherche || (e.nom + " " + e.prenom + " " + e.code).toLowerCase().includes(recherche.toLowerCase())));
  c.innerHTML = `
    <div class="grille g2 no-print">
      <div class="carte">
        <h3>Ajouter un étudiant</h3>
        <form id="f-add" class="grille g3" style="align-items:end">
          <div><label>Nom</label><input id="a-nom" required></div>
          <div><label>Prénom</label><input id="a-prenom" required></div>
          <div><label>Groupe / créneau</label><input id="a-groupe" list="dl-groupes" placeholder="ex. Mardi 12h"></div>
          <datalist id="dl-groupes">${groupes().map(g => `<option value="${esc(g)}">`).join("")}</datalist>
          <div><button class="primaire">Ajouter</button></div>
        </form>
      </div>
      <div class="carte">
        <h3>Import en liste</h3>
        <p class="small muted">Une ligne par étudiant : <code>Nom;Prénom;Groupe</code> (copier-coller depuis un tableur, tabulations acceptées).</p>
        <textarea id="import" rows="3" placeholder="DUPONT;Léa;Mardi 12h"></textarea>
        <button id="btn-import" style="margin-top:8px">Importer</button>
      </div>
    </div>
    <div class="carte">
      <div class="entete-carte">
        <div class="ligne">
          <input id="rech" placeholder="Rechercher…" value="${esc(recherche)}" style="width:220px">
          <select id="fg" style="width:200px"><option value="">Tous les groupes</option>
            ${groupes().map(g => `<option ${g === filtreGroupe ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>
        </div>
        <div class="ligne"><button id="btn-csv">⬇ Export CSV</button><button id="btn-refresh">↻ Actualiser</button></div>
      </div>
      <div class="table-scroll" style="margin-top:12px">
        ${liste.length ? `<table>
          <thead><tr><th>Nom</th><th>Prénom</th><th>Créneau</th><th>Objectif</th><th>Dernière séance</th><th></th></tr></thead>
          <tbody>${liste.map(e => {
            const o = e.objectif && OBJECTIFS[e.objectif.type];
            const nbT = actifs.filter(m => e.tests?.[m.id]).length;
            return `<tr class="ligne-etudiant" data-voir="${e.code}">
              <td><b>${esc(e.nom)}</b></td><td>${esc(e.prenom)}</td><td>${esc(e.groupe)}</td>
              <td>${o ? `${o.icone} ${esc(o.nom)}<br><span class="small muted">${e.objectif.termine ? "Cycle terminé" : `${e.objectif.nbFaites || 0}/${o.seances} séances`}${e.objectif.changements?.length ? ` · <span title="Appareil changé par l'étudiant·e">↻ ${e.objectif.changements.length} changement${e.objectif.changements.length > 1 ? "s" : ""}</span>` : ""}</span>` : `<span class="muted">—</span>`}</td>
              <td class="small">${fmtDate(e.objectif?.derniere)}</td>
              <td><button class="small" data-voir="${e.code}">Voir <span class="muted">(${nbT} max)</span></button></td>
            </tr>`;
          }).join("")}</tbody></table>` : `<div class="vide">Aucun étudiant${etudiants.length ? " pour ce filtre" : ". Ajoutez-en ci-dessus."}</div>`}
      </div>
    </div>`;

  c.querySelector("#f-add").onsubmit = async ev => {
    ev.preventDefault();
    const e = await DB.creerEtudiant({ nom: c.querySelector("#a-nom").value, prenom: c.querySelector("#a-prenom").value, groupe: c.querySelector("#a-groupe").value });
    toast(`${e.prenom} ajouté·e — code ${e.code}`);
    await charger(); rendre();
  };
  c.querySelector("#btn-import").onclick = async () => {
    const lignes = c.querySelector("#import").value.split("\n").map(l => l.split(/[;\t,]/).map(s => s.trim())).filter(l => l[0] && l[1]);
    if (!lignes.length) return toast("Rien à importer");
    for (const [nom, prenom, groupe] of lignes) await DB.creerEtudiant({ nom, prenom, groupe });
    toast(`${lignes.length} étudiant(s) importé(s)`);
    await charger(); rendre();
  };
  const rech = c.querySelector("#rech");
  rech.oninput = () => { recherche = rech.value; vueEtudiants(c); const r = c.querySelector("#rech"); r.focus(); r.setSelectionRange(r.value.length, r.value.length); };
  c.querySelector("#fg").onchange = ev => { filtreGroupe = ev.target.value; vueEtudiants(c); };
  c.querySelector("#btn-csv").onclick = () => exporterCSV(liste);
  c.querySelector("#btn-refresh").onclick = async () => { await charger(); rendre(); toast("Données actualisées"); };
  c.querySelectorAll("[data-voir]").forEach(b => b.onclick = ev => { ev.stopPropagation(); ficheEtudiant(b.dataset.voir); });
}

function exporterCSV(liste) {
  const actifs = machines.filter(m => m.actif !== false);
  const entete = ["Nom", "Prénom", "Groupe", "Code", ...actifs.flatMap(m => [`${m.nom} charge test (${uniteDe(m)})`, `${m.nom} rép. test`, `${m.nom} max estimé (${uniteDe(m)})`, `${m.nom} date test`]), "Objectif", "Séances faites", "Dernière séance"];
  const rows = liste.map(e => [e.nom, e.prenom, e.groupe, e.code,
    ...actifs.flatMap(m => { const t = e.tests?.[m.id]; return t ? [t.charge3, repsDuTest(t), t.max, fmtDate(t.date)] : ["", "", "", ""]; }),
    e.objectif ? OBJECTIFS[e.objectif.type]?.nom : "", e.objectif?.nbFaites || "", e.objectif?.derniere ? fmtDate(e.objectif.derniere) : ""]);
  const csv = [entete, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""').replace(/^(\d+)\.(\d+)$/, "$1,$2")}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `muscu-suaps-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ---------------- Fiche étudiant ----------------
async function ficheEtudiant(code) {
  const e = await DB.getEtudiant(code);
  const seances = await DB.listerSeances(code);
  const o = e.objectif && OBJECTIFS[e.objectif.type];
  const nomRess = Object.fromEntries(RESSENTIS);
  modal.innerHTML = `
    <div class="modal-fond"><div class="modal">
      <div class="entete-carte">
        <div><h2>${esc(e.prenom)} ${esc(e.nom)}</h2><p class="muted small">${esc(e.groupe)} · code <b>${esc(e.code)}</b></p></div>
        <button id="fermer">✕</button>
      </div>
      <div id="qr-fiche" style="margin:10px 0"></div>
      <h3 style="margin-top:14px">Maxima</h3>
      <table><thead><tr><th>Appareil</th><th>Test (rép. × charge)</th><th>Max estimé</th><th>Date</th><th>Saisir un test</th></tr></thead><tbody>
        ${grouperParZone(machines).map(z => `<tr class="ligne-zone"><td colspan="5">${z.icone} ${esc(z.nom)}</td></tr>` + z.machines.map(m => { const t = e.tests?.[m.id]; return `<tr><td>${esc(m.nom)}${muscleDe(m) ? `<br><span class="small muted">${esc(MUSCLES[muscleDe(m)].nom)}</span>` : ""}</td>
          <td class="num">${t ? `${repsDuTest(t)} × ${fmtChargeCourt(t.charge3, m)}` : "—"}</td><td class="num"><b>${t ? fmtChargeCourt(t.max, m) : "—"}</b></td><td class="small">${t ? fmtDate(t.date) : ""}</td>
          <td><div class="ligne" style="flex-wrap:nowrap;gap:4px"><input type="number" step="${m.increment}" data-test-input="${m.id}" placeholder="${uniteDe(m)}" style="width:90px"><span class="small">×</span><input type="number" step="1" min="${REPS_MIN}" max="${REPS_MAX}" value="${REPS_TEST}" data-test-reps="${m.id}" title="Répétitions (${REPS_MIN} à ${REPS_MAX})" style="width:60px"><span class="small">rép.</span><button class="small" data-test="${m.id}">OK</button></div></td></tr>`; }).join("")).join("")}
      </tbody></table>
      <h3 style="margin-top:18px">Objectif</h3>
      <p>${o ? `${o.icone} <b>${esc(o.nom)}</b> — ${e.objectif.termine ? "cycle terminé" : `${seances.filter(s => s.cycleId === e.objectif.cycleId).length}/${o.seances} séances`} (début ${fmtDate(e.objectif.debut)})` : "Aucun objectif choisi."}</p>
      ${o && e.objectif.selection?.length ? `<p class="small">Appareils du cycle : ${e.objectif.selection.map(id => machines.find(m => m.id === id)).filter(Boolean).map(m => esc(m.nom)).join(" · ")}</p>` : ""}
      ${o && e.objectif.changements?.length ? `<p class="small"><b>Changements faits par l'étudiant·e :</b><br>${e.objectif.changements.map(ch => `${fmtDate(ch.date)} : ${esc(ch.deNom)} → <b>${esc(ch.versNom)}</b>${ch.raison ? ` <span class="muted">(« ${esc(ch.raison)} »)</span>` : ""}`).join("<br>")}</p>` : ""}
      <h3 style="margin-top:18px">Carnet d'entraînement (${seances.length})</h3>
      ${seances.length ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Séance</th><th>Appareil</th><th>Charge</th><th>Séries</th><th>Ressenti</th></tr></thead><tbody>
        ${[...seances].reverse().map(s => (s.lignes?.length ? s.lignes : [null]).map((l, i) => `<tr>
          <td class="small">${i === 0 ? fmtDate(s.date) : ""}</td>
          <td class="small">${i === 0 ? (s.bilan ? "Bilan" : `${OBJECTIFS[s.objectif]?.icone || ""} n°${s.num}`) : ""}</td>
          <td>${l ? esc(l.machine) : "—"}</td><td class="num">${l ? fmtChargeCourt(l.charge, { unite: l.unite }) : ""}</td>
          <td class="num">${l ? `${l.seriesReussies}/${l.seriesPrevues} × ${l.repsPrevues}` : ""}</td>
          <td class="small">${l ? esc(nomRess[l.ressenti] || l.ressenti) : ""}</td></tr>`).join("")
          + (s.commentaire ? `<tr><td></td><td colspan="5" class="small muted">💬 ${esc(s.commentaire)}</td></tr>` : "")).join("")}
      </tbody></table></div>` : `<p class="muted">Aucune séance.</p>`}
      <div class="ligne espace" style="margin-top:20px">
        <button class="danger" id="suppr">Supprimer cet étudiant</button>
        <a class="btn" href="${urlEtudiant(e.code)}" target="_blank">Ouvrir sa vue étudiant ↗</a>
      </div>
    </div></div>`;
  try { new QRCode(document.getElementById("qr-fiche"), { text: urlEtudiant(e.code), width: 96, height: 96 }); } catch (err) {}
  const fermer = async (recharger) => { modal.innerHTML = ""; if (recharger) { await charger(); rendre(); } };
  modal.querySelector("#fermer").onclick = () => fermer(true);
  modal.querySelector(".modal-fond").onclick = ev => { if (ev.target.classList.contains("modal-fond")) fermer(true); };
  modal.querySelector("#suppr").onclick = async () => {
    if (!(await demander(`Supprimer définitivement ${e.prenom} ${e.nom} et tout son historique ?`, "Supprimer"))) return;
    await DB.supprimerEtudiant(e.code); toast("Étudiant supprimé"); fermer(true);
  };
  modal.querySelectorAll("[data-test]").forEach(b => b.onclick = async () => {
    const m = machines.find(x => x.id === b.dataset.test);
    const v = parseFloat(String(modal.querySelector(`[data-test-input="${m.id}"]`).value).replace(",", "."));
    const reps = Number(modal.querySelector(`[data-test-reps="${m.id}"]`).value);
    if (!(v > 0)) return;
    const err = erreurReps(reps);
    if (err) return toast(err);
    const max = maxAffiche(v, m.increment, reps), date = new Date().toISOString();
    const ancien = e.tests?.[m.id];
    const tests = { ...(e.tests || {}), [m.id]: { charge3: v, reps, max, date, historique: [...(ancien?.historique || []), { date, charge3: v, reps, max }] } };
    const champs = { tests };
    if (e.objectif) { const obj = JSON.parse(JSON.stringify(e.objectif)); (obj.ajust ||= {})[m.id] = 0; (obj.statuts ||= {})[m.id] = []; champs.objectif = obj; }
    await DB.majEtudiant(e.code, champs);
    toast(`Test enregistré : max ${fmtChargeCourt(max, m)}`);
    ficheEtudiant(code);
  });
}

// ---------------- Appareils ----------------
// ---------- Catalogue d'appareils ----------
// Retrouve l'appareil de la salle qui correspond à une fiche du catalogue (même id, ou nom contenant un mot-clé)
const normTxt = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function correspondance(k, liste, dejaPris = new Set()) {
  return liste.find(m => m.id === k.id && !dejaPris.has(m.id))
    || liste.find(m => !dejaPris.has(m.id) && !CATALOGUE.some(x => x.id === m.id) && k.motsCles.some(mot => normTxt(m.nom).includes(normTxt(mot))));
}

function ouvrirCatalogue(c, lire) {
  machines = lire();
  const pris = new Set();
  const lignes = CATALOGUE.map(k => {
    const m = correspondance(k, machines, pris);
    if (m) pris.add(m.id);
    return { k, m };
  });
  modal.innerHTML = `
    <div class="modal-fond"><div class="modal" style="max-width:720px">
      <div class="entete-carte"><h2>📚 Catalogue d'appareils</h2><button id="fermer">✕</button></div>
      <p class="small muted">Cochez les appareils de votre salle. Chaque fiche contient la photo, l'unité, le pas, la charge de départ et une consigne de sécurité.
      Un appareil déjà présent est <b>mis à jour</b> (les tests des étudiants sont conservés). Vous pourrez supprimer ou corriger un appareil ensuite dans le tableau.</p>
      <div class="ligne" style="margin:8px 0"><button id="cat-tout">Tout cocher</button><button id="cat-rien">Tout décocher</button></div>
      <div class="catalogue-liste">
        ${lignes.map(({ k, m }, i) => `<label class="catalogue-item">
          <input type="checkbox" data-cat="${i}">
          <img src="img/appareils/${k.dossier}/appareil.webp" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <span><b>${esc(k.nom)}</b><br><span class="small muted">${esc(k.modele)} · ${k.unite === "lbs" ? "pile en lbs" : k.chargeMin ? `départ ${fmtKg(k.chargeMin)}` : "départ à vérifier"}</span>
          ${m ? `<br><span class="small" style="color:var(--accent)">↻ mettra à jour « ${esc(m.nom)} »</span>` : ""}</span>
        </label>`).join("")}
      </div>
      <div class="ligne" style="justify-content:flex-end;margin-top:14px">
        <button id="cat-annuler">Annuler</button><button class="primaire" id="cat-ok">Ajouter la sélection</button>
      </div>
    </div></div>`;
  const fermer = () => { modal.innerHTML = ""; };
  modal.querySelector("#fermer").onclick = fermer;
  modal.querySelector("#cat-annuler").onclick = fermer;
  const cases = [...modal.querySelectorAll("[data-cat]")];
  const majBouton = () => { const n = cases.filter(x => x.checked).length; modal.querySelector("#cat-ok").textContent = n ? `Ajouter la sélection (${n})` : "Ajouter la sélection"; };
  cases.forEach(x => x.onchange = majBouton);
  modal.querySelector("#cat-tout").onclick = () => { cases.forEach(x => x.checked = true); majBouton(); };
  modal.querySelector("#cat-rien").onclick = () => { cases.forEach(x => x.checked = false); majBouton(); };
  modal.querySelector("#cat-ok").onclick = async () => {
    const choix = cases.filter(x => x.checked).map(x => lignes[Number(x.dataset.cat)]);
    if (!choix.length) return toast("Cochez au moins un appareil.");
    let ajout = 0, maj = 0;
    for (const { k, m } of choix) {
      const { motsCles, modele, ...fiche } = k;
      if (m) { Object.assign(m, { ...fiche, id: m.id }); maj++; }
      else { machines.push({ ...fiche }); ajout++; }
    }
    await DB.saveMachines(machines);
    fermer();
    toast(`${ajout} appareil(s) ajouté(s), ${maj} mis à jour ✓`);
    vueAppareils(c);
  };
}

function vueAppareils(c) {
  c.innerHTML = `
    <div class="carte">
      <h3>📷 Photos des appareils</h3>
      <p class="small muted">Les <b>photos du catalogue</b> (marquées 📚) sont utilisées en priorité. Pour les cases vides 📷, prenez la photo à la salle avec votre téléphone
      (ou choisissez-en une dans la galerie) : elle est enregistrée tout de suite et visible par les étudiants.</p>
      ${grouperParZone(machines).map(z => `<h4 class="titre-zone">${z.icone} ${esc(z.nom)}</h4>
      <div class="photos-appareils">
        ${z.machines.map(m => `<div class="photo-appareil">
          <b>${esc(m.nom)}</b>
          <div class="photo-cases">${TYPES_PHOTOS.map(([type, titre]) => {
            const url = urlPhoto(m, type), prise = !!photosDe(m.id)[type];
            return `<div class="photo-case">
              <label class="photo-bouton" title="${esc(titre)}">
                ${url ? `<img ${attrsPhoto(m, type, "camera")} alt="" onload="this.closest('.photo-case').classList.toggle('du-catalogue', !this.src.startsWith('data:'))">` : `<span>📷</span>`}
                <input type="file" accept="image/*" data-photo="${esc(m.id)}" data-type="${type}" hidden>
              </label>
              <span class="small muted">${esc(titre)}</span>
              <span class="badge-catalogue small">📚 catalogue</span>
              ${prise ? `<button class="lien danger small" data-suppr-photo="${esc(m.id)}" data-type="${type}">Retirer</button>` : ""}
            </div>`;
          }).join("")}</div>
        </div>`).join("")}
      </div>`).join("")}
    </div>
    <div class="carte">
      <div class="entete-carte"><h3>Appareils de la salle</h3>
        <div class="ligne">
          <button id="btn-catalogue">📚 Catalogue (${CATALOGUE.length} appareils)</button>
          <button id="btn-ajout">+ Ajouter un appareil</button>
        </div></div>
      <p class="small muted"><b>Unité</b> : « lbs » pour une pile de plaques graduée en livres (l'étudiant saisit le chiffre gravé sur la plaque), « kg » pour une barre ou des disques.
      <b>Pas</b> : le plus petit saut de charge (2,5 kg pour une barre, 5 lbs pour une pile).
      <b>Min / Max</b> : la plus légère et la plus lourde charge possibles (barre à vide, première et dernière plaque).</p>
      <p class="small muted"><b>Dossier photos</b> (facultatif) : seulement si vous déposez vous-même des photos sur GitHub dans <code>img/appareils/</code>.
      Le plus simple est d'utiliser les boutons 📷 ci-dessus.</p>
      <div class="table-scroll"><table class="table-appareils">
        <thead><tr><th>Photo</th><th>Nom</th><th>Muscle</th><th>Unité</th><th>Pas</th><th>Min</th><th>Max</th><th>Dossier photos</th><th>Consigne de sécurité</th><th>Actif</th><th></th></tr></thead>
        <tbody id="tb-app">${grouperParZone(machines.map((m, i) => ({ ...m, _i: i }))).map(z => `<tr class="ligne-zone"><td colspan="11">${z.icone} ${esc(z.nom)}</td></tr>` + z.machines.map(m => ({ m: machines[m._i], i: m._i })).map(({ m, i }) => `<tr data-i="${i}">
          <td style="width:56px">${apercu(m)}</td>
          <td style="min-width:150px"><input class="m-nom" value="${esc(m.nom)}"></td>
          <td style="width:140px"><select class="m-muscle"><option value="">${muscleDe(m) && !m.muscle ? `auto : ${esc(MUSCLES[muscleDe(m)].nom)}` : "—"}</option>
            ${ZONES.filter(z => z.id !== "autre").map(z => `<optgroup label="${esc(z.nom)}">${Object.entries(MUSCLES).filter(([, v]) => v.zone === z.id).map(([k, v]) => `<option value="${k}" ${m.muscle === k ? "selected" : ""}>${esc(v.nom)}</option>`).join("")}</optgroup>`).join("")}</select></td>
          <td style="width:96px"><select class="m-unite"><option value="kg" ${uniteDe(m) === "kg" ? "selected" : ""}>kg</option><option value="lbs" ${uniteDe(m) === "lbs" ? "selected" : ""}>lbs</option></select></td>
          <td style="width:92px"><input class="m-inc" type="number" step="0.25" min="0.25" value="${m.increment}"></td>
          <td style="width:92px"><input class="m-min" type="number" step="0.5" min="0" value="${m.chargeMin || 0}"></td>
          <td style="width:96px"><input class="m-max" type="number" step="0.5" min="0" value="${m.chargeMax || ""}" placeholder="—"></td>
          <td style="min-width:170px"><input class="m-dossier" value="${esc(m.dossier || "")}" placeholder="ex. triceps-pressdown"></td>
          <td style="min-width:180px"><input class="m-cons" value="${esc(m.consigne || "")}"></td>
          <td style="width:56px;text-align:center"><input class="m-actif" type="checkbox" ${m.actif !== false ? "checked" : ""} style="width:auto"></td>
          <td><button class="lien danger" data-del="${i}" title="Retirer">✕</button></td></tr>`).join("")).join("")}
        </tbody></table></div>
      <button class="primaire" id="btn-save" style="margin-top:14px">Enregistrer les appareils</button>
      <p class="small muted" style="margin-top:8px">Conseil : décochez « Actif » plutôt que de supprimer un appareil déjà testé, pour garder l'historique des étudiants.
      Ne changez pas l'unité d'un appareil déjà testé : les maxima enregistrés seraient lus dans la nouvelle unité.</p>
    </div>`;
  const dossierPropre = v => v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const lire = () => [...c.querySelectorAll("#tb-app tr[data-i]")].map(tr => {
    const m = machines[+tr.dataset.i];
    const { muscle: _ancien, ...base } = m;
    const muscle = tr.querySelector(".m-muscle").value;
    return { ...base, ...(muscle ? { muscle } : {}), nom: tr.querySelector(".m-nom").value.trim(),
      unite: tr.querySelector(".m-unite").value,
      increment: +tr.querySelector(".m-inc").value || 2.5,
      chargeMin: +tr.querySelector(".m-min").value || 0,
      chargeMax: +tr.querySelector(".m-max").value || 0,
      dossier: dossierPropre(tr.querySelector(".m-dossier").value),
      consigne: tr.querySelector(".m-cons").value.trim(), actif: tr.querySelector(".m-actif").checked };
  });
  // Aperçu de la photo dès que le nom du dossier est saisi
  c.querySelectorAll(".m-dossier").forEach(inp => inp.onchange = () => {
    const td = inp.closest("tr").querySelector("td");
    td.innerHTML = apercu({ dossier: dossierPropre(inp.value) });
  });
  // Photos : compression puis enregistrement immédiat
  c.querySelectorAll("[data-photo]").forEach(inp => inp.onchange = async () => {
    const f = inp.files?.[0];
    if (!f) return;
    const m = machines.find(x => x.id === inp.dataset.photo);
    if (!m) return;
    try {
      toast("Envoi de la photo…");
      // Un appareil tout juste ajouté doit exister dans la liste enregistrée
      machines = lire().filter(x => x.nom);
      await DB.saveMachines(machines);
      const dataUrl = await compresserPhoto(f);
      await DB.savePhoto(m.id, inp.dataset.type, dataUrl);
      definirPhotos({ ...Object.fromEntries(machines.map(x => [x.id, photosDe(x.id)])), [m.id]: { ...photosDe(m.id), [inp.dataset.type]: dataUrl } });
      toast("Photo enregistrée ✓");
      vueAppareils(c);
    } catch (e) {
      console.error(e);
      toast("Échec de l'envoi : vérifiez la connexion et réessayez.");
    }
  });
  c.querySelectorAll("[data-suppr-photo]").forEach(b => b.onclick = async () => {
    if (!(await demander("Retirer cette photo ?", "Retirer"))) return;
    const id = b.dataset.supprPhoto, type = b.dataset.type;
    await DB.savePhoto(id, type, null);
    const p = { ...photosDe(id) }; delete p[type];
    definirPhotos({ ...Object.fromEntries(machines.map(x => [x.id, photosDe(x.id)])), [id]: p });
    toast("Photo retirée"); vueAppareils(c);
  });
  c.querySelector("#btn-catalogue").onclick = () => ouvrirCatalogue(c, lire);
  c.querySelector("#btn-ajout").onclick = () => {
    machines = lire();
    machines.push({ id: "m" + Date.now().toString(36), nom: "Nouvel appareil", unite: "lbs", increment: 5, chargeMin: 5, chargeMax: 100, dossier: "", consigne: "", actif: true });
    vueAppareils(c);
  };
  c.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (!(await demander("Retirer cet appareil ? Les tests déjà faits dessus ne seront plus affichés.", "Retirer"))) return;
    const k = [...c.querySelectorAll("#tb-app tr[data-i]")].findIndex(tr => tr.dataset.i === b.dataset.del);
    machines = lire(); machines.splice(k, 1); vueAppareils(c);
  });
  c.querySelector("#btn-save").onclick = async () => {
    machines = lire().filter(m => m.nom);
    await DB.saveMachines(machines); toast("Appareils enregistrés"); rendre();
  };
}

// Réduit la photo du téléphone (souvent 3 à 5 Mo) à environ 100 Ko : 900 px max, JPEG.
// Firestore limite un document à 1 Mo ; les 3 photos d'un appareil tiennent largement.
async function compresserPhoto(fichier, cote = 900) {
  let src;
  try { src = await createImageBitmap(fichier, { imageOrientation: "from-image" }); }
  catch (e) {
    src = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(fichier); });
  }
  const w0 = src.width, h0 = src.height, r = Math.min(1, cote / Math.max(w0, h0));
  const cv = document.createElement("canvas");
  cv.width = Math.round(w0 * r); cv.height = Math.round(h0 * r);
  cv.getContext("2d").drawImage(src, 0, 0, cv.width, cv.height);
  let q = 0.75, url = cv.toDataURL("image/jpeg", q);
  while (url.length > 250000 && q > 0.35) { q -= 0.1; url = cv.toDataURL("image/jpeg", q); }
  return url;
}

// Petite photo de l'appareil, ou un tiret s'il n'y en a pas
function apercu(m) {
  const url = urlPhoto(m, "appareil");
  return url
    ? `<img class="apercu" ${attrsPhoto(m, "appareil", "camera")} alt="">`
    : `<span class="muted">—</span>`;
}

// ---------------- QR codes ----------------
function vueQR(c) {
  const liste = etudiants.filter(e => !groupeQR || e.groupe === groupeQR);
  c.innerHTML = `
    <div class="carte no-print">
      <div class="entete-carte">
        <div class="ligne"><label style="margin:0">Groupe</label>
          <select id="gqr" style="width:220px"><option value="">Tous</option>${groupes().map(g => `<option ${g === groupeQR ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
        <button class="primaire" onclick="window.print()">🖨 Imprimer les cartes</button>
      </div>
      <p class="small muted">Chaque étudiant scanne sa carte avec l'appareil photo de son téléphone, ou tape son code sur la page d'accueil.</p>
    </div>
    <div class="qr-grille">${liste.map(e => `
      <div class="qr-carte">
        <div style="font-weight:600">${esc(e.prenom)} ${esc(e.nom)}</div>
        <div class="small" style="color:#666">${esc(e.groupe)}</div>
        <div class="qr" data-qr="${e.code}"></div>
        <div class="code">${esc(e.code)}</div>
        <div class="small" style="color:#666;word-break:break-all">${esc(new URL("index.html", location.href).href)}</div>
      </div>`).join("") || `<div class="vide">Aucun étudiant.</div>`}</div>`;
  c.querySelector("#gqr").onchange = ev => { groupeQR = ev.target.value; vueQR(c); };
  c.querySelectorAll("[data-qr]").forEach(d => {
    try { new QRCode(d, { text: urlEtudiant(d.dataset.qr), width: 130, height: 130 }); } catch (e) { d.textContent = "(QR indisponible)"; }
  });
}

// ---------------- Programmes (référence) ----------------
function vueProgrammes(c) {
  c.innerHTML = `
    <div class="carte">
      <h3>Référentiel des objectifs</h3>
      <p class="small muted">Valeurs modifiables dans <code>js/programmes.js</code>. La charge et les répétitions évoluent linéairement du début à la fin du cycle ;
      la dernière séance est un re-test (3 à 10 répétitions). Régulation automatique : 2 séances « faciles » de suite → +1 incrément ; un échec → −1 incrément.</p>
      <div class="table-scroll"><table>
        <thead><tr><th>Objectif</th><th>Séances</th><th>Séries</th><th>Rép. (début → fin)</th><th>% du max (début → fin)</th><th>Récup.</th><th>Format</th></tr></thead>
        <tbody>${Object.values(OBJECTIFS).map(o => `<tr>
          <td>${o.icone} <b>${esc(o.nom)}</b><br><span class="small muted">${esc(o.effets)}</span></td>
          <td class="num">${o.seances}</td><td class="num">${o.series[0]} → ${o.series[1]}</td>
          <td class="num">${o.reps[1]} → ${o.reps[0]}</td><td class="num">${o.pct[0]} → ${o.pct[1]} %</td>
          <td>${esc(o.recup)}</td><td>${o.format === "circuit" ? "Circuit" : "Classique"}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>
    <div class="carte">
      <h3>Estimation du max (formule de Brzycki)</h3>
      <p>L'étudiant teste une charge qu'il soulève proprement <b>entre ${REPS_MIN} et ${REPS_MAX} fois</b>.
      1RM = charge × 36 / (37 − répétitions), arrondi à l'incrément inférieur de l'appareil.</p>
      <div class="table-scroll"><table><thead><tr><th>Charge du test</th>${[20, 30, 40, 50, 60, 80, 100].map(v => `<th class="num">${v} kg</th>`).join("")}</tr></thead>
      <tbody>${[3, 5, 8, 10].map(r => `<tr><td><b>${r} rép.</b> <span class="small muted">(× ${(36 / (37 - r)).toFixed(3).replace(".", ",")})</span></td>${[20, 30, 40, 50, 60, 80, 100].map(v => `<td class="num">${fmtKg(maxAffiche(v, 2.5, r))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <h3 style="margin-top:14px">Pourquoi pas plus de ${REPS_MAX} répétitions ?</h3>
      <p class="small">Au-delà de ${REPS_MAX} répétitions, l'estimation <b>n'est plus fiable</b> et l'appli refuse la saisie :</p>
      <ul class="small">
        <li><b>L'endurance prend le dessus sur la force</b> : une série longue mesure surtout la résistance à la fatigue, très variable d'une personne à l'autre. Deux étudiants de même force peuvent faire 12 ou 20 répétitions avec la même charge.</li>
        <li><b>Les formules divergent</b> : jusqu'à 10 répétitions, Brzycki, Epley, Lander… donnent des résultats proches ; au-delà, l'écart dépasse souvent 10 %.</li>
        <li><b>Brzycki a été validée jusqu'à 10 répétitions</b> (Brzycki, 1993) ; ensuite le dénominateur (37 − rép.) devient petit et le résultat s'envole.</li>
        <li><b>La technique se dégrade</b> en fin de série longue : les dernières répétitions sont moins représentatives.</li>
      </ul>
      <p class="small muted">Conseil : si l'étudiant dépasse 10 répétitions, la charge est trop légère. Il se repose 3 à 5 min, ajoute de la charge et refait le test. Avec des débutants, visez 5 à 8 répétitions.</p>
    </div>`;
}
