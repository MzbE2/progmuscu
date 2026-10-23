// =====================================================================
//  etudiant.js — Application étudiant (téléphone)
// =====================================================================
import * as DB from "./db.js";
import {
  OBJECTIFS, REPS_TEST, estimer1RM, maxAffiche, prescription, statutLigne,
  nouvelAjustement, RESSENTIS, fmtKg, fmtDate, arrondir, genererCode,
  uniteDe, fmtCharge, fmtChargeCourt, enKg, urlPhoto, TYPES_PHOTOS
} from "./programmes.js";

const app = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLE_CODE = "muscu-suaps-code";
const memo = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
               set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
               del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

let E = null;          // étudiant courant
let machines = [];
let seances = [];
let onglet = "seance";
let testEnCours = null; // id de la machine en cours de test
let objectifApercu = null;

if (DB.MODE_DEMO) document.getElementById("demo").classList.remove("cache");

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

// ---------------- Connexion ----------------
async function demarrer() {
  machines = (await DB.getMachines()).filter(m => m.actif !== false);
  const url = new URL(location.href);
  const depuisLien = url.searchParams.get("c") || location.hash.replace("#", "");
  const code = depuisLien || memo.get(CLE_CODE);
  if (code && await connecter(code, false)) {
    if (depuisLien) { try { history.replaceState(null, "", location.pathname); } catch (e) {} }
    return;
  }
  vueConnexion();
}

function vueConnexion(erreur = "") {
  document.getElementById("btn-deco").classList.add("cache");
  app.innerHTML = `
    <div class="carte" style="margin-top:32px">
      <h1>Bienvenue 👋</h1>
      <p class="muted">Entrez le code personnel donné par votre enseignant, ou scannez votre QR code.</p>
      <form id="f-code">
        <label for="code">Votre code</label>
        <input id="code" class="code-input" maxlength="6" autocomplete="off" autocapitalize="characters" required>
        ${erreur ? `<p class="small" style="color:var(--bad)">${esc(erreur)}</p>` : ""}
        <button class="primaire plein" style="margin-top:14px">Accéder à mon programme</button>
      </form>
    </div>`;
  document.getElementById("f-code").onsubmit = async ev => {
    ev.preventDefault();
    const ok = await connecter(document.getElementById("code").value, true);
    if (!ok) vueConnexion("Code inconnu. Vérifiez auprès de votre enseignant.");
  };
}

async function connecter(code, interactif) {
  try {
    const e = await DB.getEtudiant(code);
    if (!e) return false;
    E = e;
    memo.set(CLE_CODE, E.code);
    seances = await DB.listerSeances(E.code);
    document.getElementById("btn-deco").classList.remove("cache");
    rendre();
    return true;
  } catch (err) {
    console.error(err);
    if (interactif) toast("Connexion impossible : vérifiez le réseau.");
    return false;
  }
}

document.getElementById("btn-deco").onclick = () => {
  memo.del(CLE_CODE); E = null; vueConnexion();
};

// ---------------- Outils cycle ----------------
function seancesDuCycle() {
  if (!E.objectif) return [];
  return seances.filter(s => s.cycleId === E.objectif.cycleId);
}
function numSeanceCourante() { return seancesDuCycle().length + 1; }

// ---------------- Rendu principal ----------------
function rendre() {
  const o = E.objectif && !E.objectif.termine ? OBJECTIFS[E.objectif.type] : null;
  const nbTests = machines.filter(m => E.tests?.[m.id]).length;
  app.innerHTML = `
    <div class="ligne espace" style="margin-top:8px">
      <div>
        <h1>Salut ${esc(E.prenom)} !</h1>
        <p class="muted small">${esc(E.groupe || "")}</p>
      </div>
      ${o ? `<span class="pastille accent">${o.icone} ${esc(o.nom)}</span>` : ""}
    </div>
    <nav class="onglets">
      ${[["seance", "Séance"], ["maxima", `Maxima ${nbTests}/${machines.length}`], ["objectif", "Objectif"], ["historique", "Historique"]]
        .map(([id, l]) => `<button data-onglet="${id}" class="${onglet === id ? "actif" : ""}">${l}</button>`).join("")}
    </nav>
    <section id="contenu"></section>`;
  app.querySelectorAll("[data-onglet]").forEach(b => b.onclick = () => { onglet = b.dataset.onglet; testEnCours = null; rendre(); });
  const c = document.getElementById("contenu");
  ({ seance: vueSeance, maxima: vueMaxima, objectif: vueObjectif, historique: vueHistorique })[onglet](c);
}

