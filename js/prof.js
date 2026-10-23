// =====================================================================
//  prof.js — Espace enseignant (PC)
// =====================================================================
import * as DB from "./db.js";
import { OBJECTIFS, maxAffiche, fmtKg, fmtDate, RESSENTIS, uniteDe, fmtChargeCourt, urlPhoto } from "./programmes.js";

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
          <thead><tr><th>Nom</th><th>Prénom</th><th>Groupe</th><th>Code</th>
            ${actifs.map(m => `<th>${esc(m.nom)}<br><span style="text-transform:none">3RM → max</span></th>`).join("")}
            <th>Objectif</th><th>Dernière séance</th><th></th></tr></thead>
          <tbody>${liste.map(e => {
            const o = e.objectif && OBJECTIFS[e.objectif.type];
            return `<tr>
              <td><b>${esc(e.nom)}</b></td><td>${esc(e.prenom)}</td><td>${esc(e.groupe)}</td>
              <td><code>${esc(e.code)}</code></td>
              ${actifs.map(m => { const t = e.tests?.[m.id]; return `<td class="num">${t ? `${fmtChargeCourt(t.charge3, m)} → <b>${fmtChargeCourt(t.max, m)}</b>` : `<span class="muted">—</span>`}</td>`; }).join("")}
              <td>${o ? `${o.icone} ${esc(o.nom)}<br><span class="small muted">${e.objectif.termine ? "Cycle terminé" : `${e.objectif.nbFaites || 0}/${o.seances} séances`}</span>` : `<span class="muted">—</span>`}</td>
              <td class="small">${fmtDate(e.objectif?.derniere)}</td>
              <td><button class="lien" data-voir="${e.code}">Voir</button></td>
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
  c.querySelectorAll("[data-voir]").forEach(b => b.onclick = () => ficheEtudiant(b.dataset.voir));
}

function exporterCSV(liste) {
  const actifs = machines.filter(m => m.actif !== false);
  const entete = ["Nom", "Prénom", "Groupe", "Code", ...actifs.flatMap(m => [`${m.nom} 3RM (${uniteDe(m)})`, `${m.nom} max estimé (${uniteDe(m)})`, `${m.nom} date test`]), "Objectif", "Séances faites", "Dernière séance"];
  const rows = liste.map(e => [e.nom, e.prenom, e.groupe, e.code,
    ...actifs.flatMap(m => { const t = e.tests?.[m.id]; return t ? [t.charge3, t.max, fmtDate(t.date)] : ["", "", ""]; }),
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
      <table><thead><tr><th>Appareil</th><th>3RM</th><th>Max estimé</th><th>Date</th><th>Saisir un test</th></tr></thead><tbody>
        ${machines.map(m => { const t = e.tests?.[m.id]; return `<tr><td>${esc(m.nom)}</td>
          <td class="num">${t ? fmtChargeCourt(t.charge3, m) : "—"}</td><td class="num"><b>${t ? fmtChargeCourt(t.max, m) : "—"}</b></td><td class="small">${t ? fmtDate(t.date) : ""}</td>
          <td><div class="ligne"><input type="number" step="${m.increment}" data-test-input="${m.id}" placeholder="${uniteDe(m)}" style="width:90px"><button class="small" data-test="${m.id}">OK</button></div></td></tr>`; }).join("")}
      </tbody></table>
      <h3 style="margin-top:18px">Objectif</h3>
      <p>${o ? `${o.icone} <b>${esc(o.nom)}</b> — ${e.objectif.termine ? "cycle terminé" : `${seances.filter(s => s.cycleId === e.objectif.cycleId).length}/${o.seances} séances`} (début ${fmtDate(e.objectif.debut)})` : "Aucun objectif choisi."}</p>
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
    if (!(v > 0)) return;
    const max = maxAffiche(v, m.increment), date = new Date().toISOString();
    const ancien = e.tests?.[m.id];
    const tests = { ...(e.tests || {}), [m.id]: { charge3: v, max, date, historique: [...(ancien?.historique || []), { date, charge3: v, max }] } };
    const champs = { tests };
    if (e.objectif) { const obj = JSON.parse(JSON.stringify(e.objectif)); (obj.ajust ||= {})[m.id] = 0; (obj.statuts ||= {})[m.id] = []; champs.objectif = obj; }
    await DB.majEtudiant(e.code, champs);
    toast(`Test enregistré : max ${fmtChargeCourt(max, m)}`);
    ficheEtudiant(code);
  });
}

// ---------------- Appareils ----------------
function vueAppareils(c) {
  c.innerHTML = `
    <div class="carte">
      <div class="entete-carte"><h3>Appareils de la salle</h3><button id="btn-ajout">+ Ajouter un appareil</button></div>
      <p class="small muted"><b>Unité</b> : « lbs » pour une pile de plaques graduée en livres (l'étudiant saisit le chiffre gravé sur la plaque), « kg » pour une barre ou des disques.
      <b>Pas</b> : le plus petit saut de charge (2,5 kg pour une barre, 5 lbs pour une pile).
      <b>Min / Max</b> : la plus légère et la plus lourde charge possibles (barre à vide, première et dernière plaque).</p>
      <p class="small muted"><b>Dossier photos</b> : le nom du dossier déposé sur GitHub dans <code>img/appareils/</code>, contenant
      <code>appareil.webp</code>, <code>consigne.webp</code> et <code>pile.webp</code>. Laissez vide si l'appareil n'a pas de photos.</p>
      <div class="table-scroll"><table class="table-appareils">
        <thead><tr><th>Photo</th><th>Nom</th><th>Unité</th><th>Pas</th><th>Min</th><th>Max</th><th>Dossier photos</th><th>Consigne de sécurité</th><th>Actif</th><th></th></tr></thead>
        <tbody id="tb-app">${machines.map((m, i) => `<tr data-i="${i}">
          <td style="width:56px">${apercu(m)}</td>
          <td style="min-width:150px"><input class="m-nom" value="${esc(m.nom)}"></td>
          <td style="width:96px"><select class="m-unite"><option value="kg" ${uniteDe(m) === "kg" ? "selected" : ""}>kg</option><option value="lbs" ${uniteDe(m) === "lbs" ? "selected" : ""}>lbs</option></select></td>
          <td style="width:92px"><input class="m-inc" type="number" step="0.25" min="0.25" value="${m.increment}"></td>
          <td style="width:92px"><input class="m-min" type="number" step="0.5" min="0" value="${m.chargeMin || 0}"></td>
          <td style="width:96px"><input class="m-max" type="number" step="0.5" min="0" value="${m.chargeMax || ""}" placeholder="—"></td>
          <td style="min-width:170px"><input class="m-dossier" value="${esc(m.dossier || "")}" placeholder="ex. triceps-pressdown"></td>
          <td style="min-width:180px"><input class="m-cons" value="${esc(m.consigne || "")}"></td>
          <td style="width:56px;text-align:center"><input class="m-actif" type="checkbox" ${m.actif !== false ? "checked" : ""} style="width:auto"></td>
          <td><button class="lien danger" data-del="${i}" title="Retirer">✕</button></td></tr>`).join("")}
        </tbody></table></div>
      <button class="primaire" id="btn-save" style="margin-top:14px">Enregistrer les appareils</button>
      <p class="small muted" style="margin-top:8px">Conseil : décochez « Actif » plutôt que de supprimer un appareil déjà testé, pour garder l'historique des étudiants.
      Ne changez pas l'unité d'un appareil déjà testé : les maxima enregistrés seraient lus dans la nouvelle unité.</p>
    </div>`;
  const dossierPropre = v => v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const lire = () => [...c.querySelectorAll("#tb-app tr")].map(tr => {
    const m = machines[+tr.dataset.i];
    return { ...m, nom: tr.querySelector(".m-nom").value.trim(),
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
  c.querySelector("#btn-ajout").onclick = () => {
    machines = lire();
    machines.push({ id: "m" + Date.now().toString(36), nom: "Nouvel appareil", unite: "lbs", increment: 5, chargeMin: 5, chargeMax: 100, dossier: "", consigne: "", actif: true });
    vueAppareils(c);
  };
  c.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    if (!(await demander("Retirer cet appareil ? Les tests déjà faits dessus ne seront plus affichés.", "Retirer"))) return;
    machines = lire(); machines.splice(+b.dataset.del, 1); vueAppareils(c);
  });
  c.querySelector("#btn-save").onclick = async () => {
    machines = lire().filter(m => m.nom);
    await DB.saveMachines(machines); toast("Appareils enregistrés"); rendre();
  };
}

// Petite photo de l'appareil, ou un tiret si le dossier n'existe pas (encore) sur GitHub
function apercu(m) {
  const url = urlPhoto(m, "appareil");
  return url
    ? `<img class="apercu" src="${url}" alt="" onerror="this.outerHTML='<span class=&quot;small muted&quot; title=&quot;Photo introuvable : vérifiez le nom du dossier sur GitHub&quot;>⚠️</span>'">`
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
      la dernière séance est un re-test 3RM. Régulation automatique : 2 séances « faciles » de suite → +1 incrément ; un échec → −1 incrément.</p>
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
      <p>1RM = charge 3RM × 36 / 34 ≈ charge × 1,059, arrondi à l'incrément inférieur de l'appareil.</p>
      <div class="table-scroll"><table><thead><tr><th>3RM</th>${[20, 30, 40, 50, 60, 70, 80, 90, 100, 120].map(v => `<th class="num">${v} kg</th>`).join("")}</tr></thead>
      <tbody><tr><td><b>Max estimé</b></td>${[20, 30, 40, 50, 60, 70, 80, 90, 100, 120].map(v => `<td class="num">${fmtKg(maxAffiche(v, 2.5))}</td>`).join("")}</tr></tbody></table></div>
    </div>`;
}
