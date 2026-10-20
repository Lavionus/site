/* ============================================================
   Segmentové soustružení – uživatelské rozhraní
   ============================================================ */
(function () {
  'use strict';
  const J = window.SEGJ, V = window.SEGV, STL = window.SEGSTL, PR = window.SEGPrincip;
  const $ = (id) => document.getElementById(id);
  const KLIC = 'webapp_segmentove_soustruzeni', KLIC_PROJEKTY = 'webapp_segmentove_soustruzeni_projekty';
  const cz = (x, d) => (x == null || !isFinite(x) ? '–' : String(Math.round(x * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).replace('.', ',').replace('-', '−'));
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (t, ch) => (typeof Dialog !== 'undefined' ? (ch ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t));
  const PREDVOLBY = Object.keys(J.PREDVOLBY);
  const NAST_POLE = ['tlPrkna', 'n', 'pridavek', 'pridavekV', 'minOtvor', 'minPrekryv', 'maxSirka', 'cihla', 'prorez', 'maxLista', 'odpad', 'sloucit', 'otaceni',
    'papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'kalibX', 'kalibY', 'klinDelka', 'klinVyska', 'klinHrot', 'dorazDelka', 'dorazVyska', 'stul', 'stlText', 'klinDiry'];
  const TISK_POLE = ['papir', 'okraj', 'prekryv', 'papirW', 'papirH', 'kalibX', 'kalibY', 'klinDelka', 'klinVyska', 'klinHrot', 'dorazDelka', 'dorazVyska', 'stul', 'stlText', 'klinDiry'];

  /* ---------- stav ---------- */
  function nacistStav() {
    try {
      const u = JSON.parse(localStorage.getItem(KLIC) || 'null');
      if (u && u.profil && Array.isArray(u.profil.vnejsi)) return doplnStav(u);
    } catch (e) { /* poškozené úložiště */ }
    return doplnStav(J.vychoziProjekt('misa'));
  }
  function doplnStav(u) {
    const P = J.vychoziProjekt(u.predvolba && J.PREDVOLBY[u.predvolba] ? u.predvolba : 'misa');
    const S = Object.assign(P, u);
    S.nast = Object.assign({}, J.NASTAVENI, { stul: 220 }, u.nast || {});
    S.profil = Object.assign({}, J.PROFIL, u.profil || {});
    if (!Array.isArray(S.dreviny) || !S.dreviny.length) S.dreviny = J.vychoziDreviny();
    if (!Array.isArray(S.krouzky)) S.krouzky = [];
    S.ui = Object.assign({ krouzek: 2, vrstva: 0, krivka: 'vnejsi', rezim3d: 'hotovy', rez: false }, u.ui || {});
    return S;
  }
  let S = nacistStav(), N = null, ulozTimer = 0, vybranyBod = null;
  const uloz = () => { clearTimeout(ulozTimer); ulozTimer = setTimeout(() => { try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch (e) { /* plné úložiště */ } }, 250); };
  const projekty = () => { try { return JSON.parse(localStorage.getItem(KLIC_PROJEKTY) || '{}') || {}; } catch (e) { return {}; } };
  const ulozProjekty = (o) => { try { localStorage.setItem(KLIC_PROJEKTY, JSON.stringify(o)); return true; } catch (e) { toast('Úložiště prohlížeče je plné.', true); return false; } };

  /* ---------- předvolby ---------- */
  function vykresliPredvolby() {
    $('predvolby').innerHTML = PREDVOLBY.map((k, i) => `<button type="button" data-k="${k}" aria-pressed="${S.predvolba === k}">${esc(J.PREDVOLBY[k].nazev)}<kbd>${i + 1}</kbd></button>`).join('');
    $('popisPredvolby').textContent = (J.PREDVOLBY[S.predvolba] || {}).popis || '';
  }
  async function nactiPredvolbu(k, ptat) {
    if (ptat && !(await Dialog.potvrd(`Nahradit současný návrh předvolbou „${J.PREDVOLBY[k].nazev}“? (Uložené projekty zůstanou.)`))) return;
    const P = J.vychoziProjekt(k);
    for (const p of TISK_POLE) if (S.nast[p] != null) P.nast[p] = S.nast[p];
    P.ui = Object.assign({}, S.ui, { krouzek: Math.min(2, P.krouzky.length - 1), vrstva: 0, krivka: 'vnejsi' });
    S = doplnStav(P); vybranyBod = null;
    naplnPole(); vykresliPredvolby(); prepocti();
  }
  $('predvolby').addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) nactiPredvolbu(b.dataset.k, true); });

  /* ---------- pole nastavení ---------- */
  function naplnPole() {
    for (const p of NAST_POLE) { const el = $(p); if (!el) continue; if (el.type === 'checkbox') el.checked = S.nast[p] !== false; else el.value = S.nast[p] == null ? '' : S.nast[p]; }
    $('stena').value = S.profil.stena; $('dno').value = S.profil.dno; $('rezimVnitrni').value = S.profil.rezimVnitrni || 'odsazeni';
    $('krivkaEdit').value = S.ui.krivka; $('nazevProjektu').value = S.nazev || '';
    $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
    vykresliDreviny();
  }
  for (const p of NAST_POLE) {
    const el = $(p); if (!el) continue;
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', () => {
      if (el.type === 'checkbox') S.nast[p] = el.checked;
      else if (el.type === 'number') { const v = J.cislo(el.value, null); if (v == null) return; S.nast[p] = v; }
      else S.nast[p] = el.value;
      if (p === 'papir') $('blokPapir').classList.toggle('skryte', S.nast.papir !== 'vlastni');
      naplanuj();
    });
  }
  for (const p of ['stena', 'dno']) $(p).addEventListener('input', () => { const v = J.cislo($(p).value, null); if (v == null) return; S.profil[p] = v; naplanuj(); });
  $('rezimVnitrni').addEventListener('change', () => {
    S.profil.rezimVnitrni = $('rezimVnitrni').value;
    if (S.profil.rezimVnitrni === 'vlastni' && (S.profil.vnitrni || []).length < 2) vnitrniZOdsazeni();
    if (S.profil.rezimVnitrni === 'odsazeni' && S.ui.krivka === 'vnitrni') { S.ui.krivka = 'vnejsi'; $('krivkaEdit').value = 'vnejsi'; }
    prepocti();
  });
  $('krivkaEdit').addEventListener('change', () => {
    S.ui.krivka = $('krivkaEdit').value; vybranyBod = null;
    if (S.ui.krivka === 'vnitrni' && S.profil.rezimVnitrni !== 'vlastni') { S.profil.rezimVnitrni = 'vlastni'; $('rezimVnitrni').value = 'vlastni'; if ((S.profil.vnitrni || []).length < 2) vnitrniZOdsazeni(); }
    prepocti();
  });
  function vnitrniZOdsazeni() {
    const P = J.vzorkujProfil(Object.assign({}, S.profil, { rezimVnitrni: 'odsazeni' }));
    const k = 6, out = [];
    for (let i = 0; i <= k; i++) { const z = P.tb + (P.H - P.tb) * i / k; out.push({ r: Math.round(Math.max(1, P.rIn(z)) * 2) / 2, z: Math.round(z * 2) / 2 }); }
    S.profil.vnitrni = out;
  }
  $('btnVnitrniZOdsazeni').addEventListener('click', () => { vnitrniZOdsazeni(); S.profil.rezimVnitrni = 'vlastni'; S.ui.krivka = 'vnitrni'; naplnPole(); prepocti(); });
  let planTimer = 0;
  function naplanuj() { clearTimeout(planTimer); planTimer = setTimeout(prepocti, 120); }

  /* ---------- body profilu ---------- */
  const aktivniBody = () => (S.ui.krivka === 'vnitrni' ? (S.profil.vnitrni = S.profil.vnitrni || []) : S.profil.vnejsi);
  function vykresliBody() {
    const B = aktivniBody();
    let h = '<tr><th>#</th><th>r (mm)</th><th>z (mm)</th><th>ostrý</th><th></th></tr>';
    B.forEach((q, i) => {
      h += `<tr data-i="${i}" class="${vybranyBod === i ? 'vybrany' : ''}"><td>${i + 1}</td><td><input type="number" step="0.5" min="0.5" data-i="${i}" data-p="r" value="${q.r}"></td><td><input type="number" step="0.5" min="0" data-i="${i}" data-p="z" value="${q.z}"${i === 0 && S.ui.krivka === 'vnejsi' ? ' disabled title="pata leží na z = 0"' : ''}></td>`
        + `<td style="text-align:center"><input type="checkbox" data-i="${i}" data-p="ostry"${q.ostry ? ' checked' : ''} style="width:auto"></td><td><button class="btn btn-sec btn-mini" data-smaz="${i}" type="button" aria-label="Smazat bod">✕</button></td></tr>`;
    });
    $('tabBody').innerHTML = h;
  }
  $('tabBody').addEventListener('change', (e) => {
    const el = e.target, i = +el.dataset.i, p = el.dataset.p, B = aktivniBody();
    if (!p || !B[i]) return;
    if (p === 'ostry') B[i].ostry = el.checked; else { const v = J.cislo(el.value, null); if (v == null) return; B[i][p] = Math.max(p === 'r' ? 0.5 : 0, v); }
    seradBody(); prepocti();
  });
  $('tabBody').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-smaz]');
    if (b) { smazBod(+b.dataset.smaz); return; }
    const tr = e.target.closest('tr[data-i]'); if (tr && e.target.tagName !== 'INPUT') { vybranyBod = +tr.dataset.i; vykresliBody(); vykresliEditor(); }
  });
  function smazBod(i) {
    const B = aktivniBody();
    if (B.length <= 2) { toast('Křivka potřebuje aspoň 2 body.'); return; }
    B.splice(i, 1); if (S.ui.krivka === 'vnejsi') B[0].z = 0; vybranyBod = null; prepocti();
  }
  function seradBody() {
    const B = aktivniBody(), sel = vybranyBod != null ? B[vybranyBod] : null;
    B.sort((a, b) => a.z - b.z);
    if (S.ui.krivka === 'vnejsi' && B.length) B[0].z = 0;
    vybranyBod = sel ? B.indexOf(sel) : null;
  }
  $('btnBodPridat').addEventListener('click', () => {
    const B = aktivniBody();
    if (B.length < 2) return;
    // nový bod v polovině nejdelšího úseku
    let k = 0, d = -1;
    for (let i = 0; i < B.length - 1; i++) { const l = Math.hypot(B[i + 1].r - B[i].r, B[i + 1].z - B[i].z); if (l > d) { d = l; k = i; } }
    const z = (B[k].z + B[k + 1].z) / 2, P = N && N.P, r = P ? (S.ui.krivka === 'vnitrni' ? P.rIn(z) : P.rOut(z)) : (B[k].r + B[k + 1].r) / 2;
    B.splice(k + 1, 0, { r: Math.round(r * 2) / 2, z: Math.round(z * 2) / 2 }); vybranyBod = k + 1; prepocti();
  });

  /* ---------- dřeviny ---------- */
  function vykresliDreviny() {
    const D = S.dreviny;
    let h = '<tr><th>#</th><th>barva</th><th class="l">dřevina</th><th>kg/m³</th><th></th></tr>';
    D.forEach((d, i) => {
      h += `<tr><td>${i + 1}</td><td><input type="color" data-i="${i}" data-p="barva" value="${esc(d.barva)}" aria-label="Barva"></td><td><input type="text" data-i="${i}" data-p="nazev" value="${esc(d.nazev)}" maxlength="30"></td>`
        + `<td><input type="number" data-i="${i}" data-p="hustota" value="${d.hustota}" min="100" max="1400" step="10" style="width:70px"></td><td>${D.length > 1 ? `<button class="btn btn-sec btn-mini" data-smaz="${i}" type="button" aria-label="Odebrat dřevinu">✕</button>` : ''}</td></tr>`;
    });
    $('tabDreviny').innerHTML = h;
    $('novaDrevina').innerHTML = J.DREVINY.map((d) => `<option value="${d.id}">${esc(d.nazev)} (${d.hustota} kg/m³)</option>`).join('');
  }
  $('tabDreviny').addEventListener('change', (e) => {
    const el = e.target, i = +el.dataset.i, p = el.dataset.p; if (!p) return;
    S.dreviny[i][p] = p === 'hustota' ? Math.max(100, J.cislo(el.value, 650)) : el.value;
    prepocti();
  });
  $('tabDreviny').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-smaz]'); if (!b) return;
    const i = +b.dataset.smaz;
    if (!(await Dialog.potvrd(`Odebrat dřevinu „${S.dreviny[i].nazev}“? Kroužky s ní dostanou sousední dřevinu.`))) return;
    S.dreviny.splice(i, 1);
    const prem = (x) => (x > i ? x - 1 : x === i ? Math.max(0, i - 1) : x);
    for (const c of S.krouzky) { c.sekv = (c.sekv || [0]).map(prem); if (c.dyhaDruh != null) c.dyhaDruh = prem(c.dyhaDruh); }
    vykresliDreviny(); prepocti();
  });
  $('btnDrevinaPridat').addEventListener('click', () => {
    const d = J.DREVINY.find((x) => x.id === $('novaDrevina').value); if (!d) return;
    if (S.dreviny.length >= 12) { toast('Nejvýš 12 dřevin.'); return; }
    S.dreviny.push(Object.assign({}, d)); vykresliDreviny(); prepocti();
  });

  /* ---------- výpočet a vykreslení ---------- */
  function prepocti(lehce) {
    try { N = J.navrh(S); }
    catch (e) { $('varovani').innerHTML = `<li>${esc(e.message)}</li>`; return; }
    if (!lehce) S.krouzky = JSON.parse(JSON.stringify(N.konfig));
    S.ui.krouzek = Math.max(0, Math.min(N.krouzky.length - 1, S.ui.krouzek | 0));
    $('varovani').innerHTML = N.varovani.map((v) => `<li>${esc(v)}</li>`).join('');
    vykresliEditor(); vykresliKrouzek();
    if (lehce) return;
    vykresliBody(); vykresliSouhrn(); vykresliTabKrouzku(); vykresliVykres(); vykresliPlan(); vykresliKusovnik(); kalkulacka(); infoStl();
    aktualizuj3d();
    uloz();
  }

  /* editor profilu (SVG v mm, y = −z) */
  function vykresliEditor() {
    if (!N) return;
    const P = N.P, Ks = N.krouzky, Rm = Math.max(...Ks.map((K) => K.aOut)), z0 = Ks[0].z0, z1 = Ks[Ks.length - 1].z1;
    const x0 = -10, x1 = Rm + 22, y0 = -(z1 + 8), y1 = -(z0 - 8), w = x1 - x0, h = y1 - y0, span = Math.max(w, h);
    const rb = span / 85, fs = span / 42;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" id="editorSvg" font-family="Liberation Sans, Arial, sans-serif">`;
    s += `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`;
    // mřížka po 10 mm
    let g = '';
    for (let x = 0; x <= x1; x += 10) g += `M${x} ${y0}V${y1}`;
    for (let z = 0; -z >= y0; z += 10) g += `M${x0} ${-z}H${x1}`;
    s += `<path d="${g}" stroke="#eef1f4" stroke-width="${span / 900}" fill="none"/>`;
    Ks.forEach((K, i) => {
      const vin = K.typ === 'segmenty' ? K.rv : K.typ === 'otevreny' ? K.aIn : K.aIn;
      const barva = N.dreviny[K.vrstvy[0].kusy[0].druh].barva, vyb = i === S.ui.krouzek;
      s += `<rect data-k="${i}" x="${vin}" y="${-K.z1}" width="${Math.max(0.5, K.aOut - vin)}" height="${K.h}" fill="${barva}" fill-opacity="${vyb ? 0.5 : 0.28}" stroke="${vyb ? '#2862bb' : '#888'}" stroke-width="${vyb ? span / 260 : span / 700}" style="cursor:pointer"/>`;
      s += `<text x="${K.aOut + 2}" y="${-(K.z0 + K.z1) / 2 + fs * 0.35}" font-size="${Math.min(fs, K.h * 0.8)}" fill="${vyb ? '#2862bb' : '#555'}">${K.cislo}</text>`;
    });
    // stěna
    let d = '';
    for (let i = 0; i <= P.Nz; i += 2) d += (i ? 'L' : 'M') + P.ro[i].toFixed(2) + ' ' + (-P.zs[i]).toFixed(2);
    d += `L${P.ro[P.Nz].toFixed(2)} ${-P.H}`;
    for (let i = P.Nz; i >= 0; i -= 2) if (P.zs[i] >= P.tb) d += 'L' + P.ri[i].toFixed(2) + ' ' + (-P.zs[i]).toFixed(2);
    d += `L${P.rIn(P.tb).toFixed(2)} ${-P.tb}L0 ${-P.tb}L0 0Z`;
    s += `<path d="${d}" fill="#d9b98a" fill-opacity=".55" stroke="#b3261e" stroke-width="${span / 300}" stroke-linejoin="round"/>`;
    s += `<path d="M0 ${y0}V${y1}" stroke="#1f5fa8" stroke-width="${span / 600}" stroke-dasharray="${span / 60} ${span / 150} ${span / 300} ${span / 150}"/>`;
    // řídicí body (aktivní křivka plné, druhá jen obrys)
    const kreslitBody = (B, kr, akt) => B.forEach((q, i) => {
      const sel = akt && vybranyBod === i;
      s += `<circle data-bod="${i}" data-krivka="${kr}" cx="${q.r}" cy="${-q.z}" r="${sel ? rb * 1.35 : rb}" fill="${akt ? (sel ? '#d04a00' : '#1f5fa8') : '#ffffff'}" stroke="#1f5fa8" stroke-width="${span / 500}" style="cursor:${akt ? 'grab' : 'pointer'}"${q.ostry ? '' : ''}/>`;
      if (q.ostry) s += `<rect x="${q.r - rb * 0.45}" y="${-q.z - rb * 0.45}" width="${rb * 0.9}" height="${rb * 0.9}" fill="#fff" pointer-events="none"/>`;
    });
    if (S.profil.rezimVnitrni === 'vlastni') kreslitBody(S.profil.vnitrni || [], 'vnitrni', S.ui.krivka === 'vnitrni');
    kreslitBody(S.profil.vnejsi, 'vnejsi', S.ui.krivka === 'vnejsi');
    s += `<text x="${x0 + 2}" y="${y0 + fs * 1.2}" font-size="${fs}" fill="#333">H ${cz(P.H)} · Ø ${cz(N.souhrn.prumerMax)} mm</text>`;
    s += '</svg>';
    $('editor').innerHTML = s;
    $('rozmerProfil').textContent = `výška ${cz(P.H)} mm · Ø max ${cz(N.souhrn.prumerMax)} · stěna ${cz(P.t)} · dno ${cz(P.tb)}`;
  }
  let tah = null;
  function bodModelu(e) {
    const svg = $('editorSvg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return { r: p.x, z: -p.y };
  }
  $('editor').addEventListener('pointerdown', (e) => {
    const c = e.target.closest('circle[data-bod]');
    if (c) {
      const kr = c.dataset.krivka;
      if (kr !== S.ui.krivka) { S.ui.krivka = kr; $('krivkaEdit').value = kr; }
      vybranyBod = +c.dataset.bod;
      tah = { i: vybranyBod, id: e.pointerId, pohyb: false };
      $('editor').setPointerCapture(e.pointerId); e.preventDefault();
      vykresliBody(); vykresliEditor();
      return;
    }
    const r = e.target.closest('rect[data-k]');
    if (r) { S.ui.krouzek = +r.dataset.k; S.ui.vrstva = 0; vykresliEditor(); vykresliKrouzek(); vykresliTabKrouzku(); kalkulacka(true); infoStl(); uloz(); }
  });
  $('editor').addEventListener('pointermove', (e) => {
    if (!tah || e.pointerId !== tah.id) return;
    const B = aktivniBody(), q = B[tah.i]; if (!q) return;
    const m = bodModelu(e);
    q.r = Math.max(0.5, Math.round(m.r * 2) / 2);
    q.z = tah.i === 0 && S.ui.krivka === 'vnejsi' ? 0 : Math.max(0, Math.round(m.z * 2) / 2);
    tah.pohyb = true;
    prepocti(true);
  });
  const konecTahu = (e) => { if (!tah || e.pointerId !== tah.id) return; const pohyb = tah.pohyb; tah = null; if (pohyb) { seradBody(); prepocti(); } };
  $('editor').addEventListener('pointerup', konecTahu); $('editor').addEventListener('pointercancel', konecTahu);
  $('editor').addEventListener('dblclick', (e) => {
    if (e.target.closest('circle')) return;
    const m = bodModelu(e), B = aktivniBody();
    if (m.r < 0 || m.z < 0) return;
    B.push({ r: Math.round(m.r * 2) / 2, z: Math.round(m.z * 2) / 2 });
    vybranyBod = B.length - 1; seradBody(); prepocti();
  });

  /* kroužek shora */
  function vykresliKrouzek() {
    if (!N) return;
    const K = N.krouzky[S.ui.krouzek]; if (!K) return;
    S.ui.vrstva = Math.min(S.ui.vrstva | 0, K.vrstvy.length - 1);
    $('nahledKrouzku').innerHTML = V.svg(V.scenaKrouzku(N, K.i, { vrstva: S.ui.vrstva }), { sirkaPx: true, okraj: 2 });
    $('nadpisKrouzku').textContent = `Kroužek ${K.cislo} shora (1:1 v PDF)`;
    $('vrstvy').innerHTML = K.vrstvy.length > 1 ? K.vrstvy.map((v, i) => `<button type="button" data-v="${i}" aria-pressed="${i === S.ui.vrstva}">podvrstva ${i + 1}</button>`).join('') : '';
    const typ = { segmenty: 'segmenty', otevreny: 'otevřené segmentování', deska: 'plná deska', mezivrstva: 'mezivrstva' }[K.typ];
    let t = `<b>${typ}</b>, tl. ${cz(K.h)} mm, z ${cz(K.z0)} až ${cz(K.z1)} mm. `;
    if (K.typ === 'segmenty') t += `${K.n} segmentů, <b>pokos ${cz(K.uhelRezu, 2)}°</b>, vnější hrana <b>${cz(K.Lout)}</b>, vnitřní <b>${cz(K.Lin)}</b>, šířka lišty <b>${cz(K.W)}</b> mm, spára ${cz(K.Lspara)} mm. `;
    else if (K.typ === 'otevreny') t += `${K.n} bloků <b>${cz(K.Lout)} × ${cz(K.W)}</b> mm (řez 90°), mezera mezi bloky ≈ ${cz(K.mezera)} mm na povrchu. `;
    else t += `kotouč Ø ${cz(2 * K.aOut)}${K.aIn ? ', otvor Ø ' + cz(2 * K.aIn) : ''} mm. `;
    t += `Hotový profil: r ${cz(K.rInMin)} až ${cz(K.rOutMax)} mm${K.prekryv != null ? `, lepená plocha s kroužkem pod ním ${cz(K.prekryv)} mm` : ''}.`;
    $('infoKrouzku').innerHTML = t;
  }
  $('vrstvy').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; S.ui.vrstva = +b.dataset.v; vykresliKrouzek(); });

  function vykresliSouhrn() {
    const s = N.souhrn;
    const dl = [['výška', cz(s.vyska) + ' mm'], ['Ø max / okraj', `${cz(s.prumerMax, 0)} / ${cz(s.prumerOkraj, 0)} mm`], ['kroužků / segmentů', `${s.kroužků} / ${s.segmentu}`], ['objem dutiny', cz(s.objemDutiny / 1000, 2) + ' l'],
      ['hmotnost hrubá', cz(s.hmotnostHruba, 2) + ' kg'], ['po soustružení', cz(s.hmotnostHotova, 2) + ' kg'], ['délka lišt', cz(s.delkaList / 1000, 2) + ' m'], ['třísky', cz(s.odpad * 100, 0) + ' %']];
    $('souhrn').innerHTML = dl.map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
  }

  /* tabulka kroužků */
  const sekvTxt = (q) => (q || [0]).map((x) => x + 1).join(' ');
  function vykresliTabKrouzku() {
    const D = S.dreviny;
    let h = '<tr><th>#</th><th>z</th><th>tl.</th><th>typ</th><th>n</th><th>vzor</th><th class="l">dřeviny</th><th>podvr./podíl</th><th>dýha</th><th>dýha dř.</th><th>posun °</th><th>pokos</th><th>vnější</th><th>vnitřní</th><th>šířka</th><th>lep. pl.</th></tr>';
    for (let i = N.krouzky.length - 1; i >= 0; i--) {
      const K = N.krouzky[i], c = S.krouzky[i] || {}, seg = K.typ === 'segmenty' || K.typ === 'otevreny';
      const cipy = [...new Set(K.vrstvy.flatMap((v) => v.kusy.map((q) => q.druh)))].map((d) => `<span class="cip" style="background:${D[d].barva}" title="${esc(D[d].nazev)}"></span>`).join('');
      const pv = c.vzor === 'sachovnice' ? `<input type="number" min="2" max="6" step="1" data-k="${i}" data-p="podvrstvy" value="${c.podvrstvy || 2}" title="počet podvrstev">` : c.vzor === 'otevreny' ? `<input type="number" min="15" max="90" step="5" data-k="${i}" data-p="podil" value="${Math.round((c.podil || 0.5) * 100)}" title="zaplněný podíl obvodu v %">` : '–';
      h += `<tr data-k="${i}" class="${i === S.ui.krouzek ? 'vybrany' : ''}"${K.varovani.length ? ` title="${esc(K.varovani.join(' '))}"` : ''}>`
        + `<td>${K.varovani.length ? '⚠ ' : ''}${K.cislo}</td><td>${cz(K.z0, 0)}–${cz(K.z1, 0)}</td>`
        + `<td><input type="number" min="0.5" max="80" step="0.5" data-k="${i}" data-p="h" value="${c.h == null ? '' : c.h}" placeholder="${cz(S.nast.tlPrkna)}" style="width:58px"></td>`
        + `<td><select data-k="${i}" data-p="typ"><option value="auto"${c.typ === 'auto' ? ' selected' : ''}>auto${K.typ === 'deska' && c.typ === 'auto' ? ' (deska)' : ''}</option><option value="deska"${c.typ === 'deska' ? ' selected' : ''}>deska</option><option value="mezivrstva"${c.typ === 'mezivrstva' ? ' selected' : ''}>mezivrstva</option></select></td>`
        + `<td><input type="number" min="3" max="96" step="1" data-k="${i}" data-p="n" value="${c.n == null ? '' : c.n}" placeholder="${S.nast.n}" style="width:52px"></td>`
        + `<td><select data-k="${i}" data-p="vzor">${[['jedna', 'jedna dřevina'], ['stridani', 'střídání'], ['sachovnice', 'šachovnice'], ['otevreny', 'otevřené']].map(([v, t]) => `<option value="${v}"${c.vzor === v ? ' selected' : ''}>${t}</option>`).join('')}</select></td>`
        + `<td class="l" style="white-space:nowrap">${cipy}<input type="text" data-k="${i}" data-p="sekv" value="${sekvTxt(c.sekv)}" style="width:64px" title="čísla dřevin (1–${D.length}), např. 1 2"></td>`
        + `<td>${pv}</td>`
        + `<td><input type="number" min="0" max="5" step="0.1" data-k="${i}" data-p="dyhaTl" value="${c.dyhaTl || ''}" placeholder="0" style="width:52px"${K.typ === 'segmenty' ? '' : ' disabled'}></td>`
        + `<td><input type="number" min="1" max="${D.length}" step="1" data-k="${i}" data-p="dyhaDruh" value="${(c.dyhaDruh == null ? 1 : c.dyhaDruh) + 1}" style="width:46px"${K.typ === 'segmenty' && c.dyhaTl ? '' : ' disabled'}></td>`
        + `<td><input type="number" min="-180" max="180" step="0.5" data-k="${i}" data-p="posun" value="${c.posun == null ? '' : c.posun}" placeholder="${seg ? cz(K.posun * 180 / Math.PI, 2) : '–'}" style="width:58px"${seg ? '' : ' disabled'}></td>`
        + `<td>${K.typ === 'segmenty' ? cz(K.uhelRezu, 2) + '°' : K.typ === 'otevreny' ? '90°' : '–'}</td><td>${K.typ === 'deska' || K.typ === 'mezivrstva' ? 'Ø ' + cz(2 * K.aOut, 0) : cz(K.Lout)}</td><td>${K.typ === 'deska' || K.typ === 'mezivrstva' ? (K.aIn ? 'Ø ' + cz(2 * K.aIn, 0) : '–') : cz(K.Lin)}</td><td>${cz(K.W)}</td><td>${K.prekryv == null ? '–' : cz(K.prekryv)}</td></tr>`;
    }
    $('tabKrouzky').innerHTML = h;
  }
  $('tabKrouzky').addEventListener('change', (e) => {
    const el = e.target, i = +el.dataset.k, p = el.dataset.p; if (!p || !S.krouzky[i]) return;
    const c = S.krouzky[i], v = el.value.trim();
    if (p === 'sekv') { const a = v.split(/[\s,;]+/).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= S.dreviny.length).map((x) => x - 1); c.sekv = a.length ? a : [0]; }
    else if (p === 'h' || p === 'n' || p === 'posun') c[p] = v === '' ? null : J.cislo(v, null);
    else if (p === 'podil') c.podil = Math.max(0.15, Math.min(0.9, J.cislo(v, 50) / 100));
    else if (p === 'dyhaDruh') c.dyhaDruh = Math.max(0, Math.min(S.dreviny.length - 1, Math.round(J.cislo(v, 2)) - 1));
    else if (p === 'dyhaTl' || p === 'podvrstvy') c[p] = Math.max(0, J.cislo(v, 0));
    else c[p] = v;
    if (p === 'vzor' && v === 'stridani' && c.sekv.length < 2) c.sekv = [c.sekv[0], (c.sekv[0] + 1) % S.dreviny.length];
    if (p === 'vzor' && v === 'sachovnice' && c.sekv.length < 2) c.sekv = [c.sekv[0], (c.sekv[0] + 1) % S.dreviny.length];
    S.ui.krouzek = i; prepocti();
  });
  $('tabKrouzky').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-k]'); if (!tr || /INPUT|SELECT/.test(e.target.tagName)) return;
    S.ui.krouzek = +tr.dataset.k; S.ui.vrstva = 0;
    for (const r of $('tabKrouzky').querySelectorAll('tr[data-k]')) r.classList.toggle('vybrany', +r.dataset.k === S.ui.krouzek);
    vykresliEditor(); vykresliKrouzek(); kalkulacka(true); infoStl(); uloz();
  });

  function vykresliVykres() { $('vykres').innerHTML = V.svg(V.scenaVykresu(N), { sirkaPx: true, okraj: 2 }); }

  function vykresliPlan() {
    const D = N.dreviny, pl = N.plan, cip = (d) => `<span class="cip" style="background:${D[d].barva}"></span>`;
    let h = '<tr><th class="l">lišta</th><th class="l">dřevina</th><th>tl. × šířka</th><th>délka</th><th>kroužek</th><th>kusů</th><th>vnější / vnitřní</th><th>pokos</th><th class="l">na liště od</th></tr>';
    for (const L of pl.listy) L.polozky.forEach((q, k) => {
      h += `<tr><td class="l">${k ? '' : L.id}</td><td class="l">${k ? '' : cip(L.druh) + esc(D[L.druh].nazev)}</td><td>${k ? '' : `${cz(L.tl)} × ${cz(L.W)}`}</td><td>${k ? '' : cz(L.delkaZaokr, 0)}</td>`
        + `<td>${q.krouzek}${q.vrstev > 1 ? '/' + (q.vrstva + 1) : ''}</td><td>${q.ks}</td><td>${cz(q.Lout)} / ${cz(q.Lin)}</td><td>${q.typ === 'seg' ? cz(q.uhel, 2) + '°' : '90°'}</td><td class="l">${cz(q.od, 0)} mm</td></tr>`;
    });
    for (const q of pl.desky) h += `<tr><td class="l">deska</td><td class="l">${cip(q.druh)}${esc(D[q.druh].nazev)}</td><td>${cz(q.tl)} × ${q.a}</td><td>${q.a}</td><td>${q.krouzek}</td><td>1</td><td>Ø ${cz(2 * q.R)}${q.Rin ? ' / Ø ' + cz(2 * q.Rin) : ''}</td><td>–</td><td class="l">přířez ${q.a} × ${q.a} (případně slepit z prken)</td></tr>`;
    for (const q of pl.dyhy) h += `<tr><td class="l">dýha</td><td class="l">${cip(q.druh)}${esc(D[q.druh].nazev)}</td><td>${cz(q.tl)}</td><td>–</td><td>${q.krouzek}</td><td>${q.ks}</td><td>${cz(q.delka)} × ${cz(q.sirka)}</td><td>–</td><td class="l">proužky do spár</td></tr>`;
    $('tabPlan').innerHTML = h;
    const t = `Celkem lišt ${pl.listy.length}, ${cz(N.souhrn.delkaList / 1000, 2)} m. ${S.nast.otaceni !== false ? `Otáčení lišty po každém řezu šetří ${cz(pl.uspora / 1000, 2)} m proti řezání každého segmentu zvlášť.` : `S otáčením lišty byste ušetřili ${cz(pl.uspora / 1000, 2)} m.`} Délky lišt zahrnují prořez ${cz(S.nast.prorez)} mm a odpad na začátku ${cz(S.nast.odpad)} mm, zaokrouhleno na 10 mm.`;
    $('infoPlan2').textContent = t; $('infoPlan').textContent = t;
    $('infoTisk').textContent = `Šablony: ${V.stranySablon(N, S.nast, {}).length} listů pro ${N.krouzky.length} kroužků.`;
  }
  function vykresliKusovnik() {
    const D = N.dreviny;
    let h = '<tr><th class="l">dřevina</th><th>lišt</th><th>délka lišt</th><th>desek</th><th>dýhy</th><th>objem</th><th>hmotnost</th><th class="l">hustota (typická)</th></tr>';
    let mm = 0, vv = 0;
    for (const d of N.plan.druhy) {
      mm += d.hmotnost; vv += d.objem;
      h += `<tr><td class="l"><span class="cip" style="background:${D[d.druh].barva}"></span>${esc(D[d.druh].nazev)}</td><td>${d.listu}</td><td>${cz(d.delkaList / 1000, 2)} m</td><td>${d.desek}</td><td>${d.dyhaPlocha ? cz(d.dyhaPlocha / 1e4, 1) + ' dm²' : '–'}</td><td>${cz(d.objem / 1e6, 2)} dm³</td><td>${cz(d.hmotnost, 2)} kg</td><td class="l">${D[d.druh].hustota} kg/m³</td></tr>`;
    }
    h += `<tr><td class="l"><b>celkem materiálu</b></td><td></td><td></td><td></td><td></td><td><b>${cz(vv / 1e6, 2)} dm³</b></td><td><b>${cz(mm, 2)} kg</b></td><td></td></tr>`;
    h += `<tr><td class="l">klín + doraz (3D tisk)</td><td colspan="6" class="l">PETG (nebo PLA), 4 stěny, výplň ≥ 40 %; 4 vruty 4 × 30 se zápustnou hlavou do pomocného pravítka</td><td></td></tr>`;
    h += `<tr><td class="l">lepidlo</td><td colspan="6" class="l">PVAc D2/D3 (cca ${cz(N.krouzky.reduce((s, K) => s + (K.typ === 'segmenty' ? K.n * K.Lspara * K.h : 0) + Math.PI * (K.aOut * K.aOut - (K.aIn || 0) * (K.aIn || 0)), 0) / 1e4, 0)} dm² lepených ploch); u mastných exotů epoxid</td><td></td></tr>`;
    $('tabKusovnik').innerHTML = h;
    $('infoKusovnik').textContent = `Hrubý polotovar ≈ ${cz(N.souhrn.hmotnostHruba, 2)} kg, nádoba po soustružení ≈ ${cz(N.souhrn.hmotnostHotova, 2)} kg. Hustoty jsou typické hodnoty při vlhkosti ~12 % – materiál se liší, upravte je v kartě Dřeviny.`;
  }

  /* chyba úhlu */
  function kalkulacka(zKrouzku) {
    const K = N.krouzky[S.ui.krouzek];
    if (zKrouzku || !$('chN').value) { if (K && K.typ === 'segmenty') { $('chN').value = K.n; $('chL').value = Math.round(K.Lspara * 10) / 10; } else if (!$('chN').value) { $('chN').value = S.nast.n; $('chL').value = 40; } }
    const n = Math.max(3, Math.round(J.cislo($('chN').value, 12))), d = J.cislo($('chDelta').value, 0.1), L = Math.max(1, J.cislo($('chL').value, 40)), e = Math.max(0.005, J.cislo($('chE').value, 0.1));
    const m = J.mezeraZChyby(n, d, L), tol = J.tolerance(n, L, e);
    $('chVysl').innerHTML = `Pokos ${cz(180 / n, 3)}° ${d >= 0 ? '+' : '−'} ${cz(Math.abs(d), 3)}° → součet 2n řezů <b>${cz(m.soucet, 3)}°</b> (chyba ${cz(m.celkem, 3)}°).<br>`
      + `Celý kroužek najednou: spára zeje <b>${cz(m.mezeraCely, 2)} mm</b> ${m.kde !== '–' ? '(' + m.kde + ')' : ''} · po polovinách bez srovnání: 2 spáry po <b>${cz(m.mezeraPolovina, 2)} mm</b>; po srovnání polovin na brusce 0.<br>`
      + `Pro mezeru do ${cz(e, 2)} mm musí být pokos přesný na <b>±${cz(tol, 4)}°</b> – to běžná pila nenastaví, proto se spáry srovnávají po polovinách.`;
    let h = '<tr><th>n</th><th>pokos</th><th>vnější hrana při R = 100</th><th>tolerance pro ' + cz(e, 2) + ' mm na ' + cz(L, 0) + ' mm spáře</th></tr>';
    for (const k of [6, 8, 10, 12, 14, 16, 18, 20, 24, 30, 36]) h += `<tr${k === n ? ' class="vybrany"' : ''}><td>${k}</td><td>${cz(180 / k, 3)}°</td><td>${cz(200 * Math.tan(Math.PI / k), 2)} mm</td><td>±${cz(J.tolerance(k, L, e), 4)}°</td></tr>`;
    $('tabUhly').innerHTML = h;
  }
  for (const id of ['chN', 'chDelta', 'chL', 'chE']) $(id).addEventListener('input', () => kalkulacka(false));

  /* ---------- soubory ---------- */
  function stahni(obsah, nazev, typ) {
    const blob = obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const zaklad = () => String(S.nazev || 'segmentova_nadoba').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'segmentova_nadoba';
  const nazevSouboru = (pripona, dodatek) => `${zaklad()}${dodatek ? '_' + dodatek : ''}.${pripona}`;
  let pismoSlib = null;
  function nactiPismo() {
    if (window.FONTY_JS && window.FONTY_JS['LiberationSans-Regular.ttf']) return Promise.resolve(window.FONTY_JS['LiberationSans-Regular.ttf']);
    if (pismoSlib) return pismoSlib;
    pismoSlib = new Promise((ok) => {
      const s = document.createElement('script'); s.src = 'stitky_panely/fonty/LiberationSans-Regular.ttf.js';
      s.onload = () => ok((window.FONTY_JS || {})['LiberationSans-Regular.ttf'] || null);
      s.onerror = () => { pismoSlib = null; ok(null); };
      document.head.appendChild(s);
    });
    return pismoSlib;
  }
  async function pdfStahnout(btn, strany, dodatek) {
    const b = $(btn), puv = b.textContent; b.disabled = true; b.textContent = 'Připravuji PDF…';
    try {
      if (!window.jspdf) throw new Error('Knihovna jsPDF se nenačetla.');
      const pismo = await nactiPismo();
      if (!pismo) toast('Písmo se nepodařilo načíst – PDF bude bez diakritiky.');
      const nazev = S.nazev || 'Segmentová nádoba';
      const doc = V.pdf(window.jspdf.jsPDF, strany(nazev), { pismo, nazev });
      stahni(doc.output('blob'), nazevSouboru('pdf', dodatek));
    } catch (e) { console.error(e); toast('Chyba PDF: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnPdfSablony').addEventListener('click', () => pdfStahnout('btnPdfSablony', (nazev) => V.stranySablon(N, S.nast, { nazev }), 'sablony_krouzku'));
  $('btnPdfKrouzek').addEventListener('click', () => pdfStahnout('btnPdfKrouzek', (nazev) => V.stranySablon(N, S.nast, { nazev, krouzky: [S.ui.krouzek] }), 'krouzek_' + (S.ui.krouzek + 1)));
  $('btnPdfVykres').addEventListener('click', () => pdfStahnout('btnPdfVykres', (nazev) => V.stranyVykresu(N, S.nast, { nazev }), 'vykres_plan'));
  $('btnSvgVykres').addEventListener('click', () => stahni(V.svg(V.scenaVykresu(N), { okraj: 3 }), nazevSouboru('svg', 'vykres'), 'image/svg+xml'));
  $('btnDxfVykres').addEventListener('click', () => stahni(V.dxf(V.scenaVykresu(N)), nazevSouboru('dxf', 'vykres'), 'application/dxf'));
  $('btnSvgKrouzek').addEventListener('click', () => stahni(V.svg(V.scenaKrouzku(N, S.ui.krouzek, { vrstva: S.ui.vrstva, nazev: S.nazev })), nazevSouboru('svg', 'krouzek_' + (S.ui.krouzek + 1)), 'image/svg+xml'));
  $('btnDxfKrouzek').addEventListener('click', () => stahni(V.dxf(V.scenaKrouzku(N, S.ui.krouzek, { vrstva: S.ui.vrstva, barvy: false })), nazevSouboru('dxf', 'krouzek_' + (S.ui.krouzek + 1)), 'application/dxf'));
  $('btnCsv').addEventListener('click', () => stahni('﻿' + V.csv(N), nazevSouboru('csv', 'rezny_plan'), 'text/csv;charset=utf-8'));

  /* ---------- přípravky (manifold se načte až na vyžádání) ---------- */
  function geoPripravku() {
    const K = N.krouzky[S.ui.krouzek], seg = K && K.typ === 'segmenty' ? K : N.krouzky.find((q) => q.typ === 'segmenty');
    const n = seg ? seg.n : S.nast.n, W = Math.max(...N.krouzky.filter((q) => q.typ === 'segmenty' && q.n === n).map((q) => q.W), 30);
    return STL.geometrie(n, W, S.nast);
  }
  function infoStl() {
    const g = geoPripravku();
    $('infoPripUhel').textContent = `${g.n} segmentů, pokos ${cz(g.uhel, 2)}°`;
    const o = g.klin.obrys, d = g.doraz.obrys;
    $('infoStl').innerHTML = `Klín ${cz(o[1][0] - o[0][0], 0)} × ${cz(o[2][1], 1)} × ${cz(g.klin.vyska, 0)} mm, doraz ${cz(d[1][0], 0)} × ${cz(d[2][1], 0)} × ${cz(g.doraz.vyska, 0)} mm (šikmá plocha pro lišty do ${cz(d[2][1] - 8, 0)} mm). Tisk naležato bez podpěr, PETG.`
      + (g.varovani.length ? `<br><span style="color:var(--warn)">${g.varovani.map(esc).join(' ')}</span>` : '');
  }
  let manifoldSlib = null;
  function nactiSkript(src) { return new Promise((ok, chyba) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => chyba(new Error('nejde načíst ' + src)); document.head.appendChild(el); }); }
  function nactiManifold() {
    if (manifoldSlib) return manifoldSlib;
    manifoldSlib = (async () => {
      globalThis.MANIFOLD_URL = new URL('lib/manifold/manifold.klasicky.js', location.href).href;
      if (!globalThis.ManifoldModule) await nactiSkript('lib/manifold/manifold.klasicky.js');
      let volby;
      if (location.protocol === 'file:') {
        await nactiSkript('lib/manifold/manifold.wasm.js');
        const b = atob(globalThis.MANIFOLD_WASM_B64), bin = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) bin[i] = b.charCodeAt(i);
        delete globalThis.MANIFOLD_WASM_B64; volby = { wasmBinary: bin };
      } else volby = { locateFile: (f) => new URL('lib/manifold/' + f, location.href).href };
      const w = await globalThis.ManifoldModule(volby); w.setup(); return w;
    })();
    manifoldSlib.catch(() => { manifoldSlib = null; });
    return manifoldSlib;
  }
  async function stlStahnout(btn, kus) {
    const b = $(btn), puv = b.textContent; b.disabled = true; b.textContent = 'Počítám STL…';
    try {
      await new Promise((r) => setTimeout(r, 20));
      const w = await nactiManifold(), g = geoPripravku(), m = STL.pripravky(w, g, kus);
      stahni(new Blob([STL.stlBinarni(m.poz, m.idx, `pripravek ${kus} ${g.n} seg ${g.uhel.toFixed(2)} st`)], { type: 'model/stl' }), nazevSouboru('stl', `${kus}_${g.n}seg`));
      for (const v of g.varovani) toast(v);
      toast(`STL: ${m.kusu === 2 ? 'klín a doraz' : kus === 'klin' ? 'klín' : 'doraz'}, objem ${cz(m.objem / 1000, 1)} cm³, uzavřené těleso. Úhel ${cz(g.uhel, 2)}° ověřte zkušebním kroužkem.`);
    } catch (e) { console.error(e); toast('Chyba STL: ' + e.message, true); }
    finally { b.disabled = false; b.textContent = puv; }
  }
  $('btnStlOba').addEventListener('click', () => stlStahnout('btnStlOba', 'oba'));
  $('btnStlKlin').addEventListener('click', () => stlStahnout('btnStlKlin', 'klin'));
  $('btnStlDoraz').addEventListener('click', () => stlStahnout('btnStlDoraz', 'doraz'));
  $('btnDxfPrip').addEventListener('click', () => { const g = geoPripravku(); stahni(V.dxf(V.scenaPripravku(g)), nazevSouboru('dxf', `pripravky_${g.n}seg`), 'application/dxf'); });
  $('btnPdfPrip').addEventListener('click', () => pdfStahnout('btnPdfPrip', (nazev) => V.stranyPripravku(geoPripravku(), S.nast, { nazev }), 'pripravky'));

  /* ---------- 3D (three.js se načte, až bude karta vidět) ---------- */
  let pohled3d = null, nacita3d = false, t3d = 0;
  function aktualizuj3d(hned) {
    if (!pohled3d || !N) return;
    clearTimeout(t3d);
    const proved = () => { try { pohled3d.nastav(N, { rezim: S.ui.rezim3d, rez: S.ui.rez }); $('stav3d').textContent = ''; } catch (e) { console.error(e); $('stav3d').textContent = '3D: ' + e.message; } };
    if (hned) proved(); else t3d = setTimeout(proved, 250);
  }
  function tlacitka3d() {
    $('b3dHotovy').setAttribute('aria-pressed', String(S.ui.rezim3d !== 'hruby'));
    $('b3dHruby').setAttribute('aria-pressed', String(S.ui.rezim3d === 'hruby'));
    $('b3dRez').setAttribute('aria-pressed', String(!!S.ui.rez));
  }
  function nacti3d() {
    if (pohled3d || nacita3d) return;
    nacita3d = true;
    const hotovo = () => { try { pohled3d = SEG3D.vytvor($('obal3d')); window.__seg3d = pohled3d; aktualizuj3d(true); } catch (e) { $('stav3d').textContent = '3D se nepodařilo spustit: ' + e.message; } };
    if (window.THREE) { hotovo(); return; }
    nactiSkript('lib/three.0.160.0.min.js').then(hotovo).catch((e) => { nacita3d = false; $('stav3d').textContent = 'three.js se nenačetl: ' + e.message; });
  }
  new IntersectionObserver((z) => { if (z.some((x) => x.isIntersecting)) nacti3d(); }, { rootMargin: '200px' }).observe($('obal3d'));
  $('b3dHotovy').addEventListener('click', () => { S.ui.rezim3d = 'hotovy'; tlacitka3d(); aktualizuj3d(true); uloz(); });
  $('b3dHruby').addEventListener('click', () => { S.ui.rezim3d = 'hruby'; tlacitka3d(); aktualizuj3d(true); uloz(); });
  $('b3dRez').addEventListener('click', () => { S.ui.rez = !S.ui.rez; tlacitka3d(); aktualizuj3d(true); uloz(); });
  $('b3dAnim').addEventListener('click', () => { if (!pohled3d) return; $('b3dAnim').disabled = true; pohled3d.animuj(() => { $('b3dAnim').disabled = false; }); });
  $('b3dVychozi').addEventListener('click', () => pohled3d && pohled3d.pohled(-28, 24));
  $('b3dShora').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 89));
  $('b3dBok').addEventListener('click', () => pohled3d && pohled3d.pohled(0, 2));

  /* ---------- projekty ---------- */
  const proUlozeni = () => { const o = JSON.parse(JSON.stringify(S)); delete o.ui; return o; };
  function vykresliProjekty() {
    const P = projekty(), jm = Object.keys(P).sort((a, b) => a.localeCompare(b, 'cs'));
    $('seznamProjektu').innerHTML = jm.length ? jm.map((j) => `<option value="${esc(j)}">${esc(j)}</option>`).join('') : '<option value="">– zatím nic –</option>';
  }
  $('nazevProjektu').addEventListener('input', () => { S.nazev = $('nazevProjektu').value; uloz(); });
  $('btnUlozit').addEventListener('click', async () => {
    let jm = ($('nazevProjektu').value || '').trim();
    if (!jm) { jm = await Dialog.zeptej('Název projektu', (J.PREDVOLBY[S.predvolba] || {}).nazev || 'Nádoba'); if (!jm) return; jm = jm.trim(); S.nazev = jm; $('nazevProjektu').value = jm; }
    const P = projekty();
    if (P[jm] && !(await Dialog.potvrd(`Projekt „${jm}“ už existuje. Přepsat?`))) return;
    P[jm] = proUlozeni(); if (ulozProjekty(P)) { vykresliProjekty(); $('seznamProjektu').value = jm; toast(`Uloženo: ${jm}`); }
  });
  $('btnNacist').addEventListener('click', () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!j || !P[j]) return;
    S = doplnStav(Object.assign({}, P[j], { ui: S.ui })); S.nazev = j; vybranyBod = null; naplnPole(); vykresliPredvolby(); prepocti();
  });
  $('btnSmazat').addEventListener('click', async () => {
    const j = $('seznamProjektu').value, P = projekty(); if (!j || !P[j]) return;
    if (!(await Dialog.potvrd(`Smazat projekt „${j}“?`))) return;
    delete P[j]; ulozProjekty(P); vykresliProjekty();
  });
  $('btnExport').addEventListener('click', () => stahni(JSON.stringify(Object.assign({ format: 'segmentove_soustruzeni', verze: 1 }, proUlozeni()), null, 1), nazevSouboru('json'), 'application/json'));
  $('btnImport').addEventListener('click', () => $('souborProjekt').click());
  $('souborProjekt').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const u = JSON.parse(await f.text());
      if (!u || !u.profil || !Array.isArray(u.profil.vnejsi)) throw new Error('soubor neobsahuje profil nádoby');
      J.navrh(u);   // ověření
      S = doplnStav(Object.assign({}, u, { ui: S.ui })); vybranyBod = null; naplnPole(); vykresliPredvolby(); prepocti(); toast('Projekt načten.');
    } catch (er) { toast('Import se nezdařil: ' + er.message, true); }
  });
  $('btnReset').addEventListener('click', async () => {
    if (!(await Dialog.potvrd('Vrátit všechny parametry na výchozí hodnoty? (Uložené projekty zůstanou.)'))) return;
    S = doplnStav(J.vychoziProjekt('misa')); vybranyBod = null; naplnPole(); vykresliPredvolby(); prepocti();
  });

  /* ---------- záložky a klávesy ---------- */
  $('zalozky').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-z]'); if (!b) return;
    for (const x of $('zalozky').querySelectorAll('button')) x.setAttribute('aria-selected', String(x === b));
    for (const p of document.querySelectorAll('.panel[data-p]')) p.hidden = p.dataset.p !== b.dataset.z;
  });
  document.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '') || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m && PREDVOLBY[+m[1] - 1]) { e.preventDefault(); nactiPredvolbu(PREDVOLBY[+m[1] - 1], true); return; }
    if ((e.code === 'Delete' || e.code === 'Backspace') && vybranyBod != null) { e.preventDefault(); smazBod(vybranyBod); }
  });

  $('princip').innerHTML = PR.princip();
  $('postup').innerHTML = PR.postup();
  $('bezpecnost').innerHTML = PR.bezpecnost();
  naplnPole(); vykresliPredvolby(); vykresliProjekty(); tlacitka3d(); prepocti();
  window.__seg = { get S() { return S; }, get N() { return N; }, prepocti, nactiPredvolbu };
})();