// ---------------- Onglet : Mes maxima ----------------
function vueMaxima(c) {
  c.innerHTML = `
    <div class="carte">
      <h3>Le protocole du test</h3>
      <p class="small">Après un échauffement, augmentez la charge progressivement (3 à 5 min de récupération entre les essais).
      Une charge est <b>validée</b> si vous réussissez <b>3 répétitions</b> propres et que la <b>4ème est un échec</b>.
      Si la 4ème passe, la charge est trop légère : augmentez et recommencez.</p>
      <p class="small muted">Le max sur 1 répétition est estimé par la formule de Brzycki : 1RM = charge × 36 / (37 − 3), arrondi à l'incrément inférieur de l'appareil.
      Sur les appareils à plaques en livres, saisissez le chiffre en <b>lbs</b> gravé sur la plaque où vous mettez la goupille.</p>
    </div>
    ${machines.map(m => carteMax(m)).join("")}`;
  c.querySelectorAll("[data-tester]").forEach(b => b.onclick = () => { testEnCours = b.dataset.tester; vueMaxima(c); });
  c.querySelectorAll("[data-annuler]").forEach(b => b.onclick = () => { testEnCours = null; vueMaxima(c); });
  brancherFiches(c);
  const f = c.querySelector("#f-test");
  if (f) {
    const inp = f.querySelector("input"), out = f.querySelector("#estim");
    const m = machines.find(x => x.id === testEnCours);
    const maj = () => {
      const v = parseFloat(String(inp.value).replace(",", "."));
      out.innerHTML = v > 0 ? `Max estimé : <b>${fmtCharge(maxAffiche(v, m.increment), m)}</b> <span class="muted small">(${fmtChargeCourt(Math.round(estimer1RM(v) * 10) / 10, m)} non arrondi)</span>` : "&nbsp;";
    };
    inp.oninput = maj; inp.focus();
    f.onsubmit = async ev => {
      ev.preventDefault();
      const charge = parseFloat(String(inp.value).replace(",", "."));
      if (!(charge > 0)) return;
      await enregistrerTest(m, charge);
      testEnCours = null; rendre();
      toast("Test enregistré 💪");
    };
  }
}

function carteMax(m) {
  const t = E.tests?.[m.id];
  if (testEnCours === m.id) {
    return `
    <div class="carte">
      <div class="entete-appareil">${vignette(m)}<h3>Test 3RM — ${esc(m.nom)}</h3></div>
      ${m.consigne ? `<div class="consigne">⚠️ ${esc(m.consigne)}</div>` : ""}
      <form id="f-test">
        <label>Charge validée pour 3 répétitions (${uniteDe(m)})</label>
        <input type="number" inputmode="decimal" step="${m.increment}" min="${m.chargeMin || 0}" required>
        <p id="estim" style="margin:10px 0">&nbsp;</p>
        <div class="ligne">
          <button class="primaire">Enregistrer</button>
          <button type="button" data-annuler>Annuler</button>
        </div>
      </form>
    </div>`;
  }
  return `
    <div class="carte">
      <div class="entete-carte">
        <div class="entete-appareil">${vignette(m)}<h3>${esc(m.nom)}</h3></div>
        <button class="${t ? "" : "primaire"}" data-tester="${m.id}">${t ? "Refaire le test" : "Faire le test"}</button>
      </div>
      ${t ? `
        <div class="grille g2" style="margin-top:10px">
          <div class="stat"><div class="val num">${fmtChargeCourt(t.charge3, m)}</div><div class="lbl">Charge 3 répétitions${enKg(t.charge3, m) ? ` · ${enKg(t.charge3, m)}` : ""}</div></div>
          <div class="stat accent"><div class="val num">${fmtChargeCourt(t.max, m)}</div><div class="lbl">Max estimé (1RM)${enKg(t.max, m) ? ` · ${enKg(t.max, m)}` : ""}</div></div>
        </div>
        <p class="small muted" style="margin-top:8px">Testé le ${fmtDate(t.date)}${t.historique?.length > 1 ? ` · précédent : ${fmtCharge(t.historique[t.historique.length - 2].max, m)}` : ""}</p>`
      : `<p class="muted small">Pas encore testé.</p>`}
    </div>`;
}

