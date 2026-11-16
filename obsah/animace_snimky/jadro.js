/* ============================================================
   animace_snimky/jadro.js – jádro stránky „Animace snímek po snímku“ (bez DOM).
   Časová osa (držení snímků, FPS, smyčka / ping-pong / jednou), výběr snímků
   pro cibulovou slupku, rozložení sprite sheetu + JSON, výplň plochy,
   šířka tahu podle tlaku, historie Zpět/Znovu, normalizace projektu.
   V prohlížeči window.ANIMSN, v node module.exports.
   ============================================================ */
(function (koren) {
  'use strict';

  const VERZE = 1;
  const REZIMY = ['smycka', 'pingpong', 'jednou'];
  const omez = (v, od, do_, vychozi) => { v = Number(v); return isFinite(v) ? Math.min(do_, Math.max(od, v)) : vychozi; };
  const cele = (v, od, do_, vychozi) => Math.round(omez(v, od, do_, vychozi));

  // ---------- projekt ----------
  function normProjekt(p) {
    p = p && typeof p === 'object' ? p : {};
    const n = {
      verze: VERZE,
      nazev: String(p.nazev || 'Animace').slice(0, 80),
      sirka: cele(p.sirka, 16, 4096, 960),
      vyska: cele(p.vyska, 16, 4096, 540),
      fps: cele(p.fps, 1, 60, 12),
      rezim: REZIMY.includes(p.rezim) ? p.rezim : 'smycka',
      barvaPozadi: /^#[0-9a-f]{6}$/i.test(p.barvaPozadi) ? p.barvaPozadi : '#ffffff',
      pruhledne: !!p.pruhledne,
      pozadiSdilene: !!p.pozadiSdilene,
      snimky: [],
    };
    const sn = Array.isArray(p.snimky) ? p.snimky : [];
    for (const s of sn) n.snimky.push(Object.assign({}, s, { drzeni: cele(s && s.drzeni, 1, 99, 1) }));
    if (!n.snimky.length) n.snimky.push({ drzeni: 1 });
    return n;
  }

  // ---------- časová osa ----------
  const delkaSnimku = (drzeni, fps) => drzeni * 1000 / fps;

  /* Začátek a délka každého snímku v ms (jedno projetí vpřed). */
  function casovaOsa(drzeni, fps) {
    const polozky = [];
    let t = 0;
    drzeni.forEach((d, index) => { const delka = delkaSnimku(d, fps); polozky.push({ index, start: t, delka }); t += delka; });
    return { polozky, celkem: t };
  }

  /* Pořadí snímků v jednom cyklu přehrávání. Ping-pong neopakuje krajní snímky. */
  function poradi(n, rezim) {
    const a = [];
    for (let i = 0; i < n; i++) a.push(i);
    if (rezim === 'pingpong') for (let i = n - 2; i >= 1; i--) a.push(i);
    return a;
  }

  /* Snímky pro export: pořadí cyklu s délkou v ms. */
  function sekvence(drzeni, fps, rezim) {
    return poradi(drzeni.length, rezim).map(i => ({ index: i, delka: delkaSnimku(drzeni[i], fps) }));
  }

  /* Který snímek ukázat v čase t (ms od začátku přehrávání). konec = u „jednou“ doběhlo. */
  function snimekVCase(drzeni, fps, rezim, t) {
    const sek = sekvence(drzeni, fps, rezim);
    const cyklus = sek.reduce((s, x) => s + x.delka, 0);
    if (!sek.length || cyklus <= 0) return { index: 0, konec: true };
    if (rezim === 'jednou' && t >= cyklus) return { index: sek[sek.length - 1].index, konec: true };
    let u = ((t % cyklus) + cyklus) % cyklus;
    for (const x of sek) { if (u < x.delka) return { index: x.index, konec: false }; u -= x.delka; }
    return { index: sek[sek.length - 1].index, konec: false };
  }

  // ---------- cibulová slupka ----------
  /* Snímky k průsvitnému zobrazení kolem aktuálního. Vrací od nejvzdálenějšího
     (kreslí se první) s klesající krytím. smer -1 = předchozí, +1 = následující. */
  function cibule(akt, n, o) {
    o = Object.assign({ pred: 1, za: 1, kryti: 0.5, smycka: false }, o);
    const vysl = [], videno = new Set([akt]);
    const pridej = (smer, pocet) => {
      for (let d = 1; d <= pocet; d++) {
        let i = akt + smer * d;
        if (o.smycka) i = ((i % n) + n) % n;
        else if (i < 0 || i >= n) break;
        if (videno.has(i)) continue;
        videno.add(i);
        vysl.push({ index: i, smer, vzdalenost: d, alfa: o.kryti * (pocet - d + 1) / pocet });
      }
    };
    pridej(-1, Math.max(0, o.pred | 0));
    pridej(1, Math.max(0, o.za | 0));
    return vysl.sort((a, b) => b.vzdalenost - a.vzdalenost);
  }

  // ---------- sprite sheet ----------
  const mocnina2 = v => { let p = 1; while (p < v) p *= 2; return p; };
  function mrizkaSprite(n, w, h, o) {
    o = Object.assign({ sloupcu: 0, mezera: 0, okraj: 0, mocninaDvou: false }, o);
    const sloupcu = Math.max(1, Math.min(n, o.sloupcu > 0 ? o.sloupcu | 0 : Math.ceil(Math.sqrt(n))));
    const radku = Math.max(1, Math.ceil(n / sloupcu));
    let sirka = 2 * o.okraj + sloupcu * w + (sloupcu - 1) * o.mezera;
    let vyska = 2 * o.okraj + radku * h + (radku - 1) * o.mezera;
    if (o.mocninaDvou) { sirka = mocnina2(sirka); vyska = mocnina2(vyska); }
    const pozice = [];
    for (let i = 0; i < n; i++) {
      const c = i % sloupcu, r = Math.floor(i / sloupcu);
      pozice.push({ x: o.okraj + c * (w + o.mezera), y: o.okraj + r * (h + o.mezera) });
    }
    return { sloupcu, radku, sirka, vyska, pozice };
  }

  /* JSON ve formátu TexturePacker „hash“ (čte Phaser, PixiJS…). */
  function jsonSprite(roz, w, h, delky, obrazek, predpona) {
    const frames = {}, cislic = Math.max(3, String(roz.pozice.length).length);
    roz.pozice.forEach((p, i) => {
      frames[(predpona || 'snimek_') + String(i + 1).padStart(cislic, '0')] = {
        frame: { x: p.x, y: p.y, w, h }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h }, duration: Math.round(delky[i] || 100),
      };
    });
    return { frames, meta: { app: 'Animace snímek po snímku', version: '1', image: obrazek, format: 'RGBA8888', size: { w: roz.sirka, h: roz.vyska }, scale: '1' } };
  }

  // ---------- kresba ----------
  /* Šířka tahu podle tlaku pera (0–1). rezim 'sirka' mění šířku, jinak je šířka plná. */
  function sirkaTahu(velikost, tlak, rezim, minPodil) {
    if (rezim !== 'sirka') return velikost;
    const t = omez(tlak, 0, 1, 1), m = omez(minPodil, 0, 1, 0.15);
    return Math.max(0.5, velikost * (m + (1 - m) * t));
  }

  function hexNaRgba(hex, alfa) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const v = m ? parseInt(m[1], 16) : 0;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, Math.round(omez(alfa, 0, 1, 1) * 255)];
  }
  const rgbNaHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

  /* Výplň plochy: oblast se hledá ve „vzor“ (sloučené vrstvy, RGBA), barví se do „cil“.
     tolerance 0–255 (max. rozdíl složky), rozsireni = o kolik px přetéct pod čáry
     (skryje světlý lem antialiasingu). Vrací obdélník změny {x,y,w,h} nebo null. */
  function vypln(vzor, cil, w, h, x, y, barva, tolerance, rozsireni) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;
    const tol = omez(tolerance, 0, 255, 32);
    const i0 = (y * w + x) * 4;
    const r0 = vzor[i0], g0 = vzor[i0 + 1], b0 = vzor[i0 + 2], a0 = vzor[i0 + 3];
    const shoda = i => {
      const a = vzor[i + 3];
      if (a0 === 0 && a === 0) return true;
      return Math.abs(vzor[i] - r0) <= tol && Math.abs(vzor[i + 1] - g0) <= tol && Math.abs(vzor[i + 2] - b0) <= tol && Math.abs(a - a0) <= tol;
    };
    let maska = new Uint8Array(w * h);
    const zas = [x, y];
    while (zas.length) {
      const sy = zas.pop(), sx = zas.pop();
      let l = sx;
      while (l >= 0 && !maska[sy * w + l] && shoda((sy * w + l) * 4)) l--;
      l++;
      let nahoru = false, dolu = false;
      for (let px = l; px < w && !maska[sy * w + px] && shoda((sy * w + px) * 4); px++) {
        maska[sy * w + px] = 1;
        if (sy > 0) { const m = !maska[(sy - 1) * w + px] && shoda(((sy - 1) * w + px) * 4); if (m && !nahoru) zas.push(px, sy - 1); nahoru = m; }
        if (sy < h - 1) { const m = !maska[(sy + 1) * w + px] && shoda(((sy + 1) * w + px) * 4); if (m && !dolu) zas.push(px, sy + 1); dolu = m; }
      }
    }
    const jadro = maska;   // pixely oblasti se přepíší, přetečení pod čáry se kreslí „pod“ stávající obsah
    for (let k = 0; k < (rozsireni | 0); k++) {
      const m2 = maska.slice();
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        if (maska[py * w + px]) continue;
        if ((px > 0 && maska[py * w + px - 1]) || (px < w - 1 && maska[py * w + px + 1]) || (py > 0 && maska[(py - 1) * w + px]) || (py < h - 1 && maska[(py + 1) * w + px])) m2[py * w + px] = 1;
      }
      maska = m2;
    }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (!maska[py * w + px]) continue;
      const i = (py * w + px) * 4;
      const ac = jadro[py * w + px] ? 0 : cil[i + 3] / 255, ab = barva[3] / 255, ao = ac + ab * (1 - ac);
      if (ao <= 0) { cil[i + 3] = 0; continue; }
      for (let k = 0; k < 3; k++) cil[i + k] = (cil[i + k] * ac + barva[k] * ab * (1 - ac)) / ao;
      cil[i + 3] = ao * 255;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /* Sjednocení obdélníků (null = prázdný) a ořez na plátno. */
  function sjednot(a, b) {
    if (!a) return b ? Object.assign({}, b) : null;
    if (!b) return Object.assign({}, a);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  }
  function orizni(r, w, h) {
    if (!r) return null;
    const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
    const x2 = Math.min(w, Math.ceil(r.x + r.w)), y2 = Math.min(h, Math.ceil(r.y + r.h));
    return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
  }
  /* Obdélník ze dvou rohů (tažení výběru). */
  const obdelnik = (ax, ay, bx, by) => ({ x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) });

  // ---------- seznam snímků ----------
  /* Přesune prvek z indexu od na index kam (výsledný index). Nový pole. */
  function presun(pole, od, kam) {
    const a = pole.slice();
    if (od < 0 || od >= a.length) return a;
    kam = Math.max(0, Math.min(a.length - 1, kam));
    const [x] = a.splice(od, 1);
    a.splice(kam, 0, x);
    return a;
  }

  // ---------- historie Zpět/Znovu ----------
  function Historie(limit) {
    this.limit = limit || 60; this.zpetZas = []; this.znovuZas = [];
  }
  Historie.prototype.zaznam = function (z) { this.zpetZas.push(z); if (this.zpetZas.length > this.limit) this.zpetZas.shift(); this.znovuZas.length = 0; };
  Historie.prototype.zpet = function () { const z = this.zpetZas.pop(); if (z) this.znovuZas.push(z); return z || null; };
  Historie.prototype.znovu = function () { const z = this.znovuZas.pop(); if (z) this.zpetZas.push(z); return z || null; };
  Historie.prototype.lzeZpet = function () { return this.zpetZas.length > 0; };
  Historie.prototype.lzeZnovu = function () { return this.znovuZas.length > 0; };
  Historie.prototype.vymaz = function () { this.zpetZas.length = 0; this.znovuZas.length = 0; };

  const API = {
    VERZE, REZIMY, normProjekt, delkaSnimku, casovaOsa, poradi, sekvence, snimekVCase, cibule,
    mrizkaSprite, jsonSprite, sirkaTahu, hexNaRgba, rgbNaHex, vypln, sjednot, orizni, obdelnik, presun, Historie,
  };
  koren.ANIMSN = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
