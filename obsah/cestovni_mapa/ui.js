/* cestovni_mapa/ui.js – editor Cestovatelské mapy (DOM, myš, panely, ukládání, export).
   Jádro: CMAPA (jadro.js), kreslení: CMSTYLY (styly.js), data: CM_SVET (svet.js) + zeme/<A3>.json. */
(function () {
  'use strict';
  const C = window.CMAPA, S = window.CMSTYLY, svet = window.CM_SVET;
  const $ = id => document.getElementById(id);
  const KLIC = 'webapp_cestovni_mapa';
  const jazyk = (document.documentElement.lang || 'cs').slice(0, 2);
  const platno = $('platno'), ctx = platno.getContext('2d');

  let P = null;                 // projekt
  let idMapy = null;
  let sc = null;                // připravená scéna
  const detaily = new Map(), zkouseno = new Set();
  let rezim = 'vyber', vyber = null;          // {typ:'bod'|'usek', i}
  let nahled = null;                          // dočasná kamera při posunu/zoomu {cx,cy,m}
  let cas = 0, hraje = false;
  let historie = [], vpred = [];

  /* ---------- úložiště ---------- */
  function nactiUloziste() {
    try { return JSON.parse(localStorage.getItem(KLIC)) || { aktualni: null, mapy: {} }; }
    catch (e) { return { aktualni: null, mapy: {} }; }
  }
  let casUlozeni = null;
  function planujUlozeni() { clearTimeout(casUlozeni); casUlozeni = setTimeout(uloz, 700); }
  function uloz() {
    if (!P) return;
    const u = nactiUloziste();
    u.mapy[idMapy] = { nazev: P.nazev, zmeneno: Date.now(), projekt: P };
    u.aktualni = idMapy;
    try { localStorage.setItem(KLIC, JSON.stringify(u)); }
    catch (e) { Dialog.chyba('Mapu se nepodařilo uložit – v prohlížeči došlo místo. Stáhněte si projekt jako JSON.'); }
  }
  const noveId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- historie ---------- */
  function zaznam() {
    historie.push(JSON.stringify(P));
    if (historie.length > 80) historie.shift();
    vpred = [];
  }
  function obnov(json) { P = C.normalizuj(JSON.parse(json)); vyber = null; vsePo(); }
  function zpet() { if (!historie.length) return; vpred.push(JSON.stringify(P)); obnov(historie.pop()); }
  function znovu() { if (!vpred.length) return; historie.push(JSON.stringify(P)); obnov(vpred.pop()); }

  /** Změna projektu: druh 'mapa' (nová scéna), 'trasa' (jen trasa), 'panel' (jen uložit). */
  function zmena(fn, druh = 'mapa', bezHistorie) {
    if (!bezHistorie) zaznam();
    fn();
    if (druh !== 'panel' && !hraje) cas = P.animace.delka;
    po(druh);
  }
  function po(druh) {
    if (sc) sc.popisky = null;
    if (druh === 'mapa') obnovScenu();
    else if (druh === 'trasa' && sc) { sc.p = P; S.obnovTrasu(sc); }
    vykresliBody();
    vykresliZeme();
    planujUlozeni();
    prekresli();
  }
  function vsePo() { naplnPanely(); vykresliZeme(); obnovScenu(); vykresliBody(); planujUlozeni(); prekresli(); nactiFotkyProjektu(); }

  /* ---------- scéna a data ---------- */
  const rozmer = () => C.FORMATY[P.format];
  function obnovScenu() {
    const f = rozmer();
    sc = S.pripravScenu(P, svet, detaily, f.w, f.h, jazyk);
    for (const k of sc.chybi) {
      if (zkouseno.has(k)) continue;
      zkouseno.add(k);
      fetch('cestovni_mapa/zeme/' + k + '.json').then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { detaily.set(k, d); planujScenu(); })
        .catch(() => {});
    }
    const s0 = sc;
    S.nactiPismo(sc.s.pismo, 'fonty/').then(() => { s0.popisky = null; s0._podklad = null; prekresli(); });
    ukazStav();
  }
  let casSceny = null;
  function planujScenu() { clearTimeout(casSceny); casSceny = setTimeout(() => { obnovScenu(); prekresli(); }, 120); }

  function vsechnaMesta() {
    const m = svet.mesta.map(x => x.slice(0, 5));
    for (const d of detaily.values()) m.push(...d.mesta);
    return m;
  }

  function zemeVBode(lon, lat) {
    for (const z of svet.zeme) {
      if (!C.prekryv(z.bb, [lon - 0.01, lat - 0.01, lon + 0.01, lat + 0.01])) continue;
      const prst = z.r.map(r => C.souvisle(C.dekoduj(r, svet.q), lon));
      if (C.uvnitr(prst, lon, lat)) return z;
    }
    return null;
  }
  const zemeDle = k => svet.zeme.find(z => z.k === k);

  /* ---------- pohled ---------- */
  function naObdelnik(bb, okraj = 0.1) {
    if (!bb) return;
    const f = rozmer();
    P.pohled = C.pohledNaObdelnik(bb, f.w, f.h, okraj);
  }
  function obdelnikZemi() {
    let bb = null;
    for (const k of P.zeme) { const z = zemeDle(k); if (z) bb = C.sjednotObdelniky(bb, z.hb); }
    return bb;
  }
  function obdelnikTrasy() {
    const bb = C.obdelnikBodu(P.body);
    if (!bb) return null;
    // malá trasa → aspoň trocha okolí
    const min = 0.3;
    if (bb[2] - bb[0] < min) { bb[0] -= min / 2; bb[2] += min / 2; }
    if (bb[3] - bb[1] < min) { bb[1] -= min / 2; bb[3] += min / 2; }
    return bb;
  }

  /* ---------- vykreslování ---------- */
  let rafCeka = false;
  function prekresli() {
    if (rafCeka) return;
    rafCeka = true;
    requestAnimationFrame(() => { rafCeka = false; vykresli(); });
  }

  function velikostPlatna() {
    const sce = $('scena'), f = rozmer();
    const sw = Math.max(200, sce.clientWidth - 24), sh = Math.max(150, sce.clientHeight - 24);
    let w = sw, h = sw * f.h / f.w;
    if (h > sh) { h = sh; w = sh * f.w / f.h; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (platno.width !== W || platno.height !== H) { platno.width = W; platno.height = H; }
    platno.style.width = Math.round(w) + 'px'; platno.style.height = Math.round(h) + 'px';
  }

  const celyCas = () => cas >= P.animace.delka - 1e-6;
  function stavSnimku(t) {
    const postup = C.postupVCase(P.animace, sc.trasa.delky, t);
    const hl = S.hlava(sc, postup);
    return { postup, cas: t, kamera: C.kamera(P.animace, sc.w, sc.h, hl, t) };
  }

  /** Podklad mapy v mezipaměti (překreslí se jen při nové scéně, velikosti plátna nebo písmu).
      k = převzorkování – při přehrávání s přiblíženou kamerou ostřejší. */
  function podklad(k) {
    const W = Math.round(platno.width * k), H = Math.round(platno.height * k);
    const m = sc._podklad;
    if (m && m.W === W && m.H === H) return m.c;
    const c = (m && m.c) || document.createElement('canvas');
    c.width = W; c.height = H;
    S.vykresliPodklad(c, sc);
    sc._podklad = { W, H, c };
    return c;
  }
  const prevzorkovani = () => P.animace.kamera === 'staticka' ? 1 : Math.min(2, P.animace.priblizeni || 1);

  function vykresli() {
    if (!sc) return;
    velikostPlatna();
    let stav;
    if (hraje || !celyCas()) stav = Object.assign(stavSnimku(cas), { podklad: podklad(prevzorkovani()) });
    else stav = { postup: null, cas: null, kamera: nahled, podklad: podklad(1), editor: true };
    S.kresli(ctx, sc, stav);
    if (!hraje) kresliEditor(stav.kamera || { cx: sc.w / 2, cy: sc.h / 2, m: 1 });
    $('casText').textContent = cas.toFixed(1).replace('.', ',') + ' / ' + P.animace.delka.toFixed(1).replace('.', ',') + ' s';
    $('casovac').value = cas;
  }

  function kresliEditor(kam) {
    const m = platno.width / sc.w, k = sc.w / platno.clientWidth / kam.m;   // k: ref px na CSS px
    ctx.save();
    ctx.setTransform(m, 0, 0, m, 0, 0);
    ctx.translate(sc.w / 2, sc.h / 2); ctx.scale(kam.m, kam.m); ctx.translate(-kam.cx, -kam.cy);
    const akcent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2f7de1';
    ctx.lineWidth = 2 * k; ctx.strokeStyle = akcent; ctx.fillStyle = '#fff';
    if (vyber && vyber.typ === 'usek' && sc.trasa.useky[vyber.i]) {
      const u = sc.trasa.useky[vyber.i];
      ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 14 * k;
      ctx.beginPath(); ctx.moveTo(u.p0[0], u.p0[1]); ctx.bezierCurveTo(u.c1[0], u.c1[1], u.c2[0], u.c2[1], u.p3[0], u.p3[1]); ctx.stroke(); ctx.restore();
      ctx.setLineDash([6 * k, 4 * k]);
      ctx.beginPath(); ctx.moveTo(u.p0[0], u.p0[1]); ctx.lineTo(u.c1[0], u.c1[1]); ctx.moveTo(u.p3[0], u.p3[1]); ctx.lineTo(u.c2[0], u.c2[1]); ctx.stroke();
      ctx.setLineDash([]);
      for (const c of [u.c1, u.c2]) { ctx.beginPath(); ctx.arc(c[0], c[1], 8 * k, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
    if (vyber && vyber.typ === 'bod' && sc.trasa.body[vyber.i]) {
      const b = sc.trasa.body[vyber.i];
      ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.arc(b[0], b[1], 30, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  const bodu = n => n + (n === 1 ? ' bod' : n >= 2 && n <= 4 ? ' body' : ' bodů');
  let posledniZnacky = '';
  function znackyCasu() {
    if (!sc) return;
    const h = sc.trasa.prichody.map(t => `<option value="${t.toFixed(2)}"></option>`).join('');
    if (h !== posledniZnacky) { $('znackyCasu').innerHTML = h; posledniZnacky = h; }
  }
  function ukazStav() {
    znackyCasu();
    const t = [];
    t.push(bodu(P.body.length));
    if (sc && sc.trasa.km) t.push(C.formatKm(sc.trasa.km));
    if (sc) t.push(sc.pr.ky >= S.PRAH_DETAILU ? 'podrobná data' : 'přehledová data');
    if (sc && sc.chybi.some(k => !detaily.has(k) && zkouseno.has(k))) t.push('načítám obrysy…');
    if (rezim === 'pridat') t.push('klikněte do mapy pro nový bod');
    if (rezim === 'zeme') t.push('klikněte na zemi pro výběr');
    $('stavMapy').textContent = t.join(' · ');
  }

  /* ---------- myš ---------- */
  function refZUdalosti(e, kam) {
    const r = platno.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * sc.w, y = (e.clientY - r.top) / r.height * sc.h;
    kam = kam || nahled || { cx: sc.w / 2, cy: sc.h / 2, m: 1 };
    return { sx: x, sy: y, x: kam.cx + (x - sc.w / 2) / kam.m, y: kam.cy + (y - sc.h / 2) / kam.m };
  }
  const tolerance = (px = 12) => px * sc.w / platno.clientWidth / (nahled ? nahled.m : 1);

  function popisekObdelnik(i) {
    const b = P.body[i];
    if (!b.popisek || !b.nazev || !sc.trasa.body[i]) return null;
    return S.polohaPopisku(ctx, sc, i).obd;
  }

  function trefa(x, y, sx = x, sy = y) {
    const tol = tolerance();
    if (P.fotky.rezim !== 'skryt') for (let i = P.body.length - 1; i >= 0; i--) {
      if (!P.body[i].foto || !S.FOTKY.has(P.body[i].foto) || !sc.trasa.body[i]) continue;
      const o = S.obdelnikFotky(sc, i, nahled);        // fotka je v prostoru obrazovky
      if (sx >= o[0] && sx <= o[2] && sy >= o[1] && sy <= o[3]) return { typ: 'foto', i };
    }
    if (vyber && vyber.typ === 'usek' && sc.trasa.useky[vyber.i]) {
      const u = sc.trasa.useky[vyber.i];
      if (Math.hypot(u.c1[0] - x, u.c1[1] - y) < tol * 1.3) return { typ: 'uchyt', i: vyber.i, c: 1 };
      if (Math.hypot(u.c2[0] - x, u.c2[1] - y) < tol * 1.3) return { typ: 'uchyt', i: vyber.i, c: 2 };
    }
    for (let i = P.body.length - 1; i >= 0; i--) {
      const b = sc.trasa.body[i];
      if (Math.hypot(b[0] - x, b[1] - y) < Math.max(tol * 1.4, 22)) return { typ: 'bod', i };
    }
    for (let i = P.body.length - 1; i >= 0; i--) {
      const r = popisekObdelnik(i);
      if (r && x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return { typ: 'popisek', i };
    }
    let nej = null;
    sc.trasa.useky.forEach((u, i) => {
      const n = C.nejblizsiNaUseku(u, x, y);
      if (n.d < tol && (!nej || n.d < nej.d)) nej = { typ: 'usek', i, t: n.t, d: n.d };
    });
    return nej;
  }

  let tah = null;
  const prsty = new Map();          // dotyky pro zoom dvěma prsty
  platno.addEventListener('pointerdown', e => {
    if (!sc || e.button > 1) return;
    prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (prsty.size === 2) {         // začátek štípnutí – zruší rozdělaný tah
      if (tah && tah.zaznamenano) po('trasa');
      const [a, b] = [...prsty.values()], kam0 = nahled || { cx: sc.w / 2, cy: sc.h / 2, m: 1 };
      const stred = refZUdalosti({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }, kam0);
      tah = { typ: 'stipnuti', kam0, stred, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      platno.setPointerCapture(e.pointerId);
      return;
    }
    if (hraje) zastav();
    if (!celyCas()) { cas = P.animace.delka; prekresli(); }
    platno.focus();
    const r = refZUdalosti(e);
    platno.setPointerCapture(e.pointerId);
    if (rezim === 'pridat' && e.button === 0) {
      const g = sc.pr.zpet(r.x, r.y);
      const t = trefa(r.x, r.y);
      if (t && t.typ === 'bod') { vyber = { typ: 'bod', i: t.i }; tah = { typ: 'bod', i: t.i, start: r, zaznamenano: false }; prekresli(); vykresliBody(); return; }
      pridejBod(g.lat, g.lon);
      return;
    }
    if (rezim === 'zeme' && e.button === 0) {
      const g = sc.pr.zpet(r.x, r.y), z = zemeVBode(g.lon, g.lat);
      if (z) zmena(() => {
        const i = P.zeme.indexOf(z.k);
        if (i >= 0) P.zeme.splice(i, 1); else P.zeme.push(z.k);
      });
      return;
    }
    const t = e.button === 0 ? trefa(r.x, r.y, r.sx, r.sy) : null;
    if (t && t.typ === 'usek') { vyber = { typ: 'usek', i: t.i }; vykresliBody(); prekresli(); tah = { typ: 'nic' }; return; }
    if (t) {
      if (t.typ === 'bod' || t.typ === 'popisek') { vyber = { typ: 'bod', i: t.i }; vykresliBody(); }
      tah = Object.assign({ start: r, zaznamenano: false }, t);
      if (t.typ === 'popisek') { const pp = S.polohaPopisku(ctx, sc, t.i), bp = sc.trasa.body[t.i]; tah.dx0 = pp.lx - bp[0]; tah.dy0 = pp.ly - bp[1]; }
      if (t.typ === 'foto') { vyber = { typ: 'bod', i: t.i }; vykresliBody(); const c = S.polohaFotky(sc, t.i), bp = sc.trasa.body[t.i]; tah.dx0 = c.x - bp[0]; tah.dy0 = c.y - bp[1]; }
      prekresli();
      return;
    }
    // posun mapy
    if (vyber) { vyber = null; vykresliBody(); }
    tah = { typ: 'posun', start: r, kam0: nahled || { cx: sc.w / 2, cy: sc.h / 2, m: 1 } };
    $('scena').classList.add('tah');
  });

  platno.addEventListener('pointermove', e => {
    if (prsty.has(e.pointerId)) prsty.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tah && tah.typ === 'stipnuti') {
      if (prsty.size < 2) return;
      const [a, b] = [...prsty.values()];
      const m = Math.max(0.05, Math.min(40, tah.kam0.m * Math.hypot(a.x - b.x, a.y - b.y) / tah.d0));
      const r = platno.getBoundingClientRect();
      const sx = ((a.x + b.x) / 2 - r.left) / r.width * sc.w, sy = ((a.y + b.y) / 2 - r.top) / r.height * sc.h;
      nahled = { cx: tah.stred.x - (sx - sc.w / 2) / m, cy: tah.stred.y - (sy - sc.h / 2) / m, m };
      prekresli();
      return;
    }
    if (!tah || !sc) {
      if (sc && rezim === 'vyber' && !hraje) {
        const r = refZUdalosti(e), t = trefa(r.x, r.y, r.sx, r.sy);
        platno.style.cursor = !t ? 'grab' : t.typ === 'usek' ? 'pointer' : 'move';
      } else platno.style.cursor = '';
      return;
    }
    if (tah.typ === 'posun') {
      const r = refZUdalosti(e, tah.kam0);
      nahled = { cx: tah.kam0.cx - (r.sx - tah.start.sx) / tah.kam0.m, cy: tah.kam0.cy - (r.sy - tah.start.sy) / tah.kam0.m, m: tah.kam0.m };
      prekresli();
      return;
    }
    if (tah.typ === 'nic') return;
    const r = refZUdalosti(e);
    if (!tah.zaznamenano) {
      if (Math.hypot(r.x - tah.start.x, r.y - tah.start.y) < 3) return;
      zaznam(); tah.zaznamenano = true;
    }
    if (tah.typ === 'bod') {
      const b = P.body[tah.i], g = sc.pr.zpet(r.x, r.y);
      const dLon = g.lon - b.lon, dLat = g.lat - b.lat;
      // ruční úchyty sousedních úseků jedou s bodem
      const u1 = P.useky[tah.i], u0 = P.useky[tah.i - 1];
      if (u1 && u1.c1) { u1.c1.lon += dLon; u1.c1.lat += dLat; }
      if (u0 && u0.c2) { u0.c2.lon += dLon; u0.c2.lat += dLat; }
      b.lon = g.lon; b.lat = g.lat;
      sc.p = P; S.obnovTrasu(sc);
    } else if (tah.typ === 'uchyt') {
      const u = P.useky[tah.i], su = sc.trasa.useky[tah.i];
      if (!u.c1 || !u.c2) {               // první úprava: automatické úchyty se převezmou jako ruční
        u.c1 = sc.pr.zpet(su.c1[0], su.c1[1]); u.c2 = sc.pr.zpet(su.c2[0], su.c2[1]);
      }
      u['c' + tah.c] = sc.pr.zpet(r.x, r.y);
      if (!e.altKey) zrcadliSouseda(tah.i, tah.c, r.x, r.y);
      sc.p = P; S.obnovTrasu(sc);
    } else if (tah.typ === 'foto') {
      const b = P.body[tah.i];
      b.fx = Math.round(tah.dx0 + r.x - tah.start.x); b.fy = Math.round(tah.dy0 + r.y - tah.start.y);
      if (!b.fx && !b.fy) b.fy = 1;
    } else if (tah.typ === 'popisek') {
      const b = P.body[tah.i];
      b.dx = Math.round(tah.dx0 + r.x - tah.start.x); b.dy = Math.round(tah.dy0 + r.y - tah.start.y);
      if (!b.dx && !b.dy) b.dy = 1;
      sc.popisky = null;
    }
    prekresli();
  });

  function konecTahu() {
    if (!tah) return;
    const t = tah; tah = null;
    $('scena').classList.remove('tah');
    if (t.typ === 'posun' || t.typ === 'stipnuti') { potvrdNahled(); return; }
    if (t.zaznamenano) {
      if (t.typ === 'bod') {
        const b = P.body[t.i];
        if (b.auto) { b.nazev = jmenoMista(b.lat, b.lon, b.nazev); mistniJmeno(b); }
        if (pridejZemiBodu(b)) { po('mapa'); return; }
      }
      po('trasa');
    }
  }
  /** Plynulé napojení: úchyt sousedního úseku ve společném bodě míří opačně (délku si nechá).
      Automatický soused se nejdřív převezme jako ruční. Alt = ostrý zlom. */
  function zrcadliSouseda(i, c, x, y) {
    const n = c === 2 ? i + 1 : i - 1, su = sc.trasa.useky[n], u = P.useky[n];
    if (!su) return;
    const spoj = c === 2 ? sc.trasa.useky[i].p3 : sc.trasa.useky[i].p0;
    if (!u.c1 || !u.c2) { u.c1 = sc.pr.zpet(su.c1[0], su.c1[1]); u.c2 = sc.pr.zpet(su.c2[0], su.c2[1]); }
    const druhy = c === 2 ? su.c1 : su.c2;
    const delka = Math.hypot(druhy[0] - spoj[0], druhy[1] - spoj[1]);
    const dx = spoj[0] - x, dy = spoj[1] - y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    u[c === 2 ? 'c1' : 'c2'] = sc.pr.zpet(spoj[0] + dx / d * delka, spoj[1] + dy / d * delka);
  }

  platno.addEventListener('pointerup', e => { prsty.delete(e.pointerId); konecTahu(); });
  platno.addEventListener('pointercancel', e => { prsty.delete(e.pointerId); konecTahu(); });

  platno.addEventListener('dblclick', e => {
    if (!sc || rezim !== 'vyber') return;
    const r = refZUdalosti(e), t = trefa(r.x, r.y);
    if (t && t.typ === 'usek') {
      const g = sc.pr.zpet(r.x, r.y);
      zmena(() => C.vlozBod(P, t.i + 1, novyBod(g.lat, g.lon)), 'trasa');
      vyber = { typ: 'bod', i: t.i + 1 }; vykresliBody(); prekresli();
    }
  });

  let casZoomu = null;
  platno.addEventListener('wheel', e => {
    if (!sc) return;
    e.preventDefault();
    if (!celyCas()) cas = P.animace.delka;
    const kam = nahled || { cx: sc.w / 2, cy: sc.h / 2, m: 1 };
    const r = refZUdalosti(e, kam);
    const m = Math.max(0.05, Math.min(40, kam.m * Math.exp(-e.deltaY * 0.0015)));
    nahled = { cx: r.x - (r.sx - sc.w / 2) / m, cy: r.y - (r.sy - sc.h / 2) / m, m };
    prekresli();
    clearTimeout(casZoomu); casZoomu = setTimeout(potvrdNahled, 260);
  }, { passive: false });

  function zoomKrok(f) {
    if (!sc) return;
    if (!celyCas()) cas = P.animace.delka;
    const kam = nahled || { cx: sc.w / 2, cy: sc.h / 2, m: 1 };
    nahled = { cx: kam.cx, cy: kam.cy, m: Math.max(0.05, Math.min(40, kam.m * f)) };
    prekresli();
    clearTimeout(casZoomu); casZoomu = setTimeout(potvrdNahled, 300);
  }
  $('zoomPlus').addEventListener('click', () => zoomKrok(1.4));
  $('zoomMinus').addEventListener('click', () => zoomKrok(1 / 1.4));
  $('zoomCelek').addEventListener('click', () => PRIKAZY[P.body.length ? 'naTrasu' : 'naZeme']());

  /** Dočasnou kameru převede na nový pohled projektu (bez záznamu do historie – jen pohled). */
  function potvrdNahled() {
    if (!nahled) return;
    const g = sc.pr.zpet(nahled.cx, nahled.cy);
    P.pohled = { lon: g.lon, lat: g.lat, z: Math.max(2, Math.min(20000, P.pohled.z * nahled.m)) };
    nahled = null;
    obnovScenu(); planujUlozeni(); prekresli();
  }

  /* ---------- fotky (IndexedDB; v projektu jen id) ---------- */
  const FOTO_DB = 'webapp_cestovni_mapa_fotky';
  let fotoDb = null, fotoCil = null;
  function otevriFotoDb() {
    if (fotoDb) return fotoDb;
    fotoDb = new Promise((res, rej) => {
      const r = indexedDB.open(FOTO_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotky');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return fotoDb;
  }
  async function fotoOperace(mod, fn) {
    const d = await otevriFotoDb();
    return new Promise((res, rej) => {
      const tx = d.transaction('fotky', mod), r = fn(tx.objectStore('fotky'));
      tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error);
    });
  }
  const fotka = id => fotoOperace('readonly', st => st.get(id)).catch(() => null);
  const ulozFotkuPod = (id, blob) => fotoOperace('readwrite', st => st.put(blob, id));

  /** Zmenší fotku na nejvýš 1600 px (JPEG) – do videa stačí a úložiště nepřeteče. */
  async function zmensi(soubor) {
    const bmp = await createImageBitmap(soubor);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.88));
  }
  async function pridejFotku(i, soubor) {
    try {
      const blob = await zmensi(soubor);
      const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await ulozFotkuPod(id, blob);
      S.FOTKY.set(id, await createImageBitmap(blob));
      const stara = P.body[i].foto;
      zmena(() => { P.body[i].foto = id; }, 'trasa');
      if (stara) uklidFotku(stara);
    } catch (e) { Dialog.chyba('Fotku se nepodařilo načíst nebo uložit.'); }
  }
  async function nactiFotkyProjektu() {
    for (const b of P.body) {
      if (!b.foto || S.FOTKY.has(b.foto)) continue;
      const blob = await fotka(b.foto);
      if (blob) { S.FOTKY.set(b.foto, await createImageBitmap(blob)); prekresli(); }
    }
  }
  /** Smaže fotku, kterou už nepoužívá žádná uložená mapa. */
  async function uklidFotku(id) {
    uloz();
    const u = nactiUloziste();
    const pouzita = Object.values(u.mapy).some(m => (m.projekt.body || []).some(b => b.foto === id));
    if (!pouzita) { await fotoOperace('readwrite', st => st.delete(id)).catch(() => {}); S.FOTKY.delete(id); }
  }
  $('souborFoto').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (f && fotoCil != null && P.body[fotoCil]) pridejFotku(fotoCil, f);
  });

  /* ---------- body ---------- */
  function jmenoMista(lat, lon, zalozni) {
    const m = C.nejblizsiMesto(vsechnaMesta(), lat, lon, 15);
    return m ? m[0] : zalozni;
  }
  /** auto = jméno doplněné programem (nejbližší město) – smí se později přejmenovat podle OSM. */
  function novyBod(lat, lon, nazev, auto = !nazev) {
    return { id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nazev: nazev || jmenoMista(lat, lon, 'Bod ' + (P.body.length + 1)), auto, lat, lon, znacka: 'kruh', popisek: true, dx: 0, dy: 0, datum: '', emoji: '' };
  }
  /** Jméno místa v jazyce stránky z OSM (reverse geocoding na úrovni města). Dotazy po jednom
      s odstupem 1,1 s (pravidla Nominatimu); přepíše jen jméno, které uživatel nezměnil. */
  let frontaJmen = Promise.resolve();
  function mistniJmeno(b) {
    if (navigator.onLine === false) return;
    const lat = b.lat, lon = b.lon;
    frontaJmen = frontaJmen.then(async () => {
      try {
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=' + jazyk + '&lat=' + lat + '&lon=' + lon);
        const d = r.ok ? await r.json() : null;
        const a = (d && d.address) || {};
        const jm = a.city || a.town || a.village || a.municipality || (d && d.name);
        if (jm && b.auto && b.lat === lat && b.lon === lon && P.body.includes(b) && b.nazev !== jm) {
          b.nazev = jm;
          po('trasa');
        }
      } catch (e) { /* offline – zůstane jméno z Natural Earth */ }
      await new Promise(res => setTimeout(res, 1100));
    });
  }

  /** Přidá zemi bodu k zemím cesty (pokud je zapnuté automatické přidávání). → true = změna. */
  function pridejZemiBodu(b) {
    if (!P.autoZeme && P.zeme.length) return false;
    const z = zemeVBode(b.lon, b.lat);
    if (!z || P.zeme.includes(z.k)) return false;
    P.zeme.push(z.k);
    return true;
  }
  function doplnZemePodleTrasy() {
    let zmeneno = false;
    for (const b of P.body) { const z = zemeVBode(b.lon, b.lat); if (z && !P.zeme.includes(z.k)) { P.zeme.push(z.k); zmeneno = true; } }
    return zmeneno;
  }
  function pridejBod(lat, lon, nazev, auto) {
    const b = novyBod(lat, lon, nazev, auto);
    if (b.auto) mistniJmeno(b);
    let novaZeme = false;
    zmena(() => {
      P.body.push(b);
      P.useky = C.srovnejUseky(P.body, P.useky);
      novaZeme = pridejZemiBodu(b);
    }, 'trasa');
    if (novaZeme) obnovScenu();
    vyber = { typ: 'bod', i: P.body.length - 1 };
    vykresliBody(); prekresli();
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function vykresliBody() {
    const el = $('seznamBodu');
    if (!P.body.length) {
      el.innerHTML = '<div class="prazdno">Zatím žádné body. Zapněte <b>📍 Klikat body</b> a klikejte do mapy, nebo napište město či souřadnice do pole <i>Místa trasy</i> nahoře.</div>';
      $('soucetKm').textContent = '';
      ukazStav();
      return;
    }
    const dopr = Object.entries(C.DOPRAVA).map(([k, d]) => `<option value="${k}">${d.ikona} ${d.nazev}</option>`).join('');
    const znacky = [['kruh', '① číslo'], ['tecka', '• tečka'], ['spendlik', '📍 špendlík'], ['hvezda', '★ hvězda'], ['vlajka', '⚑ vlajka'], ['zadna', 'bez značky']];
    let h = '';
    P.body.forEach((b, i) => {
      const vyb = vyber && vyber.typ === 'bod' && vyber.i === i;
      h += `<div class="bod${vyb ? ' vybrany' : ''}" data-i="${i}">
        <div class="bod-hlava"><span class="bod-cislo">${i + 1}</span>
          <input class="vstup" data-pole="nazev" value="${esc(b.nazev)}" aria-label="Název bodu ${i + 1}">
          ${b.foto ? '<span title="Má fotku">📷</span>' : ''}
          <button class="mini" data-akce="nahoru" title="Posunout výš" ${i ? '' : 'disabled'}>↑</button>
          <button class="mini" data-akce="dolu" title="Posunout níž" ${i < P.body.length - 1 ? '' : 'disabled'}>↓</button>
          <button class="mini" data-akce="detail" title="Podrobnosti" aria-expanded="${vyb}">⋯</button>
          <button class="mini" data-akce="smaz" title="Smazat bod">✕</button></div>
        <div class="souradnice">${b.lat.toFixed(4)}, ${b.lon.toFixed(4)}</div>
        ${vyb ? `<div class="bod-detail">
          <div class="radek"><label>Datum</label><input class="vstup" data-pole="datum" value="${esc(b.datum || '')}" placeholder="12.–14. 3."></div>
          <div class="radek"><label>Značka</label><select class="vstup" data-pole="znacka">${znacky.map(([k, n]) => `<option value="${k}"${b.znacka === k ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="radek"><label>Emoji</label><input class="vstup" data-pole="emoji" value="${esc(b.emoji || '')}" placeholder="např. 🏖️ ⛩️ 🍜" maxlength="8"></div>
          <div class="radek"><label>Barva</label><input type="color" data-pole="barva" value="${b.barva || sc && sc.s.znacka || '#d83a3a'}"><button class="mini" data-akce="bezBarvy">podle stylu</button></div>
          <div class="radek"><label>Popisek</label><input type="checkbox" data-pole="popisek" ${b.popisek ? 'checked' : ''}><button class="mini" data-akce="popisekZpet">↺ poloha popisku</button></div>
          <div class="radek"><label>Souřadnice</label><input class="vstup" data-pole="souradnice" value="${b.lat.toFixed(5)}, ${b.lon.toFixed(5)}"></div>
          <div class="radek"><label>Fotka</label><button class="mini" data-akce="foto">📷 ${b.foto ? 'Změnit' : 'Přidat fotku'}</button>${b.foto ? '<button class="mini" data-akce="fotoZpet" title="Vrátit fotku nad bod">↺ poloha</button><button class="mini" data-akce="bezFoto">✕ odebrat</button>' : ''}</div>
          ${b.foto ? `<div class="radek"><label>Text fotky</label><input class="vstup" data-pole="fotoText" value="${esc(b.fotoText || '')}" placeholder="${esc(b.nazev)}"></div>` : ''}
        </div>` : ''}
      </div>`;
      if (i < P.body.length - 1) {
        const u = P.useky[i], vybU = vyber && vyber.typ === 'usek' && vyber.i === i;
        const ohyb = u.ohyb ?? C.DOPRAVA[u.doprava].ohyb;
        h += `<div class="usek${vybU ? ' vybrany' : ''}" data-u="${i}">
          <select class="vstup" data-upole="doprava" aria-label="Doprava úseku ${i + 1}">${dopr.replace(`value="${u.doprava}"`, `value="${u.doprava}" selected`)}</select>
          ${u.c1 ? `<button class="mini" data-uakce="auto" title="Zrušit ruční úpravu křivky">↺ auto</button>` : `<input type="range" min="-0.6" max="0.6" step="0.02" value="${ohyb}" data-upole="ohyb" title="Vybočení oblouku" aria-label="Vybočení oblouku">`}
          <span>${sc ? C.formatKm(sc.trasa.kmUseku[i] || 0) : ''}</span></div>`;
      }
    });
    el.innerHTML = h;
    $('soucetKm').innerHTML = sc ? `<span>Celkem (vzdušnou čarou)</span><b>${C.formatKm(sc.trasa.km)}</b>` : '';
    ukazStav();
  }

  $('seznamBodu').addEventListener('click', e => {
    const bodEl = e.target.closest('.bod'), usekEl = e.target.closest('.usek');
    const akce = e.target.closest('[data-akce]'), uakce = e.target.closest('[data-uakce]');
    if (akce && bodEl) {
      const i = +bodEl.dataset.i, a = akce.dataset.akce;
      if (a === 'smaz') { zmena(() => C.odeberBod(P, i), 'trasa'); vyber = null; vykresliBody(); return; }
      if (a === 'nahoru' || a === 'dolu') { zmena(() => C.presunBod(P, i, i + (a === 'nahoru' ? -1 : 1)), 'trasa'); return; }
      if (a === 'detail') { vyber = vyber && vyber.typ === 'bod' && vyber.i === i ? null : { typ: 'bod', i }; vykresliBody(); prekresli(); return; }
      if (a === 'bezBarvy') { zmena(() => { delete P.body[i].barva; }, 'trasa'); return; }
      if (a === 'popisekZpet') { zmena(() => { P.body[i].dx = 0; P.body[i].dy = 0; }, 'trasa'); return; }
      if (a === 'foto') { fotoCil = i; $('souborFoto').click(); return; }
      if (a === 'fotoZpet') { zmena(() => { P.body[i].fx = 0; P.body[i].fy = 0; }, 'trasa'); return; }
      if (a === 'bezFoto') { const id = P.body[i].foto; zmena(() => { delete P.body[i].foto; delete P.body[i].fx; delete P.body[i].fy; }, 'trasa'); uklidFotku(id); return; }
    }
    if (uakce && usekEl) { const i = +usekEl.dataset.u; zmena(() => { delete P.useky[i].c1; delete P.useky[i].c2; }, 'trasa'); return; }
    if (bodEl && !e.target.closest('input,select,button')) { vyber = { typ: 'bod', i: +bodEl.dataset.i }; vykresliBody(); prekresli(); }
    if (usekEl && !e.target.closest('input,select,button')) { vyber = { typ: 'usek', i: +usekEl.dataset.u }; vykresliBody(); prekresli(); }
  });
  $('seznamBodu').addEventListener('change', e => {
    const bodEl = e.target.closest('.bod'), usekEl = e.target.closest('.usek');
    if (bodEl && e.target.dataset.pole) {
      const i = +bodEl.dataset.i, pole = e.target.dataset.pole, b = P.body[i];
      if (pole === 'souradnice') {
        const g = window.PLAKAT && PLAKAT.ctiSouradnice(e.target.value);
        if (!g) { Dialog.chyba('Souřadnice nejdou přečíst. Zkuste třeba 21.0285, 105.8542'); return; }
        zmena(() => { b.lat = g.lat; b.lon = g.lon; }, 'trasa');
        return;
      }
      zmena(() => {
        if (pole === 'popisek') b.popisek = e.target.checked;
        else b[pole] = e.target.value;
        if (pole === 'nazev') b.auto = false;
      }, 'trasa');
    }
    if (usekEl && e.target.dataset.upole) {
      const i = +usekEl.dataset.u, pole = e.target.dataset.upole;
      zmena(() => {
        if (pole === 'ohyb') P.useky[i].ohyb = +e.target.value;
        else { P.useky[i].doprava = e.target.value; delete P.useky[i].ohyb; }
      }, 'trasa');
    }
  });
  // vybočení oblouku živě při tažení posuvníku
  $('seznamBodu').addEventListener('input', e => {
    const usekEl = e.target.closest('.usek');
    if (usekEl && e.target.dataset.upole === 'ohyb') {
      P.useky[+usekEl.dataset.u].ohyb = +e.target.value;
      sc.p = P; S.obnovTrasu(sc); prekresli();
    }
  });
  // změna posuvníku už prošla „input“ bez historie – záznam do historie až při změně (výše)

  /* ---------- hledání zemí ---------- */
  const nazvyZemi = svet.zeme.map(z => ({ z, nazev: S.nazevZeme(z, jazyk) })).sort((a, b) => a.nazev.localeCompare(b.nazev, jazyk));
  $('seznamZemi').innerHTML = nazvyZemi.map(n => `<option value="${esc(n.nazev)}">`).join('');
  const bezDiakritiky = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function najdiZemi(text) {
    const t = bezDiakritiky(text);
    if (!t) return null;
    return (nazvyZemi.find(n => bezDiakritiky(n.nazev) === t || bezDiakritiky(n.z.n) === t || n.z.k.toLowerCase() === t)
      || nazvyZemi.find(n => bezDiakritiky(n.nazev).startsWith(t) || bezDiakritiky(n.z.n).startsWith(t)) || {}).z || null;
  }
  /** Hledání země: bez trasy = nová cesta v této zemi, s trasou = přidá zemi k cestě. */
  function vyberZemi(z) {
    if (P.body.length) {
      if (!P.zeme.includes(z.k)) zmena(() => { P.zeme.push(z.k); naObdelnik(C.sjednotObdelniky(obdelnikZemi(), obdelnikTrasy()), 0.08); });
      Dialog.info('Země cesty: ' + P.zeme.map(k => S.nazevZeme(zemeDle(k), jazyk)).join(', '));
    } else {
      zmena(() => {
        const stary = P.zeme.length === 1 && zemeDle(P.zeme[0]);
        if (!P.titulek.text || (stary && P.titulek.text === S.nazevZeme(stary, jazyk))) P.titulek.text = S.nazevZeme(z, jazyk);
        P.zeme = [z.k]; naObdelnik(z.hb, 0.08);
      });
    }
    naplnPanely();
  }

  /* ---------- seznam zemí cesty ---------- */
  const vlajka = a2 => /^[A-Z]{2}$/.test(a2 || '') ? String.fromCodePoint(...[...a2].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳';
  function vykresliZeme() {
    const el = $('seznamZemiCesty');
    el.innerHTML = P.zeme.length
      ? P.zeme.map(k => { const z = zemeDle(k); return z ? `<span class="cip">${vlajka(z.a2)} ${esc(S.nazevZeme(z, jazyk))}<button class="mini" data-odeberZemi="${k}" title="Odebrat zemi" aria-label="Odebrat ${esc(S.nazevZeme(z, jazyk))}">✕</button></span>` : ''; }).join('')
      : '<span class="napoveda">Žádná – najděte zemi nahoře, klikněte 🌍 do mapy, nebo se doplní podle bodů.</span>';
    $('autoZeme').checked = !!P.autoZeme;
  }
  $('seznamZemiCesty').addEventListener('click', e => {
    const b = e.target.closest('[data-odeberZemi]');
    if (b) zmena(() => { P.zeme = P.zeme.filter(k => k !== b.dataset.odeberzemi); });
  });
  $('autoZeme').addEventListener('change', e => zmena(() => { P.autoZeme = e.target.checked; }, 'panel'));
  $('hledatZemi').addEventListener('change', e => { const z = najdiZemi(e.target.value); if (z) { vyberZemi(z); e.target.value = ''; e.target.blur(); } });
  $('hledatZemi').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const z = najdiZemi(e.target.value);
    if (z) { vyberZemi(z); e.target.value = ''; } else Dialog.chyba('Zemi „' + e.target.value + '“ nenacházím.');
  });

  /* ---------- hledání míst ---------- */
  const vysledky = document.createElement('div'); vysledky.className = 'vysledky'; vysledky.hidden = true;
  document.body.appendChild(vysledky);
  let nalezene = [];
  function ukazVysledky(polozky, info) {
    nalezene = polozky;
    const r = $('hledatMisto').getBoundingClientRect();
    vysledky.style.left = Math.max(6, Math.min(r.left, innerWidth - 430)) + 'px'; vysledky.style.top = (r.bottom + 4) + 'px';
    vysledky.innerHTML = polozky.map((p, i) => `<button data-i="${i}">${esc(p.nazev)} <small>${esc(p.popis || '')}</small></button>`).join('') + (info ? `<div class="info">${esc(info)}</div>` : '');
    vysledky.hidden = !polozky.length && !info;
  }
  vysledky.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const p = nalezene[+b.dataset.i];
    vysledky.hidden = true; $('hledatMisto').value = '';
    pridejBod(p.lat, p.lon, p.nazev, !!p.offline);
    if (P.body.length === 1 || !jeVPohledu(p)) { zmena(() => naObdelnik(C.sjednotObdelniky(obdelnikZemi(), obdelnikTrasy()), 0.1), 'mapa', true); }
  });
  function jeVPohledu(g) {
    const x = sc.pr.x(g.lon), y = sc.pr.y(g.lat);
    return x > 40 && x < sc.w - 40 && y > 40 && y < sc.h - 40;
  }
  function offlineMista(t) {
    const q = bezDiakritiky(t), out = [], videno = new Set();
    for (const m of vsechnaMesta()) {
      if (!bezDiakritiky(m[0]).startsWith(q)) continue;
      const k = m[0] + Math.round(m[1]) + Math.round(m[2]);
      if (videno.has(k)) continue;
      videno.add(k); out.push({ nazev: m[0], lat: m[1], lon: m[2], popis: m[1].toFixed(2) + ', ' + m[2].toFixed(2), r: m[3], offline: true });
    }
    return out.sort((a, b) => a.r - b.r).slice(0, 6);
  }
  async function hledejMisto() {
    const t = $('hledatMisto').value.trim();
    if (!t) return;
    const g = window.PLAKAT && PLAKAT.ctiSouradnice(t);
    if (g) { $('hledatMisto').value = ''; vysledky.hidden = true; pridejBod(g.lat, g.lon); return; }
    const off = offlineMista(t);
    ukazVysledky(off, 'Hledám na OpenStreetMap…');
    // přednost výsledkům v záběru (viewbox, bounded=0), ale bez omezení na země cesty –
    // jinak „Vídeň“ najde jen obec u Žďáru a ne rakouskou metropoli
    const [x0, y0, x1, y1] = sc.pr.obdelnik();
    const ramec = [Math.max(-180, x0), Math.max(-85, y0), Math.min(180, x1), Math.min(85, y1)].map(v => v.toFixed(3)).join(',');
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=' + jazyk + '&viewbox=' + ramec + '&bounded=0&q=' + encodeURIComponent(t));
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      const online = data.map(d => ({ nazev: d.name || d.display_name.split(',')[0], lat: +d.lat, lon: +d.lon, popis: d.display_name.split(',').slice(1, 3).join(',') }));
      ukazVysledky(off.concat(online), online.length || off.length ? '' : 'Nic jsem nenašel. Zkuste jiný zápis nebo souřadnice.');
    } catch (e) {
      ukazVysledky(off, 'Vyhledávání online nefunguje (offline?). Lze zadat souřadnice nebo kliknout do mapy.');
    }
  }
  $('hledatMisto').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); hledejMisto(); }
    if (e.key === 'Escape') vysledky.hidden = true;
  });
  $('hledatMisto').addEventListener('input', e => {
    const t = e.target.value.trim();
    if (t.length >= 2 && !/^[-\d]/.test(t)) ukazVysledky(offlineMista(t), 'Enter = hledat i na OpenStreetMap');
    else vysledky.hidden = true;
  });

  /* ---------- režimy, nabídky, příkazy ---------- */
  function nastavRezim(r) {
    rezim = r;
    document.querySelectorAll('[data-rezim]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.rezim === r)));
    $('scena').classList.toggle('pridat', r === 'pridat');
    $('scena').classList.toggle('zeme', r === 'zeme');
    ukazStav();
  }
  document.querySelectorAll('[data-rezim]').forEach(b => b.addEventListener('click', () => nastavRezim(rezim === b.dataset.rezim ? 'vyber' : b.dataset.rezim)));

  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const rr = b.getBoundingClientRect();
    n.style.top = (rr.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(rr.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-prikaz]');
    if (b && !b.disabled) { e.stopPropagation(); zavriNabidky(); PRIKAZY[b.dataset.prikaz](); return; }
    const v = e.target.closest('[data-vrstva]');
    if (v) { zmena(() => { P.vrstvy[v.dataset.vrstva] = !P.vrstvy[v.dataset.vrstva]; }); syncVrstvy(); return; }
    if (!e.target.closest('.nabidka')) zavriNabidky();
    if (!e.target.closest('.vysledky') && e.target !== $('hledatMisto')) vysledky.hidden = true;
  });
  addEventListener('resize', () => { zavriNabidky(); prekresli(); });

  const stahni = (blob, jmeno) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const jmenoSouboru = () => (P.nazev || 'mapa').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || 'mapa';

  const PRIKAZY = {
    async novy() {
      if (P.body.length && !await Dialog.potvrd('Začít novou mapu? Současná zůstane v „Moje mapy“.')) return;
      uloz(); idMapy = noveId(); P = C.novyProjekt(); historie = []; vpred = []; vyber = null; cas = P.animace.delka; vsePo();
    },
    mojeMapy() { ukazMojeMapy(); },
    async kopie() {
      uloz(); idMapy = noveId(); P.nazev = P.nazev + ' (kopie)'; uloz(); naplnPanely(); Dialog.info('Uloženo jako kopie.');
    },
    async prejmenuj() {
      const n = await Dialog.zeptej('Název mapy (jen pro váš seznam):', P.nazev);
      if (n) { P.nazev = n.trim(); planujUlozeni(); }
    },
    async exportJson() {
      const kopie = JSON.parse(JSON.stringify(P)), fotky = {};
      for (const b of P.body) if (b.foto && !fotky[b.foto]) {
        const blob = await fotka(b.foto);
        if (blob) fotky[b.foto] = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      }
      if (Object.keys(fotky).length) kopie._fotky = fotky;
      stahni(new Blob([JSON.stringify(kopie, null, 1)], { type: 'application/json' }), jmenoSouboru() + '.cestovni-mapa.json');
    },
    importJson() { $('souborJson').click(); },
    importGpx() { $('souborGpx').click(); },
    ukazka() { ukazka(); },
    zpet, znovu,
    naTrasu() { if (P.body.length) zmena(() => naObdelnik(obdelnikTrasy(), 0.12)); },
    naZeme() { if (P.zeme.length) zmena(() => naObdelnik(obdelnikZemi(), 0.08)); },
    obratit() { zmena(() => { P.body.reverse(); P.useky.reverse(); P.useky.forEach(u => { if (u.c1) [u.c1, u.c2] = [u.c2, u.c1]; }); }, 'trasa'); },
    autoUchyty() { zmena(() => P.useky.forEach(u => { delete u.c1; delete u.c2; delete u.ohyb; }), 'trasa'); },
    async smazatBody() { if (P.body.length && await Dialog.potvrd('Smazat všechny body trasy?')) { zmena(() => { P.body = []; P.useky = []; }, 'trasa'); vyber = null; } },
    smazatZeme() { zmena(() => { P.zeme = []; }); },
    doplnitZeme() {
      zaznam();
      if (doplnZemePodleTrasy()) po('mapa'); else { historie.pop(); Dialog.info('Všechny země trasy už jsou vybrané.'); }
    },
  };

  $('souborJson').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      for (const [id, url] of Object.entries(data._fotky || {})) {
        if (/^f[\w]+$/.test(id) && /^data:image\//.test(url)) await ulozFotkuPod(id, await (await fetch(url)).blob());
      }
      delete data._fotky;
      const p = C.normalizuj(data);
      uloz(); idMapy = noveId(); P = p; historie = []; vpred = []; vyber = null; cas = P.animace.delka; vsePo();
    } catch (err) { Dialog.chyba('Soubor není projekt Cestovatelské mapy.'); }
  });
  $('souborGpx').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const xml = new DOMParser().parseFromString(await f.text(), 'application/xml');
    let body = [...xml.getElementsByTagName('wpt')];
    if (!body.length) body = [...xml.getElementsByTagName('rtept')];
    let stopa = false;
    if (!body.length) { body = [...xml.getElementsByTagName('trkpt')]; stopa = true; }
    if (!body.length) { Dialog.chyba('V GPX nejsou žádné body.'); return; }
    let pts = body.map(b => ({ lat: +b.getAttribute('lat'), lon: +b.getAttribute('lon'), nazev: (b.getElementsByTagName('name')[0] || {}).textContent || '' })).filter(b => isFinite(b.lat) && isFinite(b.lon));
    if (stopa && pts.length > 12) {            // ze stopy jen rovnoměrně vybrané body
      const n = 12; pts = Array.from({ length: n }, (_, i) => pts[Math.round(i * (pts.length - 1) / (n - 1))]);
    }
    zmena(() => {
      for (const p of pts.slice(0, 60)) P.body.push(novyBod(p.lat, p.lon, p.nazev.trim() || null));
      P.useky = C.srovnejUseky(P.body, P.useky);
      if (P.autoZeme) doplnZemePodleTrasy();
      naObdelnik(obdelnikTrasy(), 0.12);
    });
    Dialog.info('Načteno bodů: ' + Math.min(60, pts.length));
  });

  function ukazMojeMapy() {
    uloz();
    const u = nactiUloziste(), el = $('seznamMap');
    const mapy = Object.entries(u.mapy).sort((a, b) => b[1].zmeneno - a[1].zmeneno);
    el.innerHTML = mapy.map(([id, m]) => `<div class="radek"><button class="tl" style="flex:1" data-otevri="${id}"${id === idMapy ? ' aria-pressed="true"' : ''}><span>${esc(m.nazev || 'Bez názvu')}</span><small>${new Date(m.zmeneno).toLocaleDateString(jazyk)} · ${bodu((m.projekt.body || []).length)}</small></button><button class="mini" data-smaz="${id}" title="Smazat">🗑</button></div>`).join('') || '<p class="napoveda">Zatím nic uloženého.</p>';
    $('oknoMapy').showModal();
  }
  $('seznamMap').addEventListener('click', async e => {
    const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smaz]');
    const u = nactiUloziste();
    if (o) {
      idMapy = o.dataset.otevri; P = C.normalizuj(u.mapy[idMapy].projekt); historie = []; vpred = []; vyber = null; cas = P.animace.delka;
      $('oknoMapy').close(); vsePo();
    }
    if (s) {
      if (!await Dialog.potvrd(`Smazat mapu „${u.mapy[s.dataset.smaz].nazev || ''}“?`)) return;
      delete u.mapy[s.dataset.smaz];
      try { localStorage.setItem(KLIC, JSON.stringify(u)); } catch (err) { /* nic */ }
      if (s.dataset.smaz === idMapy) { idMapy = noveId(); }
      ukazMojeMapy();
    }
  });
  document.querySelectorAll('dialog [data-zavrit]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $('tlPomoc').addEventListener('click', () => $('oknoPomoc').showModal());

  /* ---------- panely ---------- */
  document.querySelectorAll('[data-karta]').forEach(b => b.addEventListener('click', () => ukazKartu(b.dataset.karta)));
  function ukazKartu(k) {
    document.querySelectorAll('[data-karta]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.karta === k)));
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== k; });
    if (k === 'vzhled') kartickyStylu();
  }
  $('tlExport').addEventListener('click', () => ukazKartu('export'));

  function syncVrstvy() {
    document.querySelectorAll('[data-vrstva]').forEach(b => b.setAttribute('aria-pressed', String(!!P.vrstvy[b.dataset.vrstva])));
  }

  /** Posuvník s výstupem: čte/zapisuje přes get/set, druh překreslení. */
  function posuvnik(id, get, set, druh = 'mapa', format = v => v) {
    const el = $(id), out = el.parentElement.querySelector('output');
    el.value = get();
    if (out) out.textContent = format(+el.value);
    el.oninput = () => { set(+el.value); if (out) out.textContent = format(+el.value); po(druh === 'mapa' ? 'nahled' : druh); if (druh === 'mapa') planujScenu(); };
    el.onpointerdown = el.onkeydown = () => zaznam();
  }
  const nasobek = v => '×' + v.toFixed(2).replace('.', ',');
  const sekundy = v => v.toFixed(v % 1 ? 2 : 0).replace('.', ',') + ' s';

  function naplnPanely() {
    $('selStyl').innerHTML = Object.entries(S.STYLY).map(([k, s]) => `<option value="${k}"${k === P.styl ? ' selected' : ''}>${s.nazev}</option>`).join('');
    $('selFormat').innerHTML = Object.entries(C.FORMATY).map(([k, f]) => `<option value="${k}"${k === P.format ? ' selected' : ''}>${f.nazev}</option>`).join('');
    syncVrstvy();
    $('trStyl').value = P.trasa.styl;
    posuvnik('trNapeti', () => P.trasa.napeti, v => { P.trasa.napeti = v; }, 'trasa', v => Math.round(v * 100) + ' %');
    $('trNapetiO').textContent = Math.round(P.trasa.napeti * 100) + ' %';
    upravyStylu();
    $('tiText').value = P.titulek.text; $('tiPod').value = P.titulek.podtitul; $('tiPoloha').value = P.titulek.poloha;
    posuvnik('velTitulek', () => P.velikostTitulku || 1, v => { P.velikostTitulku = v; }, 'panel', nasobek);
    posuvnik('velPopisky', () => P.velikostPopisku || 1, v => { P.velikostPopisku = v; }, 'panel', nasobek);
    posuvnik('velVozidlo', () => P.velikostVozidla || 1, v => { P.velikostVozidla = v; }, 'panel', nasobek);
    posuvnik('sirTrasy', () => P.trasa.sirka, v => { P.trasa.sirka = v; }, 'mapa', nasobek);
    posuvnik('pocetMest', () => P.pocetMest, v => { P.pocetMest = v; }, 'mapa');
    const A = P.animace;
    posuvnik('anDelka', () => A.delka, v => { A.delka = v; $('casovac').max = v; cas = Math.min(cas, v); S.obnovTrasu(sc); }, 'panel', sekundy);
    posuvnik('anZac', () => A.drzetZacatek, v => { A.drzetZacatek = v; S.obnovTrasu(sc); }, 'panel', sekundy);
    posuvnik('anKon', () => A.drzetKonec, v => { A.drzetKonec = v; S.obnovTrasu(sc); }, 'panel', sekundy);
    posuvnik('anPauza', () => A.pauza, v => { A.pauza = v; S.obnovTrasu(sc); }, 'panel', v => Math.round(v * 100) + ' %');
    posuvnik('anPribl', () => A.priblizeni, v => { A.priblizeni = v; }, 'panel', nasobek);
    posuvnik('foDoba', () => P.fotky.doba, v => { P.fotky.doba = v; }, 'panel', sekundy);
    posuvnik('foVel', () => P.fotky.velikost, v => { P.fotky.velikost = v; }, 'panel', nasobek);
    $('foRezim').value = P.fotky.rezim; $('trSipky').checked = !!P.trasa.sipky;
    $('anTempo').value = A.tempo; $('anPrubeh').value = A.prubeh; $('anKamera').value = A.kamera; $('anIkona').checked = A.ikona;
    $('casovac').max = A.delka;
  }

  const POPISY_UPRAV = { papir: 'Papír / pozadí', more: 'Moře', zeme: 'Okolní země', fokus: 'Země cesty', pobrezi: 'Obrysy', trasa: 'Trasa', znacka: 'Značky bodů', text: 'Písmo – barva' };
  function upravyStylu() {
    const s = S.stylProjektu(P);
    let h = '';
    for (const [k, n] of Object.entries(POPISY_UPRAV)) h += `<div class="radek"><label>${n}</label><input type="color" data-uprava="${k}" value="${s[k]}"></div>`;
    h += `<div class="radek"><label for="upPismo">Písmo</label><select id="upPismo" class="vstup" data-uprava="pismo">${Object.entries(S.PISMA).map(([k, p]) => `<option value="${k}"${k === s.pismo ? ' selected' : ''}>${p.nazev}</option>`).join('')}</select></div>`;
    h += `<div class="radek"><label for="upChveni">Chvění ruky</label><input type="range" id="upChveni" min="0" max="10" step="0.5" value="${s.chveni}" data-uprava="chveni"><output>${s.chveni}</output></div>`;
    $('upravyStylu').innerHTML = h;
  }
  $('upravyStylu').addEventListener('input', e => {
    const k = e.target.dataset.uprava; if (!k) return;
    P.upravy[k] = e.target.type === 'range' ? +e.target.value : e.target.value;
    const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = e.target.value;
    planujScenu(); planujUlozeni();
  });
  $('upravyStylu').addEventListener('pointerdown', () => zaznam());
  $('tlResetStyl').addEventListener('click', () => { zmena(() => { P.upravy = {}; }); upravyStylu(); });

  function kartickyStylu() {
    const el = $('karticky');
    el.innerHTML = Object.entries(S.STYLY).map(([k, s]) => `<button class="styl-karta" data-styl="${k}" aria-pressed="${k === P.styl}" title="${esc(s.popis)}"><canvas width="320" height="180"></canvas><span>${s.nazev}</span></button>`).join('');
    // náhledy postupně, ať se panel neseká
    const karty = [...el.querySelectorAll('.styl-karta')];
    let i = 0;
    const dalsi = () => {
      if (i >= karty.length || el.hidden) return;
      const k = karty[i++], cv = k.querySelector('canvas');
      const kopie = Object.assign({}, P, { styl: k.dataset.styl, upravy: {}, format: '16:9', vrstvy: Object.assign({}, P.vrstvy, { titulek: false, legenda: false, kompas: false, meritko: false }) });
      const s2 = S.pripravScenu(kopie, svet, detaily, 1920, 1080, jazyk);
      S.nactiPismo(s2.s.pismo, 'fonty/').then(() => { S.kresli(cv.getContext('2d'), s2, { bezPopisu: true }); });
      setTimeout(dalsi, 30);
    };
    dalsi();
  }
  $('karticky').addEventListener('click', e => {
    const k = e.target.closest('[data-styl]'); if (!k) return;
    zmena(() => { P.styl = k.dataset.styl; P.upravy = {}; });
    $('selStyl').value = P.styl;
    $('karticky').querySelectorAll('[data-styl]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.styl === P.styl)));
    upravyStylu();
  });
  $('selStyl').addEventListener('change', e => { zmena(() => { P.styl = e.target.value; P.upravy = {}; }); upravyStylu(); kartickyStylu(); });
  $('selFormat').addEventListener('change', e => {
    zmena(() => {
      const stary = rozmer(); P.format = e.target.value;
      const novy = rozmer();
      // zachová obsah: přiblížení podle užší strany
      P.pohled.z *= Math.min(novy.w / stary.w, novy.h / stary.h);
    });
  });
  $('foRezim').addEventListener('change', e => zmena(() => { P.fotky.rezim = e.target.value; }, 'panel'));
  $('trSipky').addEventListener('change', e => zmena(() => { P.trasa.sipky = e.target.checked; }, 'panel'));
  $('trStyl').addEventListener('change', e => zmena(() => { P.trasa.styl = e.target.value; }, 'trasa'));
  for (const [id, k] of [['tiText', 'text'], ['tiPod', 'podtitul']]) {
    $(id).addEventListener('focus', () => zaznam());
    $(id).addEventListener('input', e => { P.titulek[k] = e.target.value; planujUlozeni(); prekresli(); });
  }
  $('tiPoloha').addEventListener('change', e => zmena(() => { P.titulek.poloha = e.target.value; }, 'panel'));
  for (const [id, k] of [['anTempo', 'tempo'], ['anPrubeh', 'prubeh'], ['anKamera', 'kamera']]) {
    $(id).addEventListener('change', e => zmena(() => { P.animace[k] = e.target.value; S.obnovTrasu(sc); }, 'panel'));
  }
  $('anIkona').addEventListener('change', e => zmena(() => { P.animace.ikona = e.target.checked; }, 'panel'));

  /* ---------- přehrávání ---------- */
  let posledni = 0;
  function krok(ts) {
    if (!hraje) return;
    const dt = Math.min(0.1, (ts - posledni) / 1000); posledni = ts;
    cas = Math.min(P.animace.delka, cas + dt);
    vykresli();
    if (cas >= P.animace.delka) { zastav(); return; }
    requestAnimationFrame(krok);
  }
  function prehraj() {
    if (!sc || P.body.length < 2) { Dialog.info('Na animaci jsou potřeba aspoň dva body trasy.'); return; }
    if (celyCas()) cas = 0;
    hraje = true; nahled = null; $('tlPrehrat').textContent = '⏸';
    posledni = performance.now(); requestAnimationFrame(krok);
  }
  function zastav() { hraje = false; $('tlPrehrat').textContent = '▶'; prekresli(); }
  $('tlPrehrat').addEventListener('click', () => hraje ? zastav() : prehraj());
  $('tlCelek').addEventListener('click', () => { zastav(); cas = P.animace.delka; prekresli(); });
  $('casovac').addEventListener('input', e => { if (hraje) zastav(); cas = +e.target.value; nahled = null; prekresli(); });

  /* ---------- klávesy ---------- */
  document.addEventListener('keydown', e => {
    if ((e.target.closest && e.target.closest('input,select,textarea')) || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? znovu() : zpet(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); znovu(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === ' ') { e.preventDefault(); hraje ? zastav() : prehraj(); }
    else if (k === 'v') nastavRezim('vyber');
    else if (k === 'p') nastavRezim('pridat');
    else if (k === 'z') nastavRezim('zeme');
    else if (k === 'escape') { vyber = null; nastavRezim('vyber'); zavriNabidky(); vykresliBody(); prekresli(); }
    else if ((k === 'delete' || k === 'backspace') && vyber && vyber.typ === 'bod') { const i = vyber.i; vyber = null; zmena(() => C.odeberBod(P, i), 'trasa'); }
    else if (k === 'f1') { e.preventDefault(); $('oknoPomoc').showModal(); }
  });

  /* ---------- export ---------- */
  function platnoExportu() {
    const f = rozmer(), W = +$('exRozliseni').value;
    let H = Math.round(W * f.h / f.w);
    const c = document.createElement('canvas');
    c.width = W + (W % 2); c.height = H + (H % 2);
    return c;
  }
  async function ulozPng(vCase) {
    if (!sc) return;
    await S.nactiPismo(sc.s.pismo, 'fonty/');
    const c = platnoExportu(), g = c.getContext('2d');
    const stav = vCase && !celyCas() ? stavSnimku(cas) : { postup: null };
    stav.pruhledne = $('exPruhledne').checked;
    S.kresli(g, sc, stav);
    c.toBlob(b => stahni(b, jmenoSouboru() + (vCase ? '_' + cas.toFixed(1) + 's' : '') + '.png'), 'image/png');
  }
  $('tlPng').addEventListener('click', () => ulozPng(false));
  $('tlPngCas').addEventListener('click', () => ulozPng(true));

  let zruseno = false, hotoveVideo = null;
  $('tlUlozVideo').addEventListener('click', () => { if (hotoveVideo) stahni(hotoveVideo.blob, hotoveVideo.jmeno); });
  $('tlZrusit').addEventListener('click', () => { zruseno = true; });
  $('tlVideo').addEventListener('click', async () => {
    const MB = window.Mediabunny;
    if (!MB) { Dialog.chyba('Knihovna pro video se nenačetla.'); return; }
    if (!sc || P.body.length < 2) { Dialog.info('Na video jsou potřeba aspoň dva body trasy.'); return; }
    zastav();
    await S.nactiPismo(sc.s.pismo, 'fonty/');
    // počkat na detailní obrysy, ať video nemá hrubé pobřeží
    for (let i = 0; i < 40 && sc.chybi.length; i++) await new Promise(r => setTimeout(r, 100));
    const c = platnoExportu(), g = c.getContext('2d');
    const pruhledne = $('exPruhledne').checked;
    const mp4 = $('exKontejner').value === 'mp4' && !pruhledne, fps = +$('exFps').value;
    if (pruhledne && $('exKontejner').value === 'mp4') Dialog.info('MP4 neumí průhlednost – video se uloží jako WebM s alfa kanálem.');
    const kodek = await MB.getFirstEncodableVideoCodec(mp4 ? ['avc', 'hevc', 'vp9', 'av1'] : ['vp9', 'vp8', 'av1'], { width: c.width, height: c.height });
    if (!kodek) { Dialog.chyba('Prohlížeč neumí video v tomto formátu a rozlišení zakódovat. Zkuste nižší rozlišení nebo druhý formát.'); return; }
    const vystup = new MB.Output({ format: mp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const zdroj = new MB.CanvasSource(c, Object.assign({ codec: kodek, bitrate: MB['QUALITY_' + $('exKvalita').value] }, pruhledne ? { alpha: 'keep' } : {}));
    vystup.addVideoTrack(zdroj, { frameRate: fps });
    const pr = $('prubeh'), bar = pr.firstElementChild;
    pr.hidden = false; $('tlZrusit').hidden = false; $('tlVideo').disabled = true; zruseno = false;
    const N = Math.max(1, Math.round(P.animace.delka * fps));
    try {
      await vystup.start();
      for (let f = 0; f <= N; f++) {
        if (zruseno) { await vystup.cancel(); throw new Error('zrušeno'); }
        S.kresli(g, sc, Object.assign(stavSnimku(f / fps), { pruhledne }));
        await zdroj.add(f / fps, 1 / fps);
        bar.style.width = (f / N * 100).toFixed(1) + '%';
        $('exInfo').textContent = 'Snímek ' + f + ' / ' + N;
      }
      zdroj.close();
      await vystup.finalize();
      hotoveVideo = { blob: new Blob([vystup.target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), jmeno: jmenoSouboru() + '.' + (mp4 ? 'mp4' : 'webm') };
      $('tlUlozVideo').hidden = false;
      stahni(hotoveVideo.blob, hotoveVideo.jmeno);
      $('exInfo').textContent = 'Hotovo – ' + N + ' snímků, kodek ' + kodek + '.';
    } catch (err) {
      $('exInfo').textContent = zruseno ? 'Export zrušen.' : 'Export selhal: ' + err.message;
    } finally {
      pr.hidden = true; $('tlZrusit').hidden = true; $('tlVideo').disabled = false;
    }
  });

  /* ---------- ukázka ---------- */
  function ukazka() {
    const body = [
      ['Hanoj', 21.0285, 105.8542, '1.–3. 3.'], ['Ha Long', 20.9517, 107.0805, '4. 3.'], ['Ninh Binh', 20.2506, 105.9745, '5.–6. 3.'],
      ['Hue', 16.4637, 107.5909, '8. 3.'], ['Hoi An', 15.8801, 108.338, '9.–11. 3.'], ['Nha Trang', 12.2388, 109.1967, '13. 3.'],
      ['Ho Či Minovo Město', 10.7769, 106.7009, '15.–16. 3.'], ['Can Tho', 10.0452, 105.7469, '17. 3.'],
    ];
    const doprava = ['bus', 'lod', 'vlak', 'motorka', 'vlak', 'letadlo', 'lod'];
    uloz();
    idMapy = noveId();
    P = C.novyProjekt();
    P.nazev = 'Vietnam – ukázka';
    P.zeme = ['VNM'];
    P.body = body.map(([n, lat, lon, d], i) => ({ id: 'u' + i, nazev: n, lat, lon, datum: d, znacka: 'kruh', popisek: true, dx: 0, dy: 0, emoji: '' }));
    P.useky = doprava.map(d => ({ doprava: d }));
    P.titulek = { text: 'Vietnam', podtitul: 'Ze severu na jih · březen 2026', poloha: 'hl' };
    P.vrstvy.legenda = true;
    P.animace.kamera = 'sleduj';
    P = C.normalizuj(P);
    naObdelnik(zemeDle('VNM').hb, 0.06);
    P.pohled.lon -= 3;                        // země doprava, vlevo místo pro titulek
    historie = []; vpred = []; vyber = null; cas = P.animace.delka;
    vsePo();
  }

  /* ---------- start ---------- */
  const u = nactiUloziste();
  if (u.aktualni && u.mapy[u.aktualni]) {
    idMapy = u.aktualni; P = C.normalizuj(u.mapy[idMapy].projekt);
    cas = P.animace.delka;
    vsePo();
  } else ukazka();
  new ResizeObserver(prekresli).observe($('scena'));
  window.CMAPA_UI = { pridejFotku: (i, blob) => pridejFotku(i, blob), get projekt() { return P; }, get scena() { return sc; }, prikaz: id => PRIKAZY[id](), vyberZemi: k => vyberZemi(zemeDle(k)), pridejBod, detaily, prehraj, zastav, nastavCas: t => { cas = t; prekresli(); } };
})();
