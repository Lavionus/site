/* Zrcátko, blinkr, jeď! – svět z dlaždic (bez DOM, spustitelné v node).
   Mapa = pole řetězců, jeden znak = dlaždice T × T metrů:
     r  silnice (tvar se odvodí ze sousedů),  z  rovná silnice s přechodem (zebrou) uprostřed,
     O  kruhový objezd,  .  domy,  p  park (stromy),  ostatní  tráva.
   Silnice na okraji mapy vede „ven“ – tam auta mizí a odtud přijíždějí.
   def.krizovatky['x,y'] = { rizeni: ['hlavni','stop','hlavni','dej_prednost'] | semafor: true,
                             sipky: [ramena s doplňkovou šipkou ke krajnici], prechody: [ramena se zebrou],
                             mista: [ramena s místem pro přecházení bez zebry], bezZnacky: true (kruháč ČR bez P4) }
   Dráha vozidla dlaždicí z ramene a do ramene b: cesta(dl, a, b) – lomená čára ve světových souřadnicích. */
(function () {
  'use strict';
  const J = typeof module !== 'undefined' ? require('./jadro.js') : window.BLINKR_JADRO;

  const T = 30, POL = T / 2;
  const KR = { stopa: 7, ostrov: 4.5, vnejsi: 9.6, okraj: 10.2 };   // kruhový objezd (poloměry v m)
  const PRECHOD_D = J.OKRAJ + 1.8;   // střed přechodu na rameni křižovatky (hned za hranicí křižovatky)
  const ZA_PRECHODEM = 3.8;          // o kolik dál je stop čára na rameni s přechodem (řidič staví před přechodem)
  const SIL = J.PRUH;                // polovina šířky vozovky = šířka pruhu
  const D = J.SMERY;
  const ROAD = new Set(['r', 'z', 'O']);
  const uhelRamene = k => Math.atan2(D[k][1], D[k][0]);

  function postav(def, profil) {
    const s = profil.strana;
    const mapa = def.mapa;
    const H = mapa.length, W = Math.max(...mapa.map(r => r.length));
    const ch = (x, y) => (y >= 0 && y < H && x >= 0 && x < W ? (mapa[y][x] || ' ') : null);
    const dl = new Map();
    const klic = (x, y) => x + ',' + y;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = ch(x, y);
      if (!ROAD.has(c)) continue;
      const ramena = [], ven = [];
      for (let k = 0; k < 4; k++) {
        const n = ch(x + D[k][0], y + D[k][1]);
        if (n === null) { ramena.push(k); ven.push(k); }
        else if (ROAD.has(n)) ramena.push(k);
      }
      const t = { x, y, klic: klic(x, y), znak: c, cx: (x + 0.5) * T, cy: (y + 0.5) * T, ramena, ven };
      const opacna = ramena.length === 2 && (ramena[0] + 2) % 4 === ramena[1];
      t.typ = c === 'O' ? 'kruhac' : ramena.length >= 3 ? 'krizovatka' : opacna ? 'rovna' : ramena.length === 2 ? 'zatacka' : 'slepa';
      t.box = t.typ === 'krizovatka' || t.typ === 'kruhac';
      const ann = (def.krizovatky || {})[t.klic] || {};
      t.rizeni = [];
      for (const k of ramena) {
        if (t.typ === 'kruhac') t.rizeni[k] = 'dej_prednost';
        else if (!t.box) t.rizeni[k] = undefined;
        else if (ann.semafor) t.rizeni[k] = 'semafor';
        else t.rizeni[k] = (ann.rizeni && ann.rizeni[k]) || 'neoznacena';
      }
      t.semafor = !!ann.semafor;
      t.posun = ann.posun || 0;
      t.sipky = ann.sipky || [];
      t.bezZnacky = !!ann.bezZnacky && profil.id === 'cz';
      t.prechodyRamena = ann.prechody || [];
      t.mistaRamena = ann.mista || [];
      dl.set(t.klic, t);
    }

    const svet = { def, profil, T, W, H, dl, prechody: [], _cesty: new Map() };
    svet.dlazdice = (x, y) => dl.get(klic(x, y)) || null;
    svet.naPozici = (px, py) => svet.dlazdice(Math.floor(px / T), Math.floor(py / T));
    svet.soused = (t, k) => svet.dlazdice(t.x + D[k][0], t.y + D[k][1]);
    // Znak krajiny v bodě (m); mimo mapu def.okoli. Moře ('~') je pro auta neprůjezdné.
    svet.znak = (px, py) => {
      const x = Math.floor(px / T), y = Math.floor(py / T);
      if (x < 0 || y < 0 || x >= W || y >= H) return def.okoli || ' ';
      return mapa[y][x] || ' ';
    };

    // Přechody: zebra uprostřed rovné dlaždice 'z', zebry a místa pro přecházení na ramenech křižovatek.
    for (const t of dl.values()) {
      const pridej = (rameno, typ, cx, cy, napric) => {
        const dlouhy = SIL + 1.6;
        svet.prechody.push({
          id: svet.prechody.length, tile: t, rameno, typ,
          stred: [cx, cy], smer: napric,
          a: [cx - napric[0] * dlouhy, cy - napric[1] * dlouhy],
          b: [cx + napric[0] * dlouhy, cy + napric[1] * dlouhy],
        });
      };
      if (t.znak === 'z' && t.typ === 'rovna') {
        const k = t.ramena[0];
        pridej(null, 'zebra', t.cx, t.cy, J.SMERY[(k + 1) % 4].map(Math.abs));
      }
      for (const k of t.prechodyRamena) pridej(k, 'zebra', t.cx + D[k][0] * PRECHOD_D, t.cy + D[k][1] * PRECHOD_D, D[(k + 1) % 4].map(Math.abs));
      for (const k of t.mistaRamena) pridej(k, 'misto', t.cx + D[k][0] * PRECHOD_D, t.cy + D[k][1] * PRECHOD_D, D[(k + 1) % 4].map(Math.abs));
    }

    svet.cesta = (t, a, b) => {
      const k = t.klic + ':' + a + ':' + b;
      let c = svet._cesty.get(k);
      if (!c) { c = spocitejCestu(svet, t, a, b); svet._cesty.set(k, c); }
      return c;
    };

    // Semafor: barva pro rameno v čase t; doplňková šipka svítí, když má rameno červenou a příčný směr zelenou.
    svet.barva = (t, k, cas) => J.barvaSemaforu(cas + t.posun, k % 2);
    svet.sipkaSviti = (t, k, cas) => t.sipky.includes(k) && svet.barva(t, k, cas) === 'cervena' && svet.barva(t, (k + 1) % 4, cas) === 'zelena';
    svet.keKrajnici = (a, b) => J.manevr(a, b) === (s > 0 ? 'vpravo' : 'vlevo');

    return svet;
  }

  /* ---------- dráhy ---------- */

  function bod(t, p) { return [t.cx + p[0], t.cy + p[1]]; }

  function spocitejCestu(svet, t, a, b) {
    const s = svet.profil.strana;
    let lok;
    if (t.typ === 'kruhac') lok = cestaKruhac(s, a, b);
    else if (a === b) lok = cestaOtoceni(s, a);
    else lok = [J.bodPruhu(s, a, POL, true), ...J.draha(s, a, b), J.bodPruhu(s, b, POL, false)];
    const body = lok.map(p => bod(t, p));
    const kumul = [0];
    for (let i = 1; i < body.length; i++) kumul.push(kumul[i - 1] + Math.hypot(body[i][0] - body[i - 1][0], body[i][1] - body[i - 1][1]));
    const c = { tile: t, a, b, body, kumul, delka: kumul[kumul.length - 1] };
    // Hranice křižovatky (box) na dráze: první a poslední bod blíž středu než okraj.
    const okraj = t.typ === 'kruhac' ? KR.okraj : J.OKRAJ + 0.01;
    if (t.box) {
      const r = p => Math.hypot(p[0] - t.cx, p[1] - t.cy);
      c.sVstup = presnyPrechodOkraje(c, okraj, r, true);
      c.sVystup = presnyPrechodOkraje(c, okraj, r, false);
      const sPrechodem = t.prechodyRamena.includes(a) || t.mistaRamena.includes(a);
      c.sCara = c.sVstup - 0.6 - (sPrechodem && t.typ !== 'kruhac' ? ZA_PRECHODEM : 0);
    }
    // Kruháč: kde vozidlo mine výjezd před tím svým (od té chvíle blinkr „při vyjíždění“).
    if (t.typ === 'kruhac') {
      const smer = s > 0 ? -1 : 1;
      const krok = J.kruhacPoHodinach(svet.profil) ? 1 : -1;
      const pred = (b - krok + 4) % 4;
      const fIn = uhelRamene(a) + smer * 0.45;
      let delta = pred === a ? 0 : ((uhelRamene(pred) - fIn) * smer) % (2 * Math.PI);
      if (delta < 0) delta += 2 * Math.PI;
      c.sPredVyjezdem = pred === a ? c.sVstup : c.kumul[2] + delta * KR.stopa;
    }
    // Přechody na dráze (průsečík dráhy s přechodem).
    c.prechody = [];
    for (const p of svet.prechody) {
      if (p.tile !== t) continue;
      for (let i = 1; i < body.length; i++) {
        const x = prusecik(body[i - 1], body[i], p.a, p.b);
        if (x) { c.prechody.push({ p, s: c.kumul[i - 1] + x.t * (c.kumul[i] - c.kumul[i - 1]), bod: x.bod }); break; }
      }
    }
    return c;
  }

  // s, kde dráha protne kružnici okraje (vstup = první, výstup = poslední).
  function presnyPrechodOkraje(c, okraj, r, vstup) {
    const n = c.body.length;
    if (vstup) {
      for (let i = 1; i < n; i++) if (r(c.body[i]) < okraj && r(c.body[i - 1]) >= okraj)
        return interpol(c, i, okraj, r);
      return 0;
    }
    for (let i = n - 1; i > 0; i--) if (r(c.body[i - 1]) < okraj && r(c.body[i]) >= okraj)
      return interpol(c, i, okraj, r);
    return c.delka;
  }
  function interpol(c, i, okraj, r) {
    const r0 = r(c.body[i - 1]), r1 = r(c.body[i]);
    const t = (okraj - r0) / (r1 - r0);
    return c.kumul[i - 1] + t * (c.kumul[i] - c.kumul[i - 1]);
  }

  function prusecik(p1, p2, p3, p4) {
    const d1 = [p2[0] - p1[0], p2[1] - p1[1]], d2 = [p4[0] - p3[0], p4[1] - p3[1]];
    const det = d1[0] * d2[1] - d1[1] * d2[0];
    if (Math.abs(det) < 1e-9) return null;
    const t = ((p3[0] - p1[0]) * d2[1] - (p3[1] - p1[1]) * d2[0]) / det;
    const u = ((p3[0] - p1[0]) * d1[1] - (p3[1] - p1[1]) * d1[0]) / det;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, bod: [p1[0] + d1[0] * t, p1[1] + d1[1] * t] };
  }

  function cestaKruhac(s, a, b) {
    const smer = s > 0 ? -1 : 1;            // ČR proti hodinám (úhel klesá), UK po hodinách
    const odklon = 0.45;                     // úhel napojení vjezdu/výjezdu od osy ramene
    const fIn = uhelRamene(a) + smer * odklon;
    const fOut = uhelRamene(b) - smer * odklon;
    let sweep = ((fOut - fIn) * smer) % (2 * Math.PI);
    if (sweep < 0.3) sweep += 2 * Math.PI;
    const body = [J.bodPruhu(s, a, POL, true), J.bodPruhu(s, a, KR.vnejsi + 2.6, true)];
    const n = Math.max(6, Math.ceil(sweep / 0.15));
    for (let i = 0; i <= n; i++) {
      const f = fIn + smer * sweep * i / n;
      body.push([Math.cos(f) * KR.stopa, Math.sin(f) * KR.stopa]);
    }
    body.push(J.bodPruhu(s, b, KR.vnejsi + 2.6, false), J.bodPruhu(s, b, POL, false));
    return body;
  }

  // Otočení na slepém konci (kruhová smyčka) – jen pro jistotu, mapy slepé konce nemají.
  function cestaOtoceni(s, a) {
    const body = [J.bodPruhu(s, a, POL, true)];
    const ven = D[a], p = [-ven[1], ven[0]];
    for (let i = 0; i <= 12; i++) {
      const f = Math.PI * i / 12;
      const o = s * SIL / 2 * Math.cos(f);
      body.push([ven[0] * (2 + 3 * Math.sin(f)) - p[0] * o, ven[1] * (2 + 3 * Math.sin(f)) - p[1] * o]);
    }
    body.push(J.bodPruhu(s, a, POL, false));
    return body;
  }

  // Poloha a natočení na dráze ve vzdálenosti sx od začátku.
  function polohaNa(c, sx) {
    const s = Math.max(0, Math.min(c.delka, sx));
    let i = 1;
    while (i < c.kumul.length - 1 && c.kumul[i] < s) i++;
    const a = c.body[i - 1], b = c.body[i];
    const u = (s - c.kumul[i - 1]) / ((c.kumul[i] - c.kumul[i - 1]) || 1);
    return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, uhel: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }

  // Nejbližší bod dráhy k (x, y): { s, vzd }.
  function promitni(c, x, y) {
    let nej = { s: 0, vzd: Infinity };
    for (let i = 1; i < c.body.length; i++) {
      const a = c.body[i - 1], b = c.body[i];
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
      const px = a[0] + dx * u, py = a[1] + dy * u;
      const v = Math.hypot(x - px, y - py);
      if (v < nej.vzd) nej = { s: c.kumul[i - 1] + u * (c.kumul[i] - c.kumul[i - 1]), vzd: v };
    }
    return nej;
  }

  // Je bod na vozovce? (dlaždice silnice, rameno ± šířka, box křižovatky, mezikruží objezdu)
  function naSilnici(svet, x, y) {
    const t = svet.naPozici(x, y);
    if (!t) return false;
    const lx = x - t.cx, ly = y - t.cy;
    const w = SIL + 0.6;
    if (t.typ === 'kruhac') {
      const r = Math.hypot(lx, ly);
      if (r <= KR.vnejsi + 0.6) return r >= KR.ostrov - 0.3;
    }
    if (t.typ === 'krizovatka' && Math.abs(lx) < J.OKRAJ + 1 && Math.abs(ly) < J.OKRAJ + 1) return true;
    for (const k of t.ramena) {
      const [dx, dy] = D[k];
      const pod = lx * dx + ly * dy, bok = Math.abs(lx * dy - ly * dx);
      if (pod >= -w && bok <= w) return true;
    }
    // Vnitřní roh zatáčky (oblouk dráhy ho trochu zkracuje).
    if (t.typ === 'zatacka') {
      const [k1, k2] = t.ramena;
      const rx = (D[k1][0] + D[k2][0]) * (w + 3), ry = (D[k1][1] + D[k2][1]) * (w + 3);
      if (Math.hypot(lx - rx * 0.5, ly - ry * 0.5) < w + 1.5) return true;
    }
    return false;
  }

  // Navigace: nejkratší cesta po dlaždicích (BFS). Vrátí rameno, kterým opustit dlaždici t, aby se dojelo do cíle.
  function navigace(svet, odkud, vjezd, cil) {
    if (!odkud || !cil) return null;
    if (odkud === cil) return null;
    const pred = new Map([[odkud.klic, null]]);
    const fronta = [odkud];
    while (fronta.length) {
      const t = fronta.shift();
      if (t === cil) break;
      for (const k of t.ramena) {
        if (t === odkud && k === vjezd && t.ramena.length > 1) continue;   // neotáčet se
        const n = svet.soused(t, k);
        if (!n || pred.has(n.klic)) continue;
        pred.set(n.klic, { t, k });
        fronta.push(n);
      }
    }
    if (!pred.has(cil.klic)) return null;
    let x = cil.klic, krok = null;
    while (pred.get(x)) { krok = pred.get(x); x = krok.t.klic; }
    return krok ? krok.k : null;
  }

  // Trasa k cíli pro celou síť naráz: BFS od cíle → pro každou dlaždici rameno, kterým z ní vyjet (Map klíč → rameno).
  function trasaDo(svet, cil) {
    const dist = new Map([[cil.klic, 0]]), fronta = [cil], vyjezd = new Map();
    while (fronta.length) {
      const t = fronta.shift();
      for (const k of t.ramena) {
        const n = svet.soused(t, k);
        if (!n || dist.has(n.klic)) continue;
        dist.set(n.klic, dist.get(t.klic) + 1);
        vyjezd.set(n.klic, (k + 2) % 4);          // z n se k cíli jede zpět ramenem proti k
        fronta.push(n);
      }
    }
    return { vyjezd, dist };
  }

  const API = { T, POL, KR, PRECHOD_D, ZA_PRECHODEM, postav, polohaNa, promitni, naSilnici, navigace, trasaDo, uhelRamene };
  if (typeof module !== 'undefined') module.exports = API;
  else window.BLINKR_SVET = API;
})();