async function enregistrerTest(m, charge3) {
  const max = maxAffiche(charge3, m.increment);
  const ancien = E.tests?.[m.id];
  const historique = [...(ancien?.historique || []), { date: new Date().toISOString(), charge3, max }];
  const tests = { ...(E.tests || {}), [m.id]: { charge3, max, date: new Date().toISOString(), historique } };
  const champs = { tests };
  // Nouveau max → on remet à zéro la régulation de cet appareil
  if (E.objectif) {
    const obj = JSON.parse(JSON.stringify(E.objectif));
    if (obj.ajust) obj.ajust[m.id] = 0;
    if (obj.statuts) obj.statuts[m.id] = [];
    champs.objectif = obj;
  }
  await DB.majEtudiant(E.code, champs);
  Object.assign(E, champs);
}

// ---------------- Onglet : Objectif ----------------
function vueObjectif(c) {
  const actif = E.objectif && !E.objectif.termine;
  if (actif && !objectifApercu) {
    const o = OBJECTIFS[E.objectif.type];
    const fait = seancesDuCycle().length;
    c.innerHTML = `
      <div class="carte">
        <div class="entete-carte"><h2>${o.icone} ${esc(o.nom)}</h2><span class="pastille">depuis le ${fmtDate(E.objectif.debut)}</span></div>
        <p>${esc(o.resume)}</p>
        <div class="ligne espace small" style="margin:12px 0 6px"><span>Progression du cycle</span><b class="num">${fait} / ${o.seances} séances</b></div>
        <div class="progression"><div style="width:${Math.min(100, fait / o.seances * 100)}%"></div></div>
        <p class="small muted" style="margin-top:12px">${esc(o.effets)}</p>
      </div>
      ${detailObjectif(E.objectif.type)}
      <button class="plein" id="changer">Changer d'objectif</button>`;
    c.querySelector("#changer").onclick = () => { objectifApercu = E.objectif.type; vueObjectif(c); };
    return;
  }
  c.innerHTML = `
    <div class="carte">
      <h2>Choisissez votre objectif</h2>
      <p class="muted small">Un objectif se travaille sur un cycle de plusieurs séances pour obtenir des effets. Vous ferez un nouveau test à la fin.</p>
      <div class="objectifs" style="margin-top:12px">
        ${Object.entries(OBJECTIFS).map(([id, o]) => `
          <button class="objectif ${objectifApercu === id ? "choisi" : ""}" data-obj="${id}">
            <div class="ic">${o.icone}</div><strong>${esc(o.nom)}</strong><span>${esc(o.resume)}</span>
          </button>`).join("")}
      </div>
    </div>
    ${objectifApercu ? detailObjectif(objectifApercu) + `
      <button class="primaire plein" id="valider-obj">Démarrer ce cycle (${OBJECTIFS[objectifApercu].seances} séances)</button>
      ${actif ? `<p class="small muted" style="text-align:center">Votre cycle actuel sera arrêté. Vos maxima sont conservés.</p>
                 <button class="lien plein" id="annuler-obj">Annuler</button>` : ""}` : ""}`;
  c.querySelectorAll("[data-obj]").forEach(b => b.onclick = () => { objectifApercu = b.dataset.obj; vueObjectif(c); });
  const v = c.querySelector("#valider-obj");
  if (v) v.onclick = async () => {
    const objectif = { type: objectifApercu, cycleId: genererCode(8), debut: new Date().toISOString(), ajust: {}, statuts: {}, termine: false };
    await DB.majEtudiant(E.code, { objectif });
    E.objectif = objectif; objectifApercu = null;
    onglet = "seance"; rendre(); toast("C'est parti !");
  };
  const a = c.querySelector("#annuler-obj");
  if (a) a.onclick = () => { objectifApercu = null; vueObjectif(c); };
}

