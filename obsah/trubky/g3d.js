/* ============================================================
   trubky/g3d.js – napojení generátorů trubek (tubeRed, tubeRedFlat, tubeSplit) na gen3d/aplikace.js.
   Stránky mají vlastní scénu (three r128) a stav v políčkách s id. Stav projektu = obraz políček
   `.tvar-pole input[id], .tvar-pole select[id]` (hodnota; u zaškrtávátek a přepínačů checked) + název.
   „Moje tvary“ zůstávají vlastním Tvary.pripoj stránky (kontejner #sbirkaTvaru, klíč <klic>_tvary),
   aplikace.js je proto nepřipojuje (nenajde #tvary).

   const app = TrubkyG3D.pripoj({
     typ, nazev, klic, soubor,           // klíče <klic>_projekt a <klic>_zobrazeni
     vychozi?: {id: hodnota},             // výchozí hodnoty (chybějící z HTML: defaultValue / defaultChecked)
     poNastaveni(),                       // po zápisu stavu do políček (viditelnost, karty…)
     prepocitej(),                        // přegeneruje díl (volá pak TrubkyG3D.poGeneraci())
     scena: () => ({scene, renderer, camera, mesh, hrany}),
     sitTisku: () => ({V, I, dily?: [{nazev, I}]}) | null,   // síť v tiskové poloze (z = 0 podložka), bez hlášek
     kontroly: () => [{uroven, text}], hustota: () => g/cm³,
     pohled(j), exportStl(), data3mf: async () => Uint8Array,
     hrany?: {ziskej: () => bool, nastav: h => …},          // přepínač ✏️ Obrysové hrany
     previsy?: {ziskej, nastav}                               // vlastní přepínač převisů stránky (jinak jen v tiskové poloze)
   })
   TrubkyG3D.poGeneraci()  – stránka volá na konci generování (i neplatného zadání)
   TrubkyG3D.zaznamenej()  – stránka změnila políčka sama (uložený tvar, nový tvar) → krok zpět
   V node: TrubkyG3D.normalizuj(q, vychozi) (bez DOM) pro testy.
   ============================================================ */