function detailObjectif(id) {
  const o = OBJECTIFS[id];
  return `
    <div class="carte">
      <h3>${o.icone} ${esc(o.nom)} — le programme</h3>
      <div class="grille g3" style="margin:10px 0">
        <div class="stat"><div class="val num">${o.series[0]}–${o.series[1]}</div><div class="lbl">Séries</div></div>
        <div class="stat"><div class="val num">${o.reps[0]}–${o.reps[1]}</div><div class="lbl">Répétitions</div></div>
        <div class="stat"><div class="val num">${o.pct[0]}–${o.pct[1]}%</div><div class="lbl">du max</div></div>
        <div class="stat"><div class="val" style="font-size:1.3rem">${esc(o.recup)}</div><div class="lbl">Récupération</div></div>
        <div class="stat"><div class="val num">${o.seances}</div><div class="lbl">Séances / cycle</div></div>
        <div class="stat"><div class="val" style="font-size:1.3rem">${o.format === "circuit" ? "Circuit" : "Classique"}</div><div class="lbl">Format</div></div>
      </div>
      <p class="small">La charge augmente et les répétitions diminuent progressivement au fil du cycle. La dernière séance est une séance bilan avec re-test.</p>
      <div class="consigne">${esc(o.consigne)}</div>
    </div>`;
}