/* global THREE, G3D, TrubkyGui */
(function () {
  'use strict';

  /** Projekt: klíče a pořadí z výchozího stavu, hodnoty jako text (políčka) nebo bool (zaškrtávátka). */
  function normalizuj(q, vychozi) {
    const v = q && typeof q === 'object' && !Array.isArray(q) ? q : {};
    const p = { nazev: typeof v.nazev === 'string' ? v.nazev.slice(0, 120) : '' };
    for (const k of Object.keys(vychozi)) {
      if (k === 'nazev') continue;
      const d = vychozi[k], h = v[k];
      if (typeof d === 'boolean') p[k] = h === undefined || h === null ? d : (h === 'false' ? false : !!h);
      else p[k] = h === undefined || h === null || (typeof h === 'number' && !isFinite(h)) ? d : String(h);
    }
    return { p, hlaseni: [] };
  }

  if (typeof window === 'undefined') { module.exports = { normalizuj }; return; }

  const $ = id => document.getElementById(id);
  const POLICKA = '.tvar-pole input[id], .tvar-pole select[id]';
  const zaskrt = el => el.type === 'checkbox' || el.type === 'radio';
  const policka = () => [...document.querySelectorAll(POLICKA)];
  function stavPolicek() {
    const o = {};
    for (const el of policka()) o[el.id] = zaskrt(el) ? el.checked : el.value;
    return o;
  }
  function vychoziZHtml() {
    const o = {};
    for (const el of policka()) {
      if (zaskrt(el)) o[el.id] = el.defaultChecked;
      else if (el.tagName === 'SELECT') { const opt = [...el.options].find(x => x.defaultSelected) || el.options[0]; o[el.id] = opt ? opt.value : ''; }
      else o[el.id] = el.defaultValue;
    }
    return o;
  }

  let cfg = null, app = null, VYCH = null, zapisuji = false;
  const zobr = { tisk: false, previsy: false, rez: false, pravitka: false };
  let tiskSkupina = null, tiskMesh = null, pravitkaObj = null, rezMesh = null, sitT = null, casovac = null;
  const tiskUhel = { a: -0.6, t: 0.55, rx0: 0, ry0: 0 };
  const rovina = typeof THREE !== 'undefined' ? new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0) : null;

  function pripoj(c) {
    cfg = c;
    VYCH = Object.assign({ nazev: '' }, vychoziZHtml(), cfg.vychozi || {});
    for (const k of Object.keys(VYCH)) if (k !== 'nazev' && !$(k)) delete VYCH[k];   // jen políčka, která stránka má
    const norm = q => normalizuj(q, VYCH);
    const KLIC = cfg.klic + '_projekt';
    // starší stav stránky (jen v políčkách, načtený vlastním loadSettings) → první projekt
    try { if (!localStorage.getItem(KLIC)) localStorage.setItem(KLIC, JSON.stringify(norm(stavPolicek()).p)); } catch (e) { /* bez úložiště */ }

    app = G3D.aplikace({
      typ: cfg.typ, nazev: cfg.nazev, klic: cfg.klic, soubor: cfg.soubor,
      normalizuj: norm, vychozi: () => norm(VYCH).p,
      poNaplneni: q => nastav(q),
      png: () => { const s = cfg.scena(); synchronizuj(); s.renderer.render(s.scene, s.camera); return s.renderer.domElement.toDataURL('image/png'); },
      pohled: j => pohled(j),
      exportStl: () => cfg.exportStl(),
      doModelare: async () => { const d = await cfg.data3mf(); return d ? { data: d, pripona: '.3mf' } : null; },
      zkratky: { h: 'tHrany', m: 'tTisk', p: 'tPrevisy', r: 'tRez', l: 'tPravitka' },
    });
    // změna políčka tvaru (bublá až sem, po vlastních posluchačích stránky) = krok zpět
    document.addEventListener('change', e => {
      if (!zapisuji && e.target.matches && e.target.matches(POLICKA)) zaznamenej();
      if (cfg.hrany && e.target.name === 'viewType' && $('tHrany')) $('tHrany').setAttribute('aria-pressed', String(cfg.hrany.ziskej()));
    });

    // přepínače Zobrazení (počáteční stav podle políček stránky)
    if (cfg.hrany && $('tHrany')) $('tHrany').setAttribute('aria-pressed', String(cfg.hrany.ziskej()));
    if (cfg.previsy && $('tPrevisy')) $('tPrevisy').setAttribute('aria-pressed', String(cfg.previsy.ziskej()));
    if (cfg.hrany) app.prepinac('tHrany', h => { if (h !== cfg.hrany.ziskej()) cfg.hrany.nastav(h); });
    app.prepinac('tTisk', h => {
      zobr.tisk = h;
      if (h) { const m = cfg.scena().mesh; tiskUhel.a = -0.6; tiskUhel.t = 0.55; if (m) { tiskUhel.rx0 = m.rotation.x; tiskUhel.ry0 = m.rotation.y; } }
      obnovTisk(); legenda();
    });
    app.prepinac('tPrevisy', h => {
      zobr.previsy = h;
      if (cfg.previsy && h !== cfg.previsy.ziskej()) cfg.previsy.nastav(h);
      obnovTisk(); legenda();
    }, !cfg.previsy);
    app.prepinac('tRez', h => { zobr.rez = h; legenda(); });
    app.prepinac('tPravitka', h => { zobr.pravitka = h; obnovPravitka(); }, true);

    (function smycka() { synchronizuj(); requestAnimationFrame(smycka); })();
    app.start();
    return app;
  }

  /** Projekt → políčka (bez událostí change), pak stránka dopočítá viditelnost a přegeneruje. */
  function nastav(q) {
    zapisuji = true;
    try {
      for (const [id, h] of Object.entries(q)) {
        if (id === 'nazev') continue;
        const el = $(id); if (!el || !el.matches(POLICKA)) continue;
        if (zaskrt(el)) el.checked = !!h; else el.value = h;
      }
      if (cfg.poNastaveni) cfg.poNastaveni();
      cfg.prepocitej();
    } finally { zapisuji = false; }
  }
  function zaznamenej() {
    if (!app) return;
    const s = stavPolicek();
    app.zmen(p => { for (const k of Object.keys(p)) if (k !== 'nazev') delete p[k]; Object.assign(p, s); });
  }

  /* ---------- po vygenerování: kontroly, tisková síť, výsledky ---------- */
  function poGeneraci() {
    if (!app) return;
    const s = cfg.scena();
    if (s.mesh && cfg.hrany) { const b = $('tHrany'); if (b) b.setAttribute('aria-pressed', String(cfg.hrany.ziskej())); }
    if (cfg.previsy) { const b = $('tPrevisy'); if (b) { zobr.previsy = cfg.previsy.ziskej(); b.setAttribute('aria-pressed', String(zobr.previsy)); legenda(); } }
    // tisková síť a výsledky chvíli po poslední změně (psaní, tažení posuvníku)
    clearTimeout(casovac);
    casovac = setTimeout(() => {
      try { sitT = cfg.sitTisku(); } catch (e) { sitT = null; }
      obnovTisk(); vysledky(); kontroly();
    }, 120);
    kontroly();
    obnovPravitka();
  }
  function kontroly() {
    const H = (cfg.kontroly ? cfg.kontroly() : []).slice();
    if (sitT) {
      const r = G3D.rozborTisku({ poz: sitT.V, idx: sitT.I }, 45);
      if (r.previs > 1) H.push({ uroven: 'info', text: `V tiskové poloze ${fmt(r.previs, 0)} mm² převisů nad 45° (podpory) — viz 🖨 Tisková poloha a 🟥 Převisy.` });
    }
    app.hlaseni(H, { boxy: [] });
  }
  const fmt = (x, d = 1) => G3D.fmt(x, d);
  function vysledky() {
    const el = $('vTisk'); if (!el) return;
    if (!sitT) { el.innerHTML = G3D.dlazdice('Odhad tisku', '–', 'neplatné zadání'); return; }
    const b = G3D.obal(sitT.V), V = objem(sitT.V, sitT.I);
    const hust = cfg.hustota ? cfg.hustota() : 1.24, o = G3D.odhadTisku(V, hust, { dilu: (sitT.dily || [1]).length });
    const r = G3D.rozborTisku({ poz: sitT.V, idx: sitT.I }, 45);
    let h = G3D.dlazdice('Na podložce', `${fmt(b[3] - b[0])} × ${fmt(b[4] - b[1])} × ${fmt(b[5] - b[2])} mm`, 'š × h × v v tiskové poloze');
    h += G3D.dlazdice('Objem', `${fmt(V / 1000, 1)} cm³`, 'plný materiál stěn');
    h += G3D.dlazdice('Hmotnost', `${fmt(o.g, o.g < 10 ? 1 : 0)} g`, `hustota ${fmt(hust, 2)} g/cm³, 100 % výplň`);
    h += G3D.dlazdice('Filament', `${fmt(o.metru, 1)} m`, 'průměr 1,75 mm');
    h += G3D.dlazdice('Doba tisku', `≈ ${o.minut < 60 ? o.minut + ' min' : fmt(o.minut / 60, 1) + ' h'}`, 'hrubý odhad, vrstva 0,2 mm');
    h += G3D.dlazdice('Převisy nad 45°', `${fmt(r.previs, 0)} mm²`, r.previs > 1 ? 'potřebují podpory' : 'tiskne se bez podpor', r.previs > 1 ? 'mez-t' : 'ok-t');
    el.innerHTML = h;
    const k = $('vKusovnik');
    if (k) {
      const dily = sitT.dily || [];
      k.hidden = dily.length < 2;
      k.innerHTML = dily.length < 2 ? '' : '<tr><th>Díl</th><th class="c">Rozměr (mm)</th><th class="c">Objem</th></tr>' + dily.map(d => {
        const P = podsit(sitT.V, d.I), bb = G3D.obal(P.V);
        return `<tr><td>${G3D.esc(d.nazev)}</td><td class="c">${fmt(bb[3] - bb[0])} × ${fmt(bb[4] - bb[1])} × ${fmt(bb[5] - bb[2])}</td><td class="c">${fmt(objem(P.V, P.I) / 1000, 1)} cm³</td></tr>`;
      }).join('');
    }
  }
  function objem(V, I) {
    let s = 0;
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      s += V[a] * (V[b + 1] * V[c + 2] - V[b + 2] * V[c + 1]) - V[a + 1] * (V[b] * V[c + 2] - V[b + 2] * V[c]) + V[a + 2] * (V[b] * V[c + 1] - V[b + 1] * V[c]);
    }
    return Math.abs(s / 6);
  }
  /** Vrcholy jen použité indexy I (pro díl zvlášť). */
  function podsit(V, I) {
    const map = new Map(), P = [], J = [];
    for (const i of I) { if (!map.has(i)) { map.set(i, P.length / 3); P.push(V[3 * i], V[3 * i + 1], V[3 * i + 2]); } J.push(map.get(i)); }
    return { V: P, I: J };
  }

  /* ---------- tisková poloha, převisy, řez, pravítka v cizí scéně ---------- */
  function geometrie(V, I, barvy) {
    // nesvařené trojúhelníky (barva na trojúhelník), normály vyhlazené jen do lomu 30°
    const nV = V.length / 3, NV = new Float32Array(V.length), nT = I.length / 3, FN = new Float32Array(3 * nT);
    for (let t = 0; t < nT; t++) {
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], vx = V[c] - V[a], vy = V[c + 1] - V[a + 1], vz = V[c + 2] - V[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) { NV[v] += nx; NV[v + 1] += ny; NV[v + 2] += nz; }
      const l = Math.hypot(nx, ny, nz) || 1; FN[3 * t] = nx / l; FN[3 * t + 1] = ny / l; FN[3 * t + 2] = nz / l;
    }
    for (let v = 0; v < nV; v++) { const l = Math.hypot(NV[3 * v], NV[3 * v + 1], NV[3 * v + 2]) || 1; NV[3 * v] /= l; NV[3 * v + 1] /= l; NV[3 * v + 2] /= l; }
    const P = new Float32Array(9 * nT), N = new Float32Array(9 * nT), C = barvy ? new Float32Array(9 * nT) : null, kos = Math.cos(30 * Math.PI / 180);
    for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) {
      const v = 3 * I[3 * t + k], q = 9 * t + 3 * k;
      P[q] = V[v]; P[q + 1] = V[v + 1]; P[q + 2] = V[v + 2];
      const hl = NV[v] * FN[3 * t] + NV[v + 1] * FN[3 * t + 1] + NV[v + 2] * FN[3 * t + 2] > kos;
      N[q] = hl ? NV[v] : FN[3 * t]; N[q + 1] = hl ? NV[v + 1] : FN[3 * t + 1]; N[q + 2] = hl ? NV[v + 2] : FN[3 * t + 2];
      if (C) { const c = barvy(t); C[q] = c[0]; C[q + 1] = c[1]; C[q + 2] = c[2]; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  function uklid(o) {
    if (!o) return;
    if (o.parent) o.parent.remove(o);
    o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { if (c.material.map) c.material.map.dispose(); c.material.dispose(); } });
  }
  const barvaObjektu = () => { const e = $('objectColorPicker'); return new THREE.Color(e ? e.value : '#6aa6fd'); };
  function obnovTisk() {
    const s = cfg && cfg.scena();
    if (!s || !s.scene) return;
    uklid(tiskSkupina); tiskSkupina = null; tiskMesh = null;
    if (zobr.tisk && sitT) {
      const T = zobr.previsy ? G3D.tridyPrevisu(sitT.V, sitT.I, 45) : null, zakl = barvaObjektu();
      const g = geometrie(sitT.V, sitT.I, T && (t => (T[t] === 1 || T[t] === 2 ? G3D.BARVY_TRID[T[t]] : [zakl.r, zakl.g, zakl.b])));
      const bb = g.boundingBox, st = new THREE.Vector3(); bb.getCenter(st);
      tiskSkupina = new THREE.Group();
      const vnitrni = new THREE.Group(); vnitrni.position.set(-st.x, -st.y, -st.z); tiskSkupina.add(vnitrni);
      tiskMesh = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ color: T ? 0xffffff : zakl, vertexColors: !!T, shininess: 60 }));
      vnitrni.add(tiskMesh);
      const vel = new THREE.Vector3(); bb.getSize(vel);
      const strana = Math.ceil(Math.max(vel.x, vel.y, 20) * 1.5 / 10) * 10;
      const mriz = new THREE.GridHelper(strana, Math.max(2, Math.round(strana / 10)), 0x888888, 0x555555);
      mriz.rotation.x = Math.PI / 2; mriz.position.set(st.x, st.y, bb.min.z - 0.05);
      mriz.material.transparent = true; mriz.material.opacity = 0.45;
      vnitrni.add(mriz);
      s.scene.add(tiskSkupina);
    }
    obnovPravitka();
  }
  function obnovPravitka() {
    uklid(pravitkaObj); pravitkaObj = null;
    const s = cfg && cfg.scena(), cil = zobr.tisk ? tiskMesh : s && s.mesh;
    if (!zobr.pravitka || !cil || !G3D.koty) return;
    cil.geometry.computeBoundingBox();
    const box = cil.geometry.boundingBox, a = box.min, b = box.max, vel = new THREE.Vector3(); box.getSize(vel);
    const pozadi = s.scene.background && s.scene.background.isColor ? s.scene.background : new THREE.Color('#1a1a1a');
    const tmave = pozadi.r * 0.3 + pozadi.g * 0.59 + pozadi.b * 0.11 < 0.5;
    pravitkaObj = G3D.koty.postav(THREE, {
      barva: tmave ? '#e8eef8' : '#1b2533', pozadi: '#' + pozadi.getHexString(), velikost: Math.max(vel.x, vel.y, vel.z),
      pravitka: [
        { a: [a.x, a.y, a.z], b: [b.x, a.y, a.z], n: [0, -1, 0] },
        { a: [b.x, a.y, a.z], b: [b.x, b.y, a.z], n: [1, 0, 0] },
        { a: [a.x, b.y, a.z], b: [a.x, b.y, b.z], n: [-1, 0, 0] },
      ],
    });
    cil.add(pravitkaObj);
  }
  function legenda() {
    const l = $('legPrevisy'); if (l) l.hidden = !(zobr.previsy && (zobr.tisk || cfg.previsy));
    const r = $('legRez'); if (r) r.hidden = !zobr.rez;
  }
  const qa = typeof THREE !== 'undefined' ? [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()] : null;
  const OSA_X = typeof THREE !== 'undefined' ? new THREE.Vector3(1, 0, 0) : null, OSA_Y = typeof THREE !== 'undefined' ? new THREE.Vector3(0, 1, 0) : null;
  /** Každý snímek: tisková skupina sleduje natočení náhledu, řez a skrytí modelu. */
  function synchronizuj() {
    const s = cfg && cfg.scena(); if (!s || !s.scene) return;
    const m = s.mesh;
    if (m) m.visible = !(zobr.tisk && tiskSkupina);
    if (s.hrany) s.hrany.visible = !(zobr.tisk && tiskSkupina);
    if (tiskSkupina && m) {
      const a = tiskUhel.a + (m.rotation.y - tiskUhel.ry0), t = tiskUhel.t + (m.rotation.x - tiskUhel.rx0);
      qa[0].setFromAxisAngle(OSA_X, t); qa[1].setFromAxisAngle(OSA_Y, a); qa[2].setFromAxisAngle(OSA_X, -Math.PI / 2);
      tiskSkupina.quaternion.copy(qa[0]).multiply(qa[1]).multiply(qa[2]);
      tiskSkupina.updateMatrixWorld(true);
    }
    // řez rovinou osy dílu (lokální x = střed obalu) – vnitřek červeně
    const cil = zobr.tisk && tiskMesh ? tiskMesh : m;
    s.renderer.localClippingEnabled = true;
    for (const o of [m, tiskMesh]) {
      if (!o || !o.material) continue;
      const chci = zobr.rez && o === cil;
      if (chci !== !!(o.material.clippingPlanes && o.material.clippingPlanes.length)) {
        if (chci) { o.userData.strana = o.material.side; o.material.side = THREE.FrontSide; o.material.clippingPlanes = [rovina]; }
        else { o.material.clippingPlanes = []; if (o.userData.strana !== undefined) o.material.side = o.userData.strana; }
        o.material.needsUpdate = true;
      }
    }
    if (rezMesh && (!zobr.rez || rezMesh.parent !== cil || rezMesh.geometry !== (cil && cil.geometry))) { if (rezMesh.parent) rezMesh.parent.remove(rezMesh); rezMesh.material.dispose(); rezMesh = null; }
    if (zobr.rez && cil) {
      if (!rezMesh) {
        rezMesh = new THREE.Mesh(cil.geometry, new THREE.MeshBasicMaterial({ color: 0xc0504d, side: THREE.BackSide, clippingPlanes: [rovina] }));
        cil.add(rezMesh);
      }
      cil.updateMatrixWorld(true);
      if (!cil.geometry.boundingBox) cil.geometry.computeBoundingBox();
      const st = new THREE.Vector3(); cil.geometry.boundingBox.getCenter(st);
      rovina.set(new THREE.Vector3(-1, 0, 0), st.x).applyMatrix4(cil.matrixWorld);
    }
  }
  function pohled(j) {
    if (zobr.tisk) {
      const U = { iso: [-0.6, 0.55], shora: [0, Math.PI / 2], zepredu: [0, 0], zboku: [Math.PI / 2, 0], zespodu: [0, -Math.PI / 2] }[j];
      const m = cfg.scena().mesh;
      if (U && m) { tiskUhel.a = U[0]; tiskUhel.t = U[1]; tiskUhel.rx0 = m.rotation.x; tiskUhel.ry0 = m.rotation.y; return; }
    }
    cfg.pohled(j);
  }

  window.TrubkyG3D = { pripoj, poGeneraci, zaznamenej, normalizuj, podsit, get app() { return app; }, get zobr() { return zobr; } };
})();