// ---------------- Onglet : Ma séance ----------------
function vueSeance(c) {
  if (!E.objectif || E.objectif.termine) {
    c.innerHTML = `<div class="carte vide">
      <h3>${E.objectif?.termine ? "Cycle terminé 🎉" : "Pas encore d'objectif"}</h3>
      <p>${E.objectif?.termine ? "Bravo ! Choisissez un nouvel objectif pour continuer." : "Commencez par tester vos maxima, puis choisissez un objectif."}</p>
      <div class="ligne" style="justify-content:center;margin-top:12px">
        <button data-aller="maxima">Mes maxima</button><button class="primaire" data-aller="objectif">Choisir un objectif</button>
      </div></div>`;
    c.querySelectorAll("[data-aller]").forEach(b => b.onclick = () => { onglet = b.dataset.aller; rendre(); });
    return;
  }
  const o = OBJECTIFS[E.objectif.type];
  const n = numSeanceCourante();
  const bilan = n >= o.seances;

  if (bilan) {
    c.innerHTML = `
      <div class="carte">
        <h2>Séance ${n} / ${o.seances} — Bilan 🏁</h2>
        <p>Dernière séance du cycle : refaites le test 3RM sur chaque appareil pour mesurer vos progrès.</p>
      </div>
      ${machines.map(m => {
        const t = E.tests?.[m.id];
        const testeAuj = t && new Date(t.date).toDateString() === new Date().toDateString();
        const prec = t?.historique?.length > 1 ? t.historique[t.historique.length - 2].max : null;
        return `<div class="carte"><div class="entete-carte"><div class="entete-appareil">${vignette(m)}<h3>${esc(m.nom)}</h3></div>
          ${testeAuj ? `<span class="pastille ok">Testé ✓</span>` : `<button class="primaire" data-retest="${m.id}">Refaire le test</button>`}</div>
          ${testeAuj && prec != null ? `<p>Max : <b>${fmtChargeCourt(prec, m)}</b> → <b>${fmtChargeCourt(t.max, m)}</b> <span class="pastille ${t.max >= prec ? "ok" : "warn"}">${t.max >= prec ? "+" : ""}${fmtChargeCourt(t.max - prec, m)}</span></p>` : ""}
        </div>`;
      }).join("")}
      <button class="primaire plein" id="cloturer">Clôturer le cycle</button>`;
    c.querySelectorAll("[data-retest]").forEach(b => b.onclick = () => { onglet = "maxima"; testEnCours = b.dataset.retest; rendre(); });
    brancherFiches(c);
    c.querySelector("#cloturer").onclick = async () => {
      await DB.ajouterSeance(E.code, { cycleId: E.objectif.cycleId, objectif: E.objectif.type, num: n, bilan: true, lignes: [] });
      const objectif = { ...E.objectif, termine: true, fin: new Date().toISOString() };
      await DB.majEtudiant(E.code, { objectif });
      E.objectif = objectif; seances = await DB.listerSeances(E.code);
      onglet = "objectif"; rendre(); toast("Cycle clôturé, bravo !");
    };
    return;
  }

  const lignes = machines.map(m => {
    const t = E.tests?.[m.id];
    if (!t) return { m, p: null };
    const p = prescription(E.objectif.type, n, t.max, m, E.objectif.ajust?.[m.id] || 0);
    return { m, p };
  });
  const avecPresc = lignes.filter(l => l.p);

  c.innerHTML = `
    <div class="carte">
      <div class="entete-carte"><h2>Séance ${n} / ${o.seances}</h2><span class="pastille">${o.icone} ${esc(o.nom)}</span></div>
      <div class="progression" style="margin:10px 0"><div style="width:${(n - 1) / o.seances * 100}%"></div></div>
      ${o.format === "circuit" ? `<div class="consigne"><b>Circuit :</b> enchaînez une série sur chaque appareil, puis récupérez ${esc(o.recup)} à la fin du tour. Répétez le nombre de tours indiqué.</div>` : ""}
      <p class="small muted">Commencez par 5 à 10 min d'échauffement général (vélo, rameur, mobilité).</p>
    </div>
    ${lignes.map(({ m, p }) => p ? cartePresc(m, p, o) : `
      <div class="carte"><div class="entete-carte"><div class="entete-appareil">${vignette(m)}<h3>${esc(m.nom)}</h3></div><button data-retest="${m.id}">Faire le test</button></div>
      <p class="muted small">Faites d'abord le test 3RM pour obtenir votre programme sur cet appareil.</p></div>`).join("")}
    ${avecPresc.length ? `
      <div class="carte">
        <label for="comm">Commentaire (facultatif)</label>
        <textarea id="comm" rows="2" placeholder="Douleur, fatigue, remarque…"></textarea>
        <button class="primaire plein" id="valider-seance" style="margin-top:12px">Valider ma séance</button>
      </div>` : ""}`;

  c.querySelectorAll("[data-retest]").forEach(b => b.onclick = () => { onglet = "maxima"; testEnCours = b.dataset.retest; rendre(); });
  c.querySelectorAll("[data-recup]").forEach(b => b.onclick = () => lancerMinuteur(+b.dataset.recup));
  brancherFiches(c);
  c.querySelectorAll(".stepper").forEach(st => {
    const span = st.querySelector("span"), max = +st.dataset.max;
    st.querySelectorAll("button").forEach(b => b.onclick = () => {
      span.textContent = Math.max(0, Math.min(max, +span.textContent + +b.dataset.d));
    });
  });
  const v = c.querySelector("#valider-seance");
  if (v) v.onclick = () => validerSeance(c, avecPresc, n);
}

function cartePresc(m, p, o) {
  const tours = o.format === "circuit";
  return `
    <div class="carte" data-machine="${m.id}">
      <div class="entete-carte"><div class="entete-appareil">${vignette(m)}<h3>${esc(m.nom)}</h3></div><span class="pastille">${p.pct} % du max</span></div>
      <div class="presc">
        <div class="gros num">${p.series} <small>${tours ? "tours" : "séries"}</small></div>
        <div class="gros num">× ${p.reps} <small>rép.</small></div>
        <div class="gros num" style="color:var(--accent)">${String(p.charge).replace(".", ",")} <small>${uniteDe(m)}</small></div>
      </div>
      ${uniteDe(m) === "lbs" ? `<p class="small muted" style="margin:-4px 0 6px">Goupille sur la plaque <b>${String(p.charge).replace(".", ",")} lbs</b> (${enKg(p.charge, m)})</p>` : ""}
      <p class="echauf">Échauffement : ${p.echauffement.map(e => `<b>${e.reps}</b> × ${fmtChargeCourt(e.charge, m)}`).join(" · ")}</p>
      <div class="ligne espace" style="margin:6px 0">
        <span class="small">Récupération : <b>${esc(p.recup)}</b></span>
        <button class="small" data-recup="${p.recupSec}">⏱ Lancer la récup</button>
      </div>
      ${m.consigne ? `<div class="consigne">⚠️ ${esc(m.consigne)}</div>` : ""}
      <hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
      <p class="small"><b>Mon carnet</b></p>
      <div class="grille g2">
        <div><label>Charge utilisée (${uniteDe(m)})</label><input type="number" inputmode="decimal" step="${m.increment}" class="i-charge" value="${p.charge}"></div>
        <div><label>${tours ? "Tours" : "Séries"} réussis</label>
          <div class="stepper" data-max="${p.series}"><button type="button" data-d="-1">−</button><span class="num">${p.series}</span><button type="button" data-d="1">+</button></div>
        </div>
      </div>
      <label>Ressenti</label>
      <select class="i-ressenti">${RESSENTIS.map(([v, l]) => `<option value="${v}" ${v === 7 ? "selected" : ""}>${l}</option>`).join("")}</select>
      <input type="hidden" class="i-prevu" value="${p.series}">
      <input type="hidden" class="i-reps" value="${p.reps}">
      <input type="hidden" class="i-chargeprevue" value="${p.charge}">
    </div>`;
}

async function validerSeance(c, avecPresc, n) {
  const btn = c.querySelector("#valider-seance");
  btn.disabled = true;
  const obj = JSON.parse(JSON.stringify(E.objectif));
  obj.ajust = obj.ajust || {}; obj.statuts = obj.statuts || {};
  const lignes = [];
  const messages = [];
  for (const { m } of avecPresc) {
    const card = c.querySelector(`[data-machine="${m.id}"]`);
    const ligne = {
      machineId: m.id, machine: m.nom, unite: uniteDe(m),
      chargePrevue: +card.querySelector(".i-chargeprevue").value,
      charge: parseFloat(String(card.querySelector(".i-charge").value).replace(",", ".")) || 0,
      repsPrevues: +card.querySelector(".i-reps").value,
      seriesPrevues: +card.querySelector(".i-prevu").value,
      seriesReussies: +card.querySelector(".stepper span").textContent,
      ressenti: +card.querySelector(".i-ressenti").value
    };
    ligne.statut = statutLigne(ligne, ligne.seriesPrevues);
    const hist = [...(obj.statuts[m.id] || []), ligne.statut];
    const avant = obj.ajust[m.id] || 0;
    const apres = nouvelAjustement(avant, hist, m.increment);
    obj.ajust[m.id] = apres;
    // après un changement de charge, on repart à zéro dans le comptage
    obj.statuts[m.id] = apres !== avant ? [] : hist.slice(-3);
    if (apres > avant) messages.push(`${m.nom} : +${fmtChargeCourt(apres - avant, m)} la prochaine fois 🚀`);
    if (apres < avant) messages.push(`${m.nom} : charge allégée de ${fmtChargeCourt(avant - apres, m)}`);
    lignes.push(ligne);
  }
  try {
    await DB.ajouterSeance(E.code, {
      cycleId: obj.cycleId, objectif: obj.type, num: n, lignes,
      commentaire: c.querySelector("#comm")?.value || ""
    });
    obj.nbFaites = n; obj.derniere = new Date().toISOString();
    await DB.majEtudiant(E.code, { objectif: obj });
    E.objectif = obj;
    seances = await DB.listerSeances(E.code);
    window.scrollTo(0, 0);
    rendre();
    toast(messages[0] || "Séance enregistrée ✅");
  } catch (err) {
    console.error(err); btn.disabled = false;
    toast("Erreur d'enregistrement, réessayez.");
  }
}

// ---------------- Onglet : Historique ----------------
function vueHistorique(c) {
  const liste = [...seances].reverse();
  const nomStatut = { facile: ["ok", "Facile"], ok: ["", "Réussi"], echec: ["bad", "Difficile"] };
  c.innerHTML = liste.length ? liste.map(s => `
    <div class="carte">
      <div class="entete-carte">
        <h3>${s.bilan ? "Séance bilan" : `Séance ${s.num}`} · ${OBJECTIFS[s.objectif]?.icone || ""} ${esc(OBJECTIFS[s.objectif]?.nom || "")}</h3>
        <span class="muted small">${fmtDate(s.date)}</span>
      </div>
      ${s.lignes?.length ? `<div class="table-scroll"><table><thead><tr><th>Appareil</th><th>Charge</th><th>Séries</th><th></th></tr></thead><tbody>
        ${s.lignes.map(l => `<tr><td>${esc(l.machine)}</td><td class="num">${fmtChargeCourt(l.charge, { unite: l.unite })}</td>
          <td class="num">${l.seriesReussies}/${l.seriesPrevues} × ${l.repsPrevues}</td>
          <td><span class="pastille ${nomStatut[l.statut]?.[0] || ""}">${nomStatut[l.statut]?.[1] || ""}</span></td></tr>`).join("")}
      </tbody></table></div>` : ""}
      ${s.commentaire ? `<p class="small muted" style="margin-top:8px">💬 ${esc(s.commentaire)}</p>` : ""}
    </div>`).join("") : `<div class="carte vide">Aucune séance enregistrée pour l'instant.</div>`;
}

// ---------------- Photos et fiche appareil ----------------
// Vignette cliquable (photo de l'appareil). Rien n'est affiché si l'appareil n'a pas de dossier photos.
function vignette(m) {
  const url = urlPhoto(m, "appareil");
  if (!url) return "";
  return `<button class="vignette" data-fiche="${esc(m.id)}" aria-label="Voir la fiche ${esc(m.nom)}">
    <img src="${url}" alt="" loading="lazy" onerror="this.parentElement.remove()"></button>`;
}

function brancherFiches(c) {
  c.querySelectorAll("[data-fiche]").forEach(b => b.onclick = () => ouvrirFiche(b.dataset.fiche));
}

function ouvrirFiche(id) {
  const m = machines.find(x => x.id === id);
  if (!m) return;
  const d = document.createElement("div");
  d.className = "modal-fond";
  d.innerHTML = `
    <div class="modal fiche-appareil">
      <div class="entete-carte"><h2>${esc(m.nom)}</h2><button data-fermer aria-label="Fermer">✕</button></div>
      ${m.consigne ? `<div class="consigne">⚠️ ${esc(m.consigne)}</div>` : ""}
      ${uniteDe(m) === "lbs" ? `<p class="small muted">Charges en livres : lisez le chiffre en <b>lbs</b> sur la plaque${m.chargeMin && m.chargeMax ? ` (de ${fmtChargeCourt(m.chargeMin, m)} à ${fmtChargeCourt(m.chargeMax, m)}, par ${fmtChargeCourt(m.increment, m)})` : ""}.</p>` : ""}
      <div class="fiche-photos">
        ${TYPES_PHOTOS.map(([type, titre]) => `
          <figure><img src="${urlPhoto(m, type)}" alt="${esc(titre)} — ${esc(m.nom)}" loading="lazy" onerror="this.parentElement.remove()">
          <figcaption>${esc(titre)}</figcaption></figure>`).join("")}
      </div>
    </div>`;
  const fermer = () => d.remove();
  d.querySelector("[data-fermer]").onclick = fermer;
  d.onclick = ev => { if (ev.target === d) fermer(); };
  document.body.appendChild(d);
}

// ---------------- Minuteur de récupération ----------------
let minuterie = null;
function lancerMinuteur(sec) {
  clearInterval(minuterie);
  const barre = document.getElementById("barre-minuteur"), aff = document.getElementById("minuteur");
  barre.classList.remove("cache"); aff.classList.remove("fini");
  let reste = sec;
  const maj = () => { aff.textContent = `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`; };
  maj();
  minuterie = setInterval(() => {
    reste--; maj();
    if (reste <= 0) {
      clearInterval(minuterie);
      aff.textContent = "C'est reparti !"; aff.classList.add("fini");
      try { navigator.vibrate?.([300, 150, 300]); } catch (e) {}
      bip();
      setTimeout(() => barre.classList.add("cache"), 5000);
    }
  }, 1000);
}
document.getElementById("stop-minuteur").onclick = () => { clearInterval(minuterie); document.getElementById("barre-minuteur").classList.add("cache"); };
function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); o.frequency.value = 880; o.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

demarrer();
