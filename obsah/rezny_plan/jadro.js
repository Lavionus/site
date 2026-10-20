/* ============================================================
   Řezný plán – jádro (bez DOM)
   2D: dělení velkoplošných desek – MaxRects, Guillotine (pravidla výběru × dělení), Skyline,
       vícenásobné řazení + náhodné restarty + lokální hledání nad pořadím; gilotinová
       rekonstrukce posloupnosti řezů (každý řez dělí celý kus od hrany ke hraně).
   1D: dělení tyčí – FFD/BFD, sekvenční batoh (SHP) s více délkami a cenou, přesné
       větvení a mezí pro malé úlohy.
   Souřadnice desky: x podél délky desky (W, směr vláken/dekoru), y podél šířky (H), mm, počátek
   vlevo dole. Šířka řezu (prořez) k: dílec se při balení zvětší o k vpravo a nahoře a užitná
   plocha o k – reálné dílce pak mají mezi sebou vždy aspoň k.
   Export: window.RP i module.exports.
   ============================================================ */
(function (koren) {
  'use strict';
  const EPS = 1e-6;

  /* ---------------- pomocné ---------------- */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const cislo = (v, vych) => {
    if (typeof v === 'number') return isFinite(v) ? v : vych;
    if (v == null) return vych;
    const s = String(v).replace(/\s|mm|ks|kč|kc/gi, '').replace(',', '.');
    if (s === '') return vych;
    const n = Number(s);
    return isFinite(n) ? n : vych;
  };
  const normMat = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();
  const fmt = (x, d) => {
    if (x == null || !isFinite(x)) return '–';
    const k = Math.pow(10, d == null ? 1 : d);
    return String(Math.round(x * k) / k).replace('.', ',').replace('-', '−');
  };
  const efOkraj = (okraj, rez) => (okraj > EPS ? Math.max(okraj, rez) : 0);
  const kopie = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- katalog (typické, editovatelné hodnoty) ---------------- */
  const FORMATY = [
    { nazev: 'DTD / laminovaná 2800 × 2070', w: 2800, h: 2070 },
    { nazev: 'DTD 2750 × 1830', w: 2750, h: 1830 },
    { nazev: 'MDF 2800 × 2070', w: 2800, h: 2070 },
    { nazev: 'MDF / HDF 2440 × 1220', w: 2440, h: 1220 },
    { nazev: 'Překližka 2500 × 1250', w: 2500, h: 1250 },
    { nazev: 'Překližka bříza 1525 × 1525', w: 1525, h: 1525 },
    { nazev: 'Překližka 2440 × 1220', w: 2440, h: 1220 },
    { nazev: 'OSB 2500 × 1250', w: 2500, h: 1250 },
    { nazev: 'Spárovka 2000 × 600', w: 2000, h: 600 },
    { nazev: 'Pracovní deska 4100 × 600', w: 4100, h: 600 },
  ];
  const PROFILY = ['hranol 40×60', 'fošna 50×150', 'prkno 24×100', 'lať 30×50', 'jekl 40×40×2', 'L profil 30×30', 'lišta'];

  function vychoziNastaveni() {
    return {
      rez: 4, okraj: 10, prvniRez: 'auto', odecistHranu: true, premill: 0, pridavekHrany: 30, rezervaHran: 5,
      minZbytekStrana: 150, minZbytekPlocha: 0.05, usili: 'normalni',
      rez1D: 3, okraj1D: 10, minZbytek1D: 300,
      zbytkyZeSkladu: true,
    };
  }
  function vychoziProjekt() { return predvolba('kuchyn'); }

  const PREDVOLBY = {
    kuchyn: {
      nazev: 'Kuchyň – spodní a horní korpusy (DTD 18 + záda HDF)', rezim2d: 'gilotina',
      desky: [
        { material: 'DTD 18 bílá', w: 2800, h: 2070, tl: 18, cena: 1450, ks: null, vlakna: false },
        { material: 'HDF 3 bílá', w: 2800, h: 2070, tl: 3, cena: 420, ks: null, vlakna: false },
      ],
      hrany: [{ id: 'A2', nazev: 'ABS 2 mm bílá 22', tl: 2, sirka: 22, cena: 16 }, { id: 'A05', nazev: 'ABS 0,5 mm bílá 22', tl: 0.5, sirka: 22, cena: 5 }],
      dilce: [
        { nazev: 'Bok spodní', w: 720, h: 560, ks: 8, material: 'DTD 18 bílá', vlakna: false, hrany: { d1: 'A2', d2: '', s1: 'A05', s2: 'A05' } },
        { nazev: 'Dno spodní', w: 564, h: 560, ks: 4, material: 'DTD 18 bílá', vlakna: false, hrany: { d1: 'A2', d2: '', s1: '', s2: '' } },
        { nazev: 'Spojka', w: 564, h: 100, ks: 8, material: 'DTD 18 bílá', vlakna: false, hrany: { d1: 'A05', d2: '', s1: '', s2: '' } },
        { nazev: 'Police spodní', w: 562, h: 520, ks: 4, material: 'DTD 18 bílá', vlakna: false, hrany: { d1: 'A2', d2: '', s1: '', s2: '' } },
        { nazev: 'Bok horní', w: 720, h: 320, ks: 6, material: 'DTD 18 bílá', vlakna: false, hrany: { d1: 'A2', d2: '', s1: 'A05', s2: 'A05' } },
        { nazev: 'Dno/strop horní', w: 564, h: 320, ks: 6, material: 'DTD 18 bílá', vlakna: false, hrany: { d1: 'A2', d2: '', s1: '', s2: '' } },
        { nazev: 'Police horní', w: 562, h: 290, ks: 3, material: 'DTD 18 bílá', vlakna: false, hrany: { d1: 'A2', d2: '', s1: '', s2: '' } },
        { nazev: 'Záda spodní', w: 716, h: 596, ks: 4, material: 'HDF 3 bílá', vlakna: false, hrany: {} },
        { nazev: 'Záda horní', w: 716, h: 596, ks: 3, material: 'HDF 3 bílá', vlakna: false, hrany: {} },
      ],
      polotovary1D: [{ nazev: 'Sokl 100 mm', profil: 'sokl 100', L: 4000, cena: 290, ks: null }],
      kusy1D: [{ nazev: 'Sokl čelní', L: 2400, ks: 1, profil: 'sokl 100' }, { nazev: 'Sokl boční', L: 540, ks: 2, profil: 'sokl 100' }],
    },
    skrin: {
      nazev: 'Šatní skříň – dekor dub (směr vláken!)', rezim2d: 'gilotina',
      desky: [{ material: 'DTD 18 dub Halifax', w: 2800, h: 2070, tl: 18, cena: 1890, ks: null, vlakna: true }],
      hrany: [{ id: 'D2', nazev: 'ABS 2 mm dub 23', tl: 2, sirka: 23, cena: 22 }, { id: 'D08', nazev: 'ABS 0,8 mm dub 23', tl: 0.8, sirka: 23, cena: 9 }],
      dilce: [
        { nazev: 'Bok', w: 2200, h: 580, ks: 2, material: 'DTD 18 dub Halifax', vlakna: true, hrany: { d1: 'D2', d2: '', s1: 'D08', s2: 'D08' } },
        { nazev: 'Přepážka', w: 2164, h: 560, ks: 1, material: 'DTD 18 dub Halifax', vlakna: true, hrany: { d1: 'D2', d2: '', s1: '', s2: '' } },
        { nazev: 'Strop / dno', w: 1164, h: 580, ks: 2, material: 'DTD 18 dub Halifax', vlakna: true, hrany: { d1: 'D2', d2: '', s1: '', s2: '' } },
        { nazev: 'Police', w: 572, h: 540, ks: 6, material: 'DTD 18 dub Halifax', vlakna: true, hrany: { d1: 'D2', d2: '', s1: '', s2: '' } },
        { nazev: 'Dvířka', w: 2196, h: 596, ks: 2, material: 'DTD 18 dub Halifax', vlakna: true, hrany: { d1: 'D2', d2: 'D2', s1: 'D2', s2: 'D2' } },
        { nazev: 'Sokl', w: 1128, h: 80, ks: 2, material: 'DTD 18 dub Halifax', vlakna: true, hrany: { d1: 'D08', d2: '', s1: '', s2: '' } },
      ],
      polotovary1D: [{ nazev: 'Šatní tyč Ø25', profil: 'tyč Ø25', L: 2500, cena: 210, ks: null }],
      kusy1D: [{ nazev: 'Šatní tyč', L: 548, ks: 2, profil: 'tyč Ø25' }],
    },
    regal: {
      nazev: 'Regál z překližky – CNC (volné uložení)', rezim2d: 'volne',
      nast: { rez: 6.5, okraj: 15 },
      desky: [{ material: 'Překližka bříza 18', w: 2500, h: 1250, tl: 18, cena: 2350, ks: null, vlakna: true }],
      hrany: [],
      dilce: [
        { nazev: 'Bok regálu', w: 1800, h: 300, ks: 2, material: 'Překližka bříza 18', vlakna: true, hrany: {} },
        { nazev: 'Police', w: 764, h: 300, ks: 5, material: 'Překližka bříza 18', vlakna: true, hrany: {} },
        { nazev: 'Záklop', w: 764, h: 120, ks: 2, material: 'Překližka bříza 18', vlakna: false, hrany: {} },
        { nazev: 'Zásuvka – čelo', w: 360, h: 140, ks: 4, material: 'Překližka bříza 18', vlakna: true, hrany: {} },
        { nazev: 'Zásuvka – bok', w: 260, h: 120, ks: 8, material: 'Překližka bříza 18', vlakna: false, hrany: {} },
      ],
      polotovary1D: [], kusy1D: [],
    },
    pergola: {
      nazev: 'Pergola – hranoly a fošny (1D, více délek)', rezim2d: 'gilotina',
      desky: [], hrany: [], dilce: [],
      nast: { rez1D: 3, okraj1D: 10 },
      polotovary1D: [
        { nazev: 'KVH 120×120 / 4 m', profil: 'KVH 120×120', L: 4000, cena: 1150, ks: null },
        { nazev: 'KVH 120×120 / 5 m', profil: 'KVH 120×120', L: 5000, cena: 1400, ks: null },
        { nazev: 'KVH 120×120 / 6 m', profil: 'KVH 120×120', L: 6000, cena: 1650, ks: null },
        { nazev: 'Fošna 50×150 / 4 m', profil: 'fošna 50×150', L: 4000, cena: 420, ks: null },
        { nazev: 'Fošna 50×150 / 6 m', profil: 'fošna 50×150', L: 6000, cena: 610, ks: null },
      ],
      kusy1D: [
        { nazev: 'Sloup', L: 2600, ks: 6, profil: 'KVH 120×120' },
        { nazev: 'Vaznice', L: 4400, ks: 2, profil: 'KVH 120×120' },
        { nazev: 'Pásek (vzpěra)', L: 650, ks: 8, profil: 'KVH 120×120' },
        { nazev: 'Krokev', L: 3200, ks: 9, profil: 'fošna 50×150' },
        { nazev: 'Čelní prkno', L: 1450, ks: 4, profil: 'fošna 50×150' },
      ],
    },
    rametekly: {
      nazev: 'Rám stolu z jeklu 40×40 (1D)', rezim2d: 'gilotina', desky: [], hrany: [], dilce: [],
      nast: { rez1D: 2, okraj1D: 5, minZbytek1D: 200 },
      polotovary1D: [{ nazev: 'Jekl 40×40×2 / 6 m', profil: 'jekl 40×40×2', L: 6000, cena: 640, ks: null }, { nazev: 'Zbytek jeklu 2,1 m', profil: 'jekl 40×40×2', L: 2100, cena: 0, ks: 1 }],
      kusy1D: [{ nazev: 'Noha', L: 720, ks: 4, profil: 'jekl 40×40×2' }, { nazev: 'Podélník', L: 1520, ks: 4, profil: 'jekl 40×40×2' }, { nazev: 'Příčník', L: 680, ks: 4, profil: 'jekl 40×40×2' }],
    },
  };
  function predvolba(k) {
    const P = PREDVOLBY[k] || PREDVOLBY.kuchyn;
    const pr = {
      verze: 1, nazev: P.nazev, rezim2d: P.rezim2d || 'gilotina', nast: Object.assign(vychoziNastaveni(), P.nast || {}),
      desky: (P.desky || []).map((d, i) => Object.assign({ id: 'D' + (i + 1), zbytek: false }, d)),
      hrany: kopie(P.hrany || []),
      dilce: (P.dilce || []).map((d, i) => Object.assign({ id: 'P' + (i + 1), pozn: '' }, kopie(d), { hrany: Object.assign({ d1: '', d2: '', s1: '', s2: '' }, d.hrany || {}) })),
      polotovary1D: (P.polotovary1D || []).map((d, i) => Object.assign({ id: 'T' + (i + 1) }, d)),
      kusy1D: (P.kusy1D || []).map((d, i) => Object.assign({ id: 'K' + (i + 1) }, d)),
    };
    return pr;
  }

  /* ---------------- rozměry řezu a hrany ---------------- */
  function mapaHran(pr) { const m = {}; for (const h of pr.hrany || []) m[h.id] = h; return m; }
  /** řezný rozměr dílce: hotový − tloušťka hran (+ přídavek na frézování) na stranách s hranou */
  function rozmerRezu(d, hm, nast) {
    let w = cislo(d.w, 0), h = cislo(d.h, 0);
    if (nast.odecistHranu) {
      const H = d.hrany || {}, tl = (id) => (id && hm[id] ? cislo(hm[id].tl, 0) - cislo(nast.premill, 0) : 0);
      w -= tl(H.s1) + tl(H.s2);
      h -= tl(H.d1) + tl(H.d2);
    }
    return { w, h };
  }
  /** spotřeba hran: po typech {id, nazev, metru, metruSRezervou, cena, kusuHran} */
  function spotrebaHran(pr) {
    const hm = mapaHran(pr), n = pr.nast, souhrn = {};
    for (const d of pr.dilce || []) {
      const ks = Math.max(0, Math.round(cislo(d.ks, 0))), H = d.hrany || {};
      for (const [str, delka] of [['d1', d.w], ['d2', d.w], ['s1', d.h], ['s2', d.h]]) {
        const id = H[str]; if (!id || !hm[id]) continue;
        const s = souhrn[id] || (souhrn[id] = { id, nazev: hm[id].nazev || id, tl: hm[id].tl, sirka: hm[id].sirka, mm: 0, kusuHran: 0, cenaM: cislo(hm[id].cena, 0) });
        s.mm += ks * (cislo(delka, 0) + cislo(n.pridavekHrany, 0)); s.kusuHran += ks;
      }
    }
    return Object.values(souhrn).map((s) => {
      const metru = s.mm / 1000, sr = metru * (1 + cislo(n.rezervaHran, 0) / 100);
      return Object.assign(s, { metru, metruSRezervou: sr, cena: sr * s.cenaM });
    });
  }

  /* ================================================================
     2D – balení do jedné desky (souřadnice „nafouknuté“ o prořez)
     položka: {k, w, h, r (smí se otočit)} → umístění {k, x, y, w, h, rot}
     ================================================================ */
  const vejdeSe = (it, W, H) => (it.w <= W + EPS && it.h <= H + EPS) || (it.r && it.h <= W + EPS && it.w <= H + EPS);
  const lepsiPar = (a, b) => a[0] < b[0] - EPS || (Math.abs(a[0] - b[0]) <= EPS && a[1] < b[1] - EPS);

  function kontakt(x, y, w, h, used, W, H) {
    let s = 0;
    if (x <= EPS || Math.abs(x + w - W) <= EPS) s += h;
    if (y <= EPS || Math.abs(y + h - H) <= EPS) s += w;
    const prekryv = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
    for (const u of used) {
      if (Math.abs(u.x - (x + w)) <= EPS || Math.abs(u.x + u.w - x) <= EPS) s += prekryv(u.y, u.y + u.h, y, y + h);
      if (Math.abs(u.y - (y + h)) <= EPS || Math.abs(u.y + u.h - y) <= EPS) s += prekryv(u.x, u.x + u.w, x, x + w);
    }
    return s;
  }
  function skoreMR(heur, f, w, h, used, W, H) {
    const dw = f.w - w, dh = f.h - h;
    switch (heur) {
      case 'BSSF': return [Math.min(dw, dh), Math.max(dw, dh)];
      case 'BLSF': return [Math.max(dw, dh), Math.min(dw, dh)];
      case 'BAF': return [f.w * f.h - w * h, Math.min(dw, dh)];
      case 'BL': return [f.y + h, f.x];
      case 'CP': return [-kontakt(f.x, f.y, w, h, used, W, H), f.y + h];
      default: return [Math.min(dw, dh), Math.max(dw, dh)];
    }
  }
  function rozdelVolne(free, p, minS) {
    const nove = [];
    for (const f of free) {
      if (p.x >= f.x + f.w - EPS || p.x + p.w <= f.x + EPS || p.y >= f.y + f.h - EPS || p.y + p.h <= f.y + EPS) { nove.push(f); continue; }
      if (p.x > f.x + EPS) nove.push({ x: f.x, y: f.y, w: p.x - f.x, h: f.h });
      if (p.x + p.w < f.x + f.w - EPS) nove.push({ x: p.x + p.w, y: f.y, w: f.x + f.w - p.x - p.w, h: f.h });
      if (p.y > f.y + EPS) nove.push({ x: f.x, y: f.y, w: f.w, h: p.y - f.y });
      if (p.y + p.h < f.y + f.h - EPS) nove.push({ x: f.x, y: p.y + p.h, w: f.w, h: f.y + f.h - p.y - p.h });
    }
    const kand = nove.filter((a) => a.w >= minS - EPS && a.h >= minS - EPS), out = [];
    for (let i = 0; i < kand.length; i++) {
      const a = kand[i]; let uvnitr = false;
      for (let j = 0; j < kand.length; j++) {
        if (i === j) continue; const b = kand[j];
        if (a.x >= b.x - EPS && a.y >= b.y - EPS && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS) {
          const stejne = Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS && Math.abs(a.w - b.w) <= EPS && Math.abs(a.h - b.h) <= EPS;
          if (!stejne || j < i) { uvnitr = true; break; }
        }
      }
      if (!uvnitr) out.push(a);
    }
    return out;
  }
  const minStrana = (items) => { let m = Infinity; for (const it of items) m = Math.min(m, it.w, it.h); return m; };

  /** MaxRects – položky v daném pořadí */
  function maxRects(W, H, items, heur) {
    let free = [{ x: 0, y: 0, w: W, h: H }];
    const used = [], zbyle = [], minS = minStrana(items);
    for (const it of items) {
      let best = null;
      for (let o = 0; o < (it.r && Math.abs(it.w - it.h) > EPS ? 2 : 1); o++) {
        const w = o ? it.h : it.w, h = o ? it.w : it.h;
        for (const f of free) {
          if (w > f.w + EPS || h > f.h + EPS) continue;
          const s = skoreMR(heur, f, w, h, used, W, H);
          if (!best || lepsiPar(s, best.s)) best = { s, x: f.x, y: f.y, w, h, o };
        }
      }
      if (!best) { zbyle.push(it); continue; }
      const p = { k: it.k, x: best.x, y: best.y, w: best.w, h: best.h, rot: !!best.o };
      used.push(p); free = rozdelVolne(free, p, minS);
    }
    return { used, zbyle, free };
  }
  /** MaxRects – globální výběr (v každém kroku nejlepší dvojice položka × místo) */
  function maxRectsGlobal(W, H, items, heur) {
    let free = [{ x: 0, y: 0, w: W, h: H }];
    const used = [], zbyva = items.slice(), minS = minStrana(items);
    while (zbyva.length) {
      let best = null;
      for (let i = 0; i < zbyva.length; i++) {
        const it = zbyva[i];
        for (let o = 0; o < (it.r && Math.abs(it.w - it.h) > EPS ? 2 : 1); o++) {
          const w = o ? it.h : it.w, h = o ? it.w : it.h;
          for (const f of free) {
            if (w > f.w + EPS || h > f.h + EPS) continue;
            const s = skoreMR(heur, f, w, h, used, W, H);
            if (!best || lepsiPar(s, best.s)) best = { s, i, x: f.x, y: f.y, w, h, o };
          }
        }
      }
      if (!best) break;
      const it = zbyva.splice(best.i, 1)[0];
      const p = { k: it.k, x: best.x, y: best.y, w: best.w, h: best.h, rot: !!best.o };
      used.push(p); free = rozdelVolne(free, p, minS);
    }
    return { used, zbyle: zbyva, free };
  }

  /** Guillotine – volné obdélníky se dělí jediným průběžným řezem → výsledek je vždy gilotinový */
  function gilotina(W, H, items, vyber, split) {
    let free = [{ x: 0, y: 0, w: W, h: H }];
    const used = [], zbyle = [], minS = minStrana(items);
    for (const it of items) {
      let best = null;
      for (let o = 0; o < (it.r && Math.abs(it.w - it.h) > EPS ? 2 : 1); o++) {
        const w = o ? it.h : it.w, h = o ? it.w : it.h;
        for (let i = 0; i < free.length; i++) {
          const f = free[i];
          if (w > f.w + EPS || h > f.h + EPS) continue;
          const dw = f.w - w, dh = f.h - h;
          let s;
          if (vyber === 'BAF') s = [f.w * f.h - w * h, Math.min(dw, dh)];
          else if (vyber === 'BSSF') s = [Math.min(dw, dh), Math.max(dw, dh)];
          else if (vyber === 'BLSF') s = [Math.max(dw, dh), Math.min(dw, dh)];
          else if (vyber === 'WAF') s = [-(f.w * f.h - w * h), Math.min(dw, dh)];
          else s = [f.y, f.x];                         // BL – nejníž, pak nejvíc vlevo
          if (!best || lepsiPar(s, best.s)) best = { s, i, w, h, o };
        }
      }
      if (!best) { zbyle.push(it); continue; }
      const f = free[best.i], w = best.w, h = best.h;
      used.push({ k: it.k, x: f.x, y: f.y, w, h, rot: !!best.o });
      free.splice(best.i, 1);
      const rw = f.w - w, rh = f.h - h;
      let horiz;
      switch (split) {
        case 'SAS': horiz = f.w <= f.h; break;
        case 'LAS': horiz = f.w > f.h; break;
        case 'SLAS': horiz = rw <= rh; break;
        case 'LLAS': horiz = rw > rh; break;
        case 'MINAS': horiz = w * rh > rw * h; break;
        case 'MAXAS': horiz = w * rh <= rw * h; break;
        case 'H': horiz = true; break;
        case 'V': horiz = false; break;
        default: horiz = rw <= rh;
      }
      const a = horiz ? { x: f.x + w, y: f.y, w: rw, h } : { x: f.x + w, y: f.y, w: rw, h: f.h };
      const b = horiz ? { x: f.x, y: f.y + h, w: f.w, h: rh } : { x: f.x, y: f.y + h, w, h: rh };
      for (const q of [a, b]) if (q.w >= minS - EPS && q.h >= minS - EPS) free.push(q);
    }
    return { used, zbyle };
  }

  /** Skyline – zleva zdola (BL) nebo s nejmenším odpadem pod dílcem (MW) */
  function skyline(W, H, items, heur) {
    let sky = [{ x: 0, y: 0, w: W }];
    const used = [], zbyle = [];
    const zkus = (i, w, h) => {
      const x = sky[i].x; if (x + w > W + EPS) return null;
      let zb = w, j = i, y = sky[i].y;
      while (zb > EPS) { if (j >= sky.length) return null; y = Math.max(y, sky[j].y); if (y + h > H + EPS) return null; zb -= sky[j].w; j++; }
      let odpad = 0; zb = w; j = i;
      while (zb > EPS) { const s = Math.min(zb, sky[j].w); odpad += (y - sky[j].y) * s; zb -= s; j++; }
      return { x, y, odpad };
    };
    for (const it of items) {
      let best = null;
      for (let o = 0; o < (it.r && Math.abs(it.w - it.h) > EPS ? 2 : 1); o++) {
        const w = o ? it.h : it.w, h = o ? it.w : it.h;
        for (let i = 0; i < sky.length; i++) {
          const z = zkus(i, w, h); if (!z) continue;
          const s = heur === 'MW' ? [z.odpad, z.y + h] : [z.y + h, z.x];
          if (!best || lepsiPar(s, best.s)) best = { s, x: z.x, y: z.y, w, h, o };
        }
      }
      if (!best) { zbyle.push(it); continue; }
      used.push({ k: it.k, x: best.x, y: best.y, w: best.w, h: best.h, rot: !!best.o });
      // aktualizace obrysu
      const x0 = best.x, x1 = best.x + best.w, nova = [];
      for (const s of sky) {
        if (s.x + s.w <= x0 + EPS || s.x >= x1 - EPS) { nova.push(s); continue; }
        if (s.x < x0 - EPS) nova.push({ x: s.x, y: s.y, w: x0 - s.x });
        if (s.x + s.w > x1 + EPS) nova.push({ x: x1, y: s.y, w: s.x + s.w - x1 });
      }
      nova.push({ x: x0, y: best.y + best.h, w: best.w });
      nova.sort((a, b) => a.x - b.x);
      sky = [];
      for (const s of nova) { const p = sky[sky.length - 1]; if (p && Math.abs(p.y - s.y) <= EPS) p.w += s.w; else sky.push(Object.assign({}, s)); }
    }
    return { used, zbyle };
  }

  const METODY_GIL = [];
  for (const v of ['BAF', 'BSSF', 'BLSF', 'BL']) for (const s of ['SLAS', 'LLAS', 'MINAS', 'MAXAS', 'SAS', 'LAS', 'H', 'V']) METODY_GIL.push({ typ: 'gil', v, s });
  const METODY_VOLNE = [];
  for (const h of ['BSSF', 'BLSF', 'BAF', 'BL', 'CP']) METODY_VOLNE.push({ typ: 'mr', h });
  METODY_VOLNE.push({ typ: 'sky', h: 'BL' }, { typ: 'sky', h: 'MW' });
  const popisMetody = (m) => m.typ === 'gil' ? `Guillotine ${m.v}/${m.s}` : m.typ === 'mrg' ? `MaxRects ${m.h} (globální)` : m.typ === 'mr' ? `MaxRects ${m.h}` : `Skyline ${m.h}`;

  function zabal(m, W, H, items) {
    if (m.typ === 'gil') return gilotina(W, H, items, m.v, m.s);
    if (m.typ === 'mr') return maxRects(W, H, items, m.h);
    if (m.typ === 'mrg') return maxRectsGlobal(W, H, items, m.h);
    return skyline(W, H, items, m.h);
  }

  /* ---------------- více desek / více formátů ---------------- */
  /** sklad: [{Wi, Hi, cenaEf, ks (null = neomezeně), plocha}] */
  function zabalSkupinu(items, sklad, m, zmensovat) {
    let zbyva = items;
    const zasoba = sklad.map((t) => (t.ks == null ? Infinity : t.ks)), desky = [];
    while (zbyva.length) {
      let best = null;
      for (let ti = 0; ti < sklad.length; ti++) {
        if (zasoba[ti] <= 0) continue;
        const t = sklad[ti];
        if (!zbyva.some((it) => vejdeSe(it, t.Wi, t.Hi))) continue;
        const r = zabal(m, t.Wi, t.Hi, zbyva);
        if (!r.used.length) continue;
        let pl = 0; for (const u of r.used) pl += u.w * u.h;
        const sk = t.cenaEf / pl;
        if (!best || sk < best.sk * (1 - 1e-9) || (Math.abs(sk - best.sk) <= best.sk * 1e-9 && pl > best.pl)) best = { ti, r, sk, pl };
      }
      if (!best) break;
      zasoba[best.ti]--;
      desky.push({ ti: best.ti, used: best.r.used, pl: best.pl });
      zbyva = best.r.zbyle;
    }
    const v = { desky, nezarazeno: zbyva, zasoba, m };
    if (zmensovat) zmensi(v, sklad, items, zmensovat === 'vse' ? desky.length : 1);
    return v;
  }
  /** nahradí desku levnějším formátem, pokud se do něj vejde celý její obsah (posledních n desek) */
  function zmensi(v, sklad, items, n) {
    if (sklad.length < 2) return;
    const podleK = new Map(); for (const it of items) podleK.set(it.k, it);
    for (let di = v.desky.length - 1; di >= Math.max(0, v.desky.length - n); di--) {
      const d = v.desky[di];
      const obsah = d.used.map((u) => podleK.get(u.k)).sort((a, b) => b.w * b.h - a.w * a.h);
      let nej = null;
      for (let ti = 0; ti < sklad.length; ti++) {
        if (ti === d.ti || v.zasoba[ti] <= 0 || sklad[ti].cenaEf >= sklad[d.ti].cenaEf - 1e-9) continue;
        if (nej && sklad[ti].cenaEf >= sklad[nej.ti].cenaEf) continue;
        for (const m of [v.m, { typ: 'mr', h: 'BSSF' }, { typ: 'gil', v: 'BAF', s: 'SLAS' }]) {
          if (v.m.typ === 'gil' && m.typ !== 'gil') continue;
          const r = zabal(m, sklad[ti].Wi, sklad[ti].Hi, obsah);
          if (!r.zbyle.length) { nej = { ti, used: r.used }; break; }
        }
      }
      if (nej) { v.zasoba[d.ti]++; v.zasoba[nej.ti]--; d.ti = nej.ti; d.used = nej.used; }
    }
  }
  function hodnot(v, sklad, items) {
    let cena = 0, u = 0;
    for (const d of v.desky) { const t = sklad[d.ti]; cena += t.cenaEf; const q = d.pl / t.plocha; u += q * q; }
    let nez = 0; for (const it of v.nezarazeno) nez += it.w * it.h;
    return { nez: v.nezarazeno.length, nezPl: nez, cena, n: v.desky.length, u };
  }
  function porovnej(a, b) {
    if (a.nez !== b.nez) return a.nez - b.nez;
    if (Math.abs(a.cena - b.cena) > 1e-9 * Math.max(1, Math.abs(b.cena))) return a.cena - b.cena;
    if (a.n !== b.n) return a.n - b.n;
    return b.u - a.u;
  }

  const RAZENI = {
    plocha: (a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h),
    delsi: (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || Math.min(b.w, b.h) - Math.min(a.w, a.h),
    obvod: (a, b) => (b.w + b.h) - (a.w + a.h),
    sirka: (a, b) => b.w - a.w || b.h - a.h,
    vyska: (a, b) => b.h - a.h || b.w - a.w,
    kratsi: (a, b) => Math.min(b.w, b.h) - Math.min(a.w, a.h) || Math.max(b.w, b.h) - Math.max(a.w, a.h),
    rozdil: (a, b) => Math.abs(b.w - b.h) - Math.abs(a.w - a.h),
  };

  /** hledání nejlepšího uložení jedné materiálové skupiny */
  function hledej2D(items, sklad, rezim, o) {
    const R = rng(o.seed || 12345), t0 = Date.now();
    const metody = rezim === 'gilotina' ? METODY_GIL : METODY_VOLNE.concat(METODY_GIL.filter((m) => m.s === 'SLAS' || m.s === 'MINAS'));
    const elita = [];
    let vyhodnoceni = 0;
    const zmens = sklad.length > 1 ? 1 : 0;
    const zkus = (m, poradi) => {
      const v = zabalSkupinu(poradi, sklad, m, zmens), h = hodnot(v, sklad, items);
      vyhodnoceni++;
      const c = { m, poradi, v, h };
      let i = elita.findIndex((e) => porovnej(h, e.h) < 0);
      if (i < 0) i = elita.length;
      if (i < 8) { elita.splice(i, 0, c); if (elita.length > 8) elita.pop(); }
      return c;
    };
    // 1) portfolio: všechny metody × všechna řazení
    const razeni = Object.keys(RAZENI);
    for (const m of metody) for (const r of razeni) zkus(m, items.slice().sort(RAZENI[r]));
    if (rezim !== 'gilotina' && items.length <= 140) for (const h of ['BSSF', 'BAF', 'CP']) zkus({ typ: 'mrg', h }, items.slice().sort(RAZENI.plocha));
    // 2) náhodné restarty + lokální hledání nad pořadím (horolezení z elity)
    const maxIt = o.iteraci != null ? o.iteraci : 4000, casMs = o.casMs != null ? o.casMs : 1500;
    const nejlepsiMetody = () => { const s = []; for (const e of elita) if (e.m.typ !== 'mrg' && !s.includes(e.m)) s.push(e.m); return s.length ? s : metody; };
    for (let it = 0; it < maxIt && Date.now() - t0 < casMs * 0.35 && items.length > 1; it++) {
      const ms = nejlepsiMetody();
      let m, poradi;
      if (R() < 0.12) {
        m = R() < 0.5 ? ms[Math.floor(R() * ms.length)] : metody[Math.floor(R() * metody.length)];
        const sum = (q) => (q.w * q.h) * (1 + 0.35 * (R() - 0.5));
        poradi = items.map((q) => [sum(q), q]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
      } else {
        const zakl = elita[Math.floor(R() * R() * elita.length)];
        m = zakl.m.typ === 'mrg' || R() < 0.15 ? ms[Math.floor(R() * ms.length)] : zakl.m;
        poradi = zakl.poradi.slice();
        const kroku = 1 + Math.floor(R() * 3), n = poradi.length;
        for (let s = 0; s < kroku; s++) {
          const a = Math.floor(R() * n), b = Math.floor(R() * n), op = R();
          if (op < 0.45) { const x = poradi[a]; poradi[a] = poradi[b]; poradi[b] = x; }
          else if (op < 0.8) { const x = poradi.splice(a, 1)[0]; poradi.splice(b, 0, x); }
          else { const i0 = Math.min(a, b), i1 = Math.min(n - 1, i0 + 1 + Math.floor(R() * 5)); const seg = poradi.slice(i0, i1 + 1).reverse(); poradi.splice(i0, seg.length, ...seg); }
        }
      }
      zkus(m, poradi);
      if (o.prubeh && it % 50 === 0) o.prubeh(Math.min(1, (Date.now() - t0) / casMs));
    }
    // 3) postupné plnění: každou desku zvlášť co nejvíc zaplnit (portfolio + horolezení nad pořadím)
    const odhadDesek = Math.max(1, elita[0].v.desky.length);
    const naDesku = Math.max(60, Math.floor((o.iteraci != null ? o.iteraci : 4000) / odhadDesek));
    const metodyPP = rezim === 'gilotina' ? METODY_GIL.concat(METODY_VOLNE) : metody;
    const pp = plneniPoDeskach(items, sklad, metodyPP, R, naDesku, t0, casMs * 0.7, rezim === 'gilotina');
    vyhodnoceni += pp.vyhodnoceni;
    const hp = hodnot(pp.v, sklad, items);
    let nej = elita[0], metoda = popisMetody(nej.m);
    if (porovnej(hp, nej.h) < 0) { nej = { v: pp.v, h: hp }; metoda = 'plnění po deskách (' + pp.metody + ')'; }
    // 4) rozbij a znovu postav: nejméně zaplněná deska + 1–2 náhodné se přeskládají znovu
    const kol = o.kolRozbij != null ? o.kolRozbij : Math.min(400, Math.max(40, Math.floor((o.iteraci != null ? o.iteraci : 4000) / 10)));
    let zlepseni = 0;
    let nejG = nej;
    for (let it = 0; it < kol && nej.v.desky.length >= 2 && Date.now() - t0 < casMs; it++) {
      const D = nej.v.desky;
      let nejmene = 0; for (let i = 1; i < D.length; i++) if (D[i].pl / sklad[D[i].ti].plocha < D[nejmene].pl / sklad[D[nejmene].ti].plocha) nejmene = i;
      const vyber = new Set([nejmene]);
      const kolik = Math.min(D.length, 2 + (R() < 0.35 ? 1 : 0));
      while (vyber.size < kolik) vyber.add(Math.floor(R() * D.length));
      const podleK = new Map(); for (const q of items) podleK.set(q.k, q);
      const its = [];
      for (const i of vyber) for (const u of D[i].used) its.push(podleK.get(u.k));
      for (const q of nej.v.nezarazeno) its.push(q);
      const zas = nej.v.zasoba.slice(); for (const i of vyber) zas[D[i].ti]++;
      const r = plneniPoDeskach(its, sklad, R() < 0.5 ? metodyPP : metody, R, o.naDeskuRozbij || 100, t0, casMs * 1.1, rezim === 'gilotina', zas);
      vyhodnoceni += r.vyhodnoceni;
      const v = { desky: D.filter((d, i) => !vyber.has(i)).concat(r.v.desky), nezarazeno: r.v.nezarazeno, zasoba: r.v.zasoba, m: nej.v.m };
      const h = hodnot(v, sklad, items);
      // přijme i mírně horší rozložení se stejným počtem a cenou (únik z plató), nejlepší si pamatuje zvlášť
      const stejne = h.nez === nej.h.nez && Math.abs(h.cena - nej.h.cena) <= 1e-9 * Math.max(1, nej.h.cena) && h.n === nej.h.n;
      if (porovnej(h, nej.h) < 0 || (stejne && h.u > nej.h.u - 0.03 * R())) {
        nej = { v, h };
        if (porovnej(h, nejG.h) < 0) { nejG = nej; zlepseni++; }
      }
    }
    nej = nejG;
    if (zlepseni) metoda += ` + přeskládání (${zlepseni}×)`;
    if (sklad.length > 1) zmensi(nej.v, sklad, items, nej.v.desky.length);
    return { v: nej.v, h: hodnot(nej.v, sklad, items), metoda, vyhodnoceni, ms: Date.now() - t0 };
  }
  /** jen gilotinová uložení: v nafouknutých souřadnicích odpovídá řez nulové šířky řezu šířky k ve skutečnosti */
  const jeGil = (W, H, used) => rekonstruuj(W, H, used, 0, 0, 'H').ok;
  function plneniPoDeskach(items, sklad, metody, R, naDesku, t0, casMax, gil, zasoba0) {
    let zbyva = items.slice();
    const zasoba = zasoba0 ? zasoba0.slice() : sklad.map((t) => (t.ks == null ? Infinity : t.ks)), desky = [], pouzite = new Set();
    let vyhodnoceni = 0;
    const plocha = (r) => { let p = 0; for (const u of r.used) p += u.w * u.h; return p; };
    while (zbyva.length) {
      let best = null;
      for (let ti = 0; ti < sklad.length; ti++) {
        if (zasoba[ti] <= 0) continue;
        const t = sklad[ti];
        if (!zbyva.some((it) => vejdeSe(it, t.Wi, t.Hi))) continue;
        let nejT = null;
        const zkus = (m, por) => {
          const r = zabal(m, t.Wi, t.Hi, por); vyhodnoceni++;
          const pl = plocha(r);
          if (!nejT || pl > nejT.pl + EPS) { if (gil && m.typ !== 'gil' && !jeGil(t.Wi, t.Hi, r.used)) return; nejT = { m, por, r, pl }; }
        };
        for (const m of metody) for (const k of ['plocha', 'delsi', 'kratsi', 'sirka', 'vyska']) zkus(m, zbyva.slice().sort(RAZENI[k]));
        if (zbyva.length <= 120) for (const h of ['BSSF', 'BAF', 'CP', 'BL']) zkus({ typ: 'mrg', h }, zbyva.slice().sort(RAZENI.plocha));
        const celk = zbyva.reduce((a, q) => a + q.w * q.h, 0), limit = Math.min(t.Wi * t.Hi, celk);
        for (let i = 0; i < naDesku && nejT.pl < limit - EPS && Date.now() - t0 < casMax; i++) {
          const por = nejT.por.slice(), n = por.length;
          const kroku = 1 + Math.floor(R() * 3);
          for (let s = 0; s < kroku; s++) {
            const a = Math.floor(R() * n), b = Math.floor(R() * n);
            if (R() < 0.5) { const x = por[a]; por[a] = por[b]; por[b] = x; } else { const x = por.splice(a, 1)[0]; por.splice(b, 0, x); }
          }
          zkus(R() < 0.8 && nejT.m.typ !== 'mrg' ? nejT.m : metody[Math.floor(R() * metody.length)], por);
        }
        if (!nejT.r.used.length) continue;
        const sk = t.cenaEf / nejT.pl;
        if (!best || sk < best.sk * (1 - 1e-9)) best = { ti, r: nejT.r, sk, pl: nejT.pl, m: nejT.m };
      }
      if (!best) break;
      zasoba[best.ti]--; pouzite.add(popisMetody(best.m));
      desky.push({ ti: best.ti, used: best.r.used, pl: best.pl });
      zbyva = best.r.zbyle;
    }
    return { v: { desky, nezarazeno: zbyva, zasoba, m: metody[0] }, vyhodnoceni, metody: [...pouzite].slice(0, 3).join(', ') };
  }

  /* ---------------- gilotinová rekonstrukce řezů ---------------- */
  /**
   * dily: [{x,y,w,h,...}] reálné souřadnice. Vrací {ok, rezy:[{o:'H'|'V', p, kus:{x,y,w,h}, typ, stupen}], listy:[{x,y,w,h,dil}], stupnu}
   * řez o='H' = vodorovná čára (podélný řez, podél délky desky) v pásu y∈[p, p+k]; 'V' = svislá (příčný) x∈[p, p+k].
   */
  function rekonstruuj(W, H, dily, k, okr, prvni) {
    const rezy = [], listy = [];
    let ok = true, stupnu = 0;
    let R = { x: 0, y: 0, w: W, h: H };
    if (okr > EPS) {
      rezy.push({ o: 'H', p: okr - k, kus: Object.assign({}, R), typ: 'zarovnani', stupen: 0 });
      if (okr - k > EPS) listy.push({ x: 0, y: 0, w: W, h: okr - k, dil: null, okraj: true });
      R = { x: 0, y: okr, w: W, h: H - okr };
      rezy.push({ o: 'V', p: okr - k, kus: Object.assign({}, R), typ: 'zarovnani', stupen: 0 });
      if (okr - k > EPS) listy.push({ x: 0, y: okr, w: okr - k, h: H - okr, dil: null, okraj: true });
      R = { x: okr, y: okr, w: W - okr, h: H - okr };
    }
    const druhy = (o) => (o === 'H' ? 'V' : 'H');
    const shoda = (p, r) => Math.abs(p.x - r.x) <= 1e-4 && Math.abs(p.y - r.y) <= 1e-4 && Math.abs(p.w - r.w) <= 1e-4 && Math.abs(p.h - r.h) <= 1e-4;
    function najdi(R, P, o) {
      const iv = P.map((q) => (o === 'H' ? [q.y, q.y + q.h] : [q.x, q.x + q.w])).sort((a, b) => a[0] - b[0]);
      const r0 = o === 'H' ? R.y : R.x, r1 = o === 'H' ? R.y + R.h : R.x + R.w;
      const sk = [];
      for (const [s, e] of iv) {
        const g = sk[sk.length - 1];
        if (g && s < g[1] + k - 1e-4) g[1] = Math.max(g[1], e); else sk.push([s, e]);
      }
      const c = [];
      if (sk[0][0] - r0 >= k - 1e-4 && sk[0][0] - r0 > 1e-4) c.push(sk[0][0] - k);
      for (let i = 0; i < sk.length - 1; i++) c.push(sk[i][1]);
      if (r1 - sk[sk.length - 1][1] > 1e-4) c.push(sk[sk.length - 1][1]);
      return c;
    }
    function uvnitr(q, r) { const cx = q.x + q.w / 2, cy = q.y + q.h / 2; return cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h; }
    function rozdel(R, P, o, st) {
      if (!P.length) { listy.push(Object.assign({}, R, { dil: null })); return; }
      if (P.length === 1 && shoda(P[0], R)) { listy.push(Object.assign({}, R, { dil: P[0] })); return; }
      for (const oo of [o, druhy(o)]) {
        const c = najdi(R, P, oo);
        if (!c.length) continue;
        stupnu = Math.max(stupnu, st);
        let zb = Object.assign({}, R);
        for (const p of c) {
          rezy.push({ o: oo, p, kus: Object.assign({}, zb), typ: 'rez', stupen: st });
          const dol = oo === 'H' ? { x: zb.x, y: zb.y, w: zb.w, h: p - zb.y } : { x: zb.x, y: zb.y, w: p - zb.x, h: zb.h };
          const hor = oo === 'H' ? { x: zb.x, y: p + k, w: zb.w, h: zb.y + zb.h - p - k } : { x: p + k, y: zb.y, w: zb.x + zb.w - p - k, h: zb.h };
          if (dol.w > 1e-4 && dol.h > 1e-4) rozdel(dol, P.filter((q) => uvnitr(q, dol)), druhy(oo), st + 1);
          if (hor.w <= 1e-4 || hor.h <= 1e-4) { zb = null; break; }
          zb = hor;
        }
        if (zb) rozdel(zb, P.filter((q) => uvnitr(q, zb)), druhy(oo), st + 1);
        return;
      }
      ok = false;
      for (const q of P) listy.push(Object.assign({}, q, { dil: q, chyba: true }));
    }
    const P0 = dily.filter((q) => uvnitr(q, R));
    if (P0.length !== dily.length) ok = false;
    if (!P0.length) listy.push(Object.assign({}, R, { dil: null }));
    else rozdel(R, P0, prvni === 'V' ? 'V' : 'H', 1);
    rezy.forEach((r, i) => { r.n = i + 1; });
    return { ok, rezy, listy, stupnu };
  }

  /** maximální volné obdélníky po odečtení dílců (zvětšených o prořez ze všech stran) – pro volné uložení */
  function volneZbytky(oblast, dily, k, minS, minPl, max) {
    let free = [Object.assign({}, oblast)];
    for (const q of dily) free = rozdelVolne(free, { x: q.x - k, y: q.y - k, w: q.w + 2 * k, h: q.h + 2 * k }, minS);
    const out = [];
    while (out.length < (max || 6)) {
      free.sort((a, b) => b.w * b.h - a.w * a.h);
      const f = free.find((q) => q.w >= minS && q.h >= minS && q.w * q.h / 1e6 >= minPl);
      if (!f) break;
      const z = { x: f.x, y: f.y, w: f.w, h: f.h, dil: null, pouzitelny: true };
      out.push(z);
      free = rozdelVolne(free, { x: z.x - k, y: z.y - k, w: z.w + 2 * k, h: z.h + 2 * k }, minS);
    }
    return out;
  }

  /* ---------------- 2D – celý výpočet ---------------- */
  function vypocet2D(pr, o) {
    o = o || {};
    const n = pr.nast, k = Math.max(0, cislo(n.rez, 0)), hm = mapaHran(pr), chyby = [], skupiny = [];
    const vsechnyDesky = (pr.desky || []).concat(o.zbytky || []);
    const mats = [];
    for (const d of pr.dilce || []) { const m = normMat(d.material); if (!mats.includes(m)) mats.push(m); }
    let celkemPolozek = 0;
    for (const d of pr.dilce || []) celkemPolozek += Math.max(0, Math.round(cislo(d.ks, 0)));
    for (const mat of mats) {
      const typy = vsechnyDesky.filter((t) => normMat(t.material) === mat && cislo(t.w, 0) > 0 && cislo(t.h, 0) > 0 && (t.ks == null || t.ks === '' || cislo(t.ks, 0) > 0));
      const dilce = [];
      (pr.dilce || []).forEach((d, di) => { if (normMat(d.material) === mat) dilce.push(di); });
      const nazevMat = (pr.dilce[dilce[0]] || {}).material || mat;
      const okr = efOkraj(cislo(n.okraj, 0), k);
      const sGrain = typy.some((t) => t.vlakna);
      const cenaDef = typy.some((t) => !t.zbytek && cislo(t.cena, 0) > 0);
      const sklad = typy.map((t) => {
        const W = cislo(t.w, 0), H = cislo(t.h, 0);
        const ks = t.ks == null || t.ks === '' ? null : Math.max(0, Math.round(cislo(t.ks, 0)));
        const cenaEf = t.zbytek ? Math.max(0, cislo(t.cena, 0)) + W * H * 1e-12 : (cenaDef ? Math.max(0, cislo(t.cena, 0)) : W * H / 1e6);
        return { t, W, H, Wi: W - 2 * okr + k, Hi: H - 2 * okr + k, cenaEf, ks, plocha: W * H };
      });
      const items = [], nezarazeno = [];
      for (const di of dilce) {
        const d = pr.dilce[di], ks = Math.max(0, Math.round(cislo(d.ks, 0))), rr = rozmerRezu(d, hm, n);
        const r = !(d.vlakna && sGrain);
        for (let c = 0; c < ks; c++) {
          const it = { k: items.length, di, c, rw: rr.w, rh: rr.h, w: rr.w + k, h: rr.h + k, r };
          if (rr.w <= 0 || rr.h <= 0) { nezarazeno.push({ di, c, duvod: 'neplatný rozměr' }); continue; }
          if (!sklad.length) { nezarazeno.push({ di, c, duvod: 'chybí deska pro materiál' }); continue; }
          if (!sklad.some((s) => vejdeSe(it, s.Wi, s.Hi))) { nezarazeno.push({ di, c, duvod: r ? 'nevejde se na žádnou desku' : 'nevejde se při dodržení směru vláken' }); continue; }
          items.push(it);
        }
      }
      items.forEach((it, i) => { it.k = i; });
      let vys = null;
      if (items.length && sklad.length) {
        const podil = celkemPolozek ? items.length / celkemPolozek : 1;
        vys = hledej2D(items, sklad, pr.rezim2d === 'volne' ? 'volne' : 'gilotina', {
          seed: o.seed, iteraci: o.iteraci, casMs: o.casMs != null ? o.casMs * podil : undefined,
          prubeh: o.prubeh,
        });
        for (const it of vys.v.nezarazeno) nezarazeno.push({ di: it.di, c: it.c, duvod: 'nedostatek desek na skladě' });
      }
      const desky = [];
      if (vys) {
        let cislo2 = 0;
        for (const d of vys.v.desky) {
          const s = sklad[d.ti];
          const dily = d.used.map((u) => {
            const it = items[u.k];
            return { di: it.di, c: it.c, x: okr + u.x, y: okr + u.y, w: u.w - k, h: u.h - k, rot: u.rot };
          });
          dily.sort((a, b) => a.y - b.y || a.x - b.x);
          const deska = { typ: s.t, W: s.W, H: s.H, okraj: okr, rez: k, dily, cislo: ++cislo2, cena: s.cenaEf };
          let pl = 0; for (const q of dily) pl += q.w * q.h;
          deska.plochaDilu = pl; deska.vyuziti = pl / (s.W * s.H);
          if (pr.rezim2d !== 'volne') {
            const prv = n.prvniRez === 'H' || n.prvniRez === 'V' ? [n.prvniRez] : ['H', 'V'];
            let nej = null;
            for (const p of prv) { const r = rekonstruuj(s.W, s.H, dily, k, okr, p); if (!nej || (r.ok && !nej.ok) || (r.ok === nej.ok && r.rezy.length < nej.rezy.length)) nej = r; }
            deska.rezy = nej.rezy; deska.gilotinaOk = nej.ok; deska.stupnu = nej.stupnu;
            if (!nej.ok) chyby.push(`Deska ${nazevMat} č. ${deska.cislo}: uložení nelze rozřezat gilotinovými řezy.`);
            deska.zbytky = nej.listy.filter((l) => !l.dil && !l.okraj).map((l) => ({ x: l.x, y: l.y, w: l.w, h: l.h }));
          } else {
            deska.rezy = [];
            deska.zbytky = volneZbytky({ x: okr, y: okr, w: s.W - 2 * okr, h: s.H - 2 * okr }, dily, k, cislo(n.minZbytekStrana, 150), cislo(n.minZbytekPlocha, 0.05), 6);
          }
          for (const z of deska.zbytky) z.pouzitelny = Math.min(z.w, z.h) >= cislo(n.minZbytekStrana, 150) - EPS && z.w * z.h / 1e6 >= cislo(n.minZbytekPlocha, 0) - EPS;
          desky.push(deska);
        }
      }
      let cena = 0, plDesek = 0, plDilu = 0;
      for (const d of desky) { cena += d.typ.zbytek ? cislo(d.typ.cena, 0) : cislo(d.typ.cena, 0); plDesek += d.W * d.H; plDilu += d.plochaDilu; }
      skupiny.push({ material: nazevMat, desky, nezarazeno, cena, plochaDesek: plDesek, plochaDilu: plDilu, vyuziti: plDesek ? plDilu / plDesek : 0,
        metoda: vys ? vys.metoda : '', vyhodnoceni: vys ? vys.vyhodnoceni : 0, ms: vys ? vys.ms : 0, okraj: okr, rez: k, vlakna: sGrain });
    }
    return { skupiny, chyby, hrany: spotrebaHran(pr) };
  }

  /* ---------------- kontroly (pro testy i pro UI) ---------------- */
  /** vrací seznam chyb: mimo desku/okraj, překryv (mezera < prořez), nepovolené otočení, nesedí počty */
  function kontrola2D(pr, vys) {
    const ch = [], hm = mapaHran(pr), n = pr.nast;
    const pocty = {};
    for (const sk of vys.skupiny) {
      for (const d of sk.desky) {
        const o = d.okraj, k = d.rez;
        d.dily.forEach((q, i) => {
          pocty[q.di] = (pocty[q.di] || 0) + 1;
          if (q.x < o - 1e-6 || q.y < o - 1e-6 || q.x + q.w > d.W - o + 1e-6 || q.y + q.h > d.H - o + 1e-6) ch.push(`deska ${d.cislo}: dílec ${i} mimo užitnou plochu`);
          const D = pr.dilce[q.di], rr = rozmerRezu(D, hm, n);
          const ew = q.rot ? rr.h : rr.w, eh = q.rot ? rr.w : rr.h;
          if (Math.abs(q.w - ew) > 1e-6 || Math.abs(q.h - eh) > 1e-6) ch.push(`deska ${d.cislo}: dílec ${i} má jiný rozměr`);
          if (q.rot && D.vlakna && sk.vlakna) ch.push(`deska ${d.cislo}: dílec ${i} otočen proti směru vláken`);
          for (let j = i + 1; j < d.dily.length; j++) {
            const p = d.dily[j];
            const mx = Math.max(p.x - (q.x + q.w), q.x - (p.x + p.w)), my = Math.max(p.y - (q.y + q.h), q.y - (p.y + p.h));
            if (mx < k - 1e-6 && my < k - 1e-6) ch.push(`deska ${d.cislo}: dílce ${i} a ${j} se překrývají nebo nemají mezeru na řez`);
          }
        });
      }
      for (const q of sk.nezarazeno) pocty[q.di] = (pocty[q.di] || 0) + 1;
    }
    (pr.dilce || []).forEach((d, i) => { const ks = Math.max(0, Math.round(cislo(d.ks, 0))); if ((pocty[i] || 0) !== ks) ch.push(`dílec ${i}: počet ${pocty[i] || 0} ≠ ${ks}`); });
    return ch;
  }
  /** simulace řezů: každý řez musí dělit celý existující kus od hrany ke hraně a neprojít dílcem; na konci je každý dílec samostatný kus */
  function simulujRezy(d) {
    const ch = [], k = d.rez;
    let kusy = [{ x: 0, y: 0, w: d.W, h: d.H }];
    const shoda = (a, b) => Math.abs(a.x - b.x) <= 1e-4 && Math.abs(a.y - b.y) <= 1e-4 && Math.abs(a.w - b.w) <= 1e-4 && Math.abs(a.h - b.h) <= 1e-4;
    for (const r of d.rezy) {
      const i = kusy.findIndex((q) => shoda(q, r.kus));
      if (i < 0) { ch.push(`řez ${r.n}: kus, který má dělit, neexistuje (řez nejde přes celý kus)`); continue; }
      const q = kusy[i];
      const lo = r.o === 'H' ? q.y : q.x, hi = r.o === 'H' ? q.y + q.h : q.x + q.w;
      if (r.p < lo - 1e-4 || r.p > hi - 1e-4) { ch.push(`řez ${r.n}: mimo kus`); continue; }
      for (const p of d.dily) {
        const a0 = r.o === 'H' ? p.y : p.x, a1 = r.o === 'H' ? p.y + p.h : p.x + p.w;
        const b0 = r.o === 'H' ? p.x : p.y, b1 = r.o === 'H' ? p.x + p.w : p.y + p.h;
        const c0 = r.o === 'H' ? q.x : q.y, c1 = r.o === 'H' ? q.x + q.w : q.y + q.h;
        if (a1 > r.p + 1e-4 && a0 < r.p + k - 1e-4 && b1 > c0 + 1e-4 && b0 < c1 - 1e-4) ch.push(`řez ${r.n}: prochází dílcem`);
      }
      kusy.splice(i, 1);
      const dol = r.o === 'H' ? { x: q.x, y: q.y, w: q.w, h: r.p - q.y } : { x: q.x, y: q.y, w: r.p - q.x, h: q.h };
      const hor = r.o === 'H' ? { x: q.x, y: r.p + k, w: q.w, h: q.y + q.h - r.p - k } : { x: r.p + k, y: q.y, w: q.x + q.w - r.p - k, h: q.h };
      for (const z of [dol, hor]) if (z.w > 1e-4 && z.h > 1e-4) kusy.push(z);
    }
    for (const p of d.dily) if (!kusy.some((q) => shoda(q, p))) ch.push(`dílec ${p.di}/${p.c} není po řezech samostatný kus`);
    return { chyby: ch, kusy };
  }

  /* ================================================================
     1D – dělení tyčí
     položka s = délka + prořez, kapacita C = L − okraj + prořez
     ================================================================ */
  function ffd(items, typy, ti, bestFit) {
    const tyce = [];
    for (const it of items) {
      let kam = -1, nej = Infinity;
      for (let i = 0; i < tyce.length; i++) {
        const zb = tyce[i].zb - it.s;
        if (zb >= -EPS) { if (!bestFit) { kam = i; break; } if (zb < nej) { nej = zb; kam = i; } }
      }
      if (kam < 0) { if (typy[ti].C < it.s - EPS) return null; tyce.push({ ti, zb: typy[ti].C, kusy: [] }); kam = tyce.length - 1; }
      tyce[kam].kusy.push(it); tyce[kam].zb -= it.s;
    }
    return tyce;
  }
  /** omezená batohová úloha (celé mm, délky zaokrouhleny nahoru → vždy proveditelné) */
  function batoh(zbyva, C, vynutit) {
    const cap = Math.floor(C + EPS);
    const skup = new Map();
    for (const it of zbyva) { const w = Math.ceil(it.s - 1e-7); if (!skup.has(w)) skup.set(w, []); skup.get(w).push(it); }
    let zaklad = 0; const pevne = [];
    let capZ = cap;
    if (vynutit) { const w = Math.ceil(vynutit.s - 1e-7); capZ -= w; if (capZ < 0) return null; pevne.push(vynutit); skup.get(w).splice(skup.get(w).indexOf(vynutit), 1); zaklad = w; }
    const pol = [];   // binární rozklad
    for (const [w, L] of [...skup.entries()].sort((a, b) => b[0] - a[0])) {
      let c = L.length, m = 1;
      while (c > 0) { const q = Math.min(m, c); pol.push({ w: w * q, n: q, sk: w }); c -= q; m *= 2; }
    }
    const dp = new Float64Array(capZ + 1).fill(-1); dp[0] = 0;
    const vol = pol.map(() => new Uint8Array(capZ + 1));
    for (let i = 0; i < pol.length; i++) {
      const w = pol[i].w; if (w > capZ) continue;
      const V = vol[i];
      for (let c = capZ; c >= w; c--) if (dp[c - w] >= 0 && dp[c - w] + w > dp[c]) { dp[c] = dp[c - w] + w; V[c] = 1; }
    }
    let c = 0; for (let i = 1; i <= capZ; i++) if (dp[i] > dp[c]) c = i;
    const pocty = new Map();
    for (let i = pol.length - 1; i >= 0; i--) if (c >= 0 && vol[i][c]) { pocty.set(pol[i].sk, (pocty.get(pol[i].sk) || 0) + pol[i].n); c -= pol[i].w; }
    const vyber = pevne.slice();
    for (const [w, q] of pocty) vyber.push(...skup.get(w).slice(0, q));
    return { kusy: vyber, vyuzito: dp.reduce((a, b) => Math.max(a, b), 0) + zaklad };
  }
  function shp(items, typy, varianta) {
    let zbyva = items.slice().sort((a, b) => b.s - a.s);
    const zasoba = typy.map((t) => (t.ks == null ? Infinity : t.ks)), tyce = [];
    while (zbyva.length) {
      let best = null;
      for (let ti = 0; ti < typy.length; ti++) {
        if (zasoba[ti] <= 0 || typy[ti].C < zbyva[zbyva.length - 1].s - EPS) continue;
        const vyn = varianta === 'nejdelsi' ? zbyva.find((q) => q.s <= typy[ti].C + EPS) : null;
        const b = batoh(zbyva, typy[ti].C, vyn);
        if (!b || !b.kusy.length) continue;
        let L = 0; for (const q of b.kusy) L += q.s;
        const sk = typy[ti].cenaEf / L;
        if (!best || sk < best.sk - 1e-12 || (Math.abs(sk - best.sk) <= 1e-12 && L > best.L)) best = { ti, b, sk, L };
      }
      if (!best) break;
      zasoba[best.ti]--;
      tyce.push({ ti: best.ti, kusy: best.b.kusy, zb: typy[best.ti].C - best.L });
      const pryc = new Set(best.b.kusy);
      zbyva = zbyva.filter((q) => !pryc.has(q));
    }
    return { tyce, nezarazeno: zbyva };
  }
  /** každou tyč převede na nejlevnější dostupný typ, do kterého se vejde */
  function zmensi1D(res, typy) {
    const zasoba = typy.map((t) => (t.ks == null ? Infinity : t.ks));
    for (const t of res.tyce) zasoba[t.ti]--;
    const poradi = res.tyce.slice().sort((a, b) => (typy[b.ti].C - b.zb) - (typy[a.ti].C - a.zb));
    for (const t of poradi) {
      let pouz = 0; for (const q of t.kusy) pouz += q.s;
      let nej = t.ti;
      for (let ti = 0; ti < typy.length; ti++) {
        if (ti === t.ti || zasoba[ti] <= 0 || typy[ti].C < pouz - EPS) continue;
        if (typy[ti].cenaEf < typy[nej].cenaEf - 1e-9 || (Math.abs(typy[ti].cenaEf - typy[nej].cenaEf) <= 1e-9 && typy[ti].C < typy[nej].C)) nej = ti;
      }
      if (nej !== t.ti) { zasoba[t.ti]++; zasoba[nej]--; t.ti = nej; t.zb = typy[nej].C - pouz; }
    }
    return res;
  }
  function hodnot1D(res, typy) {
    let cena = 0, u = 0;
    for (const t of res.tyce) { cena += typy[t.ti].cenaEf; const q = 1 - t.zb / typy[t.ti].C; u += q * q; }
    return { nez: res.nezarazeno.length, cena, n: res.tyce.length, u };
  }
  /** přesné větvení a mezí (malé úlohy) – minimalizuje cenu; vrací null při překročení limitu uzlů */
  function presne1D(items, typy, horni, limit, druhotne) {
    const s = items.slice().sort((a, b) => b.s - a.s), n = s.length;
    const zbSum = new Float64Array(n + 1); for (let i = n - 1; i >= 0; i--) zbSum[i] = zbSum[i + 1] + s[i].s;
    let minJ = Infinity; for (const t of typy) minJ = Math.min(minJ, t.cenaEf / t.C);
    const zasoba = typy.map((t) => (t.ks == null ? Infinity : t.ks));
    let best = horni, bestTyce = null, uzlu = 0, preruseno = false, bestU = druhotne ? druhotne.u : -1;
    const tyce = [];
    let cena = 0, volno = 0;
    (function rek(i) {
      if (preruseno) return;
      if (++uzlu > limit) { preruseno = true; return; }
      if (i === n) {
        let u = 0;
        if (druhotne) for (const t of tyce) { const q = 1 - t.zb / typy[t.ti].C; u += q * q; }
        if (cena < best - 1e-9 || (druhotne && cena <= best + 1e-9 && u > bestU + 1e-9)) { best = cena; bestU = u; bestTyce = tyce.map((t) => ({ ti: t.ti, zb: t.zb, kusy: t.kusy.slice() })); }
        return;
      }
      const lb = cena + Math.max(0, zbSum[i] - volno) * minJ;
      if (druhotne ? lb > best + 1e-9 : lb >= best - 1e-9) return;
      const it = s[i], videno = new Set();
      const kand = tyce.map((t, j) => j).filter((j) => tyce[j].zb >= it.s - EPS).sort((a, b) => tyce[a].zb - tyce[b].zb);
      for (const j of kand) {
        const t = tyce[j], kl = t.ti + ':' + Math.round(t.zb * 1000);
        if (videno.has(kl)) continue; videno.add(kl);
        t.zb -= it.s; t.kusy.push(it); volno -= it.s;
        rek(i + 1);
        t.zb += it.s; t.kusy.pop(); volno += it.s;
      }
      for (let ti = 0; ti < typy.length; ti++) {
        if (zasoba[ti] <= 0 || typy[ti].C < it.s - EPS) continue;
        zasoba[ti]--; tyce.push({ ti, zb: typy[ti].C - it.s, kusy: [it] }); cena += typy[ti].cenaEf; volno += typy[ti].C - it.s;
        rek(i + 1);
        tyce.pop(); zasoba[ti]++; cena -= typy[ti].cenaEf; volno -= typy[ti].C - it.s;
      }
    })(0);
    return { tyce: bestTyce, optimalni: !preruseno, uzlu };
  }

  function vypocet1D(pr, o) {
    o = o || {};
    const n = pr.nast, k = Math.max(0, cislo(n.rez1D, 0)), okr = efOkraj(cislo(n.okraj1D, 0), k), skupiny = [];
    const prof = [];
    for (const q of pr.kusy1D || []) { const m = normMat(q.profil); if (!prof.includes(m)) prof.push(m); }
    const R = rng(o.seed || 777), t0 = Date.now();
    for (const pm of prof) {
      const kusy = []; (pr.kusy1D || []).forEach((q, i) => { if (normMat(q.profil) === pm) kusy.push(i); });
      const nazevProf = pr.kusy1D[kusy[0]].profil || '';
      const src = (pr.polotovary1D || []).filter((t) => normMat(t.profil) === pm && cislo(t.L, 0) > 0 && (t.ks == null || t.ks === '' || cislo(t.ks, 0) > 0));
      const cenaDef = src.some((t) => cislo(t.cena, 0) > 0);
      const typy = src.map((t) => {
        const L = cislo(t.L, 0), ks = t.ks == null || t.ks === '' ? null : Math.max(0, Math.round(cislo(t.ks, 0)));
        return { t, L, C: L - okr + k, ks, cenaEf: cenaDef ? Math.max(0, cislo(t.cena, 0)) + L * 1e-9 : L / 1000 };
      });
      const items = [], nezarazeno = [];
      for (const qi of kusy) {
        const q = pr.kusy1D[qi], ks = Math.max(0, Math.round(cislo(q.ks, 0))), L = cislo(q.L, 0);
        for (let c = 0; c < ks; c++) {
          if (L <= 0) { nezarazeno.push({ qi, c, duvod: 'neplatná délka' }); continue; }
          if (!typy.length) { nezarazeno.push({ qi, c, duvod: 'chybí polotovar pro profil' }); continue; }
          if (!typy.some((t) => t.C >= L + k - EPS)) { nezarazeno.push({ qi, c, duvod: 'delší než nejdelší polotovar' }); continue; }
          items.push({ qi, c, L, s: L + k });
        }
      }
      let nej = null, metoda = '', optimalni = false;
      const zkus = (res, nazev) => {
        if (!res) return;
        zmensi1D(res, typy);
        const h = hodnot1D(res, typy);
        if (!nej || porovnej(h, nej.h) < 0) { nej = { res, h }; metoda = nazev; }
      };
      if (items.length) {
        const sorted = items.slice().sort((a, b) => b.s - a.s);
        const neomez = typy.map((t, i) => i).filter((i) => typy[i].ks == null);
        for (const ti of neomez) {
          for (const bf of [false, true]) { const t = ffd(sorted, typy, ti, bf); if (t) zkus({ tyce: t, nezarazeno: [] }, bf ? 'BFD' : 'FFD'); }
        }
        zkus(shp(items, typy, 'max'), 'batoh (SHP)');
        zkus(shp(items, typy, 'nejdelsi'), 'batoh s nejdelším kusem');
        // náhodné restarty: SHP nad zamíchaným pořadím typů a FFD nad zašuměným pořadím
        const casMs = o.casMs != null ? o.casMs * 0.3 : 400, maxIt = o.iteraci != null ? Math.ceil(o.iteraci / 4) : 300;
        for (let it = 0; it < maxIt && Date.now() - t0 < casMs; it++) {
          const por = items.map((q) => [q.s * (1 + 0.3 * (R() - 0.5)), q]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
          if (neomez.length) { const ti = neomez[Math.floor(R() * neomez.length)], t = ffd(por, typy, ti, R() < 0.5); if (t) zkus({ tyce: t, nezarazeno: [] }, 'FFD + restarty'); }
        }
        // rozbij a znovu postav: několik nejhůř využitých + náhodných tyčí přesně přeřezat (větvení a meze)
        if (nej && !nej.res.nezarazeno.length && nej.res.tyce.length >= 2 && items.length > (o.presneDo || 24)) {
          const kol = o.kolRozbij1D != null ? o.kolRozbij1D : 300;
          let zlep = 0;
          for (let it = 0; it < kol && Date.now() - t0 < (o.casMs != null ? o.casMs : 1500); it++) {
            const T = nej.res.tyce;
            const por = T.map((t, i) => [t.zb / typy[t.ti].C + 0.15 * R(), i]).sort((a, b) => b[0] - a[0]);
            const vyb = new Set([por[0][1]]);
            const kolik = Math.min(T.length, 2 + Math.floor(R() * 3));
            while (vyb.size < kolik) vyb.add(R() < 0.5 ? por[Math.floor(R() * Math.min(por.length, 6))][1] : Math.floor(R() * T.length));
            const its = []; let cenaV = 0;
            for (const i of vyb) { its.push(...T[i].kusy); cenaV += typy[T[i].ti].cenaEf; }
            if (its.length > 26) continue;
            const typyZ = typy.map((t) => Object.assign({}, t));
            const zas = typy.map((t) => (t.ks == null ? Infinity : t.ks));
            T.forEach((t, i) => { if (!vyb.has(i)) zas[t.ti]--; });
            typyZ.forEach((t, i) => { t.ks = zas[i] === Infinity ? null : Math.max(0, zas[i]); });
            let uV = 0; for (const i of vyb) { const q = 1 - T[i].zb / typy[T[i].ti].C; uV += q * q; }
            const p = presne1D(its, typyZ, cenaV, 20000, { u: uV });
            if (p.tyce) {
              const res = { tyce: T.filter((t, i) => !vyb.has(i)).concat(p.tyce), nezarazeno: [] };
              const h = hodnot1D(res, typy);
              if (porovnej(h, nej.h) < 0) { nej = { res, h }; zlep++; }
            }
          }
          if (zlep) metoda += ` + přesné přeřezání skupin (${zlep}×)`;
        }
        if (items.length <= (o.presneDo || 24) && (!nej || !nej.res.nezarazeno.length)) {
          const p = presne1D(items, typy, nej ? nej.h.cena + 1e-6 : Infinity, o.limitUzlu || 400000);
          if (p.tyce) { zkus({ tyce: p.tyce, nezarazeno: [] }, 'přesně (větvení a meze)'); }
          optimalni = p.optimalni;
          if (p.optimalni && !p.tyce) metoda += ' – ověřeno jako optimální';
          else if (p.optimalni) metoda = 'přesně (větvení a meze) – optimální';
        }
      }
      const tyce = [];
      if (nej) {
        for (const nz of nej.res.nezarazeno) nezarazeno.push({ qi: nz.qi, c: nz.c, duvod: 'nedostatek polotovarů' });
        let cis = 0;
        const serazene = nej.res.tyce.map((t) => ({ t, ty: typy[t.ti] })).sort((a, b) => b.ty.L - a.ty.L || a.t.zb - b.t.zb);
        for (const { t, ty } of serazene) {
          const ks = t.kusy.slice().sort((a, b) => b.L - a.L);
          let x = okr; const kusyOut = [];
          for (const q of ks) { kusyOut.push({ qi: q.qi, c: q.c, L: q.L, x }); x += q.L + k; }
          const konec = x - k, zbytek = Math.max(0, ty.L - konec - k);
          tyce.push({ cislo: ++cis, typ: ty.t, L: ty.L, rez: k, okraj: okr, kusy: kusyOut, konec, zbytek, pouzitelny: zbytek >= cislo(n.minZbytek1D, 300) - EPS });
        }
      }
      let cena = 0, delka = 0, pouz = 0;
      for (const t of tyce) { cena += cislo(t.typ.cena, 0); delka += t.L; for (const q of t.kusy) pouz += q.L; }
      let dolniMez = 0;
      if (typy.length) { let sum = 0; for (const it of items) sum += it.s; let minJ = Infinity; for (const t of typy) minJ = Math.min(minJ, (cenaDef ? cislo(t.t.cena, 0) : t.L / 1000) / t.C); dolniMez = sum * minJ; }
      skupiny.push({ profil: nazevProf, tyce, nezarazeno, cena, delka, delkaKusu: pouz, vyuziti: delka ? pouz / delka : 0, metoda, optimalni, dolniMez, cenaDef });
    }
    return { skupiny };
  }
  function kontrola1D(pr, vys) {
    const ch = [], pocty = {};
    for (const sk of vys.skupiny) {
      for (const t of sk.tyce) {
        let sum = 0;
        t.kusy.forEach((q, i) => {
          pocty[q.qi] = (pocty[q.qi] || 0) + 1; sum += q.L;
          if (i === 0 && q.x < t.okraj - 1e-6) ch.push(`tyč ${t.cislo}: první kus zasahuje do zarovnání`);
          if (i > 0) { const p = t.kusy[i - 1]; if (q.x < p.x + p.L + t.rez - 1e-6) ch.push(`tyč ${t.cislo}: kus ${i} nemá místo na řez`); }
          if (q.x + q.L > t.L + 1e-6) ch.push(`tyč ${t.cislo}: kus ${i} přesahuje délku tyče`);
        });
        const n = t.kusy.length;
        if (n && t.okraj + sum + (n - 1) * t.rez > t.L + 1e-6) ch.push(`tyč ${t.cislo}: součet délek + řezy > délka`);
      }
      for (const q of sk.nezarazeno) pocty[q.qi] = (pocty[q.qi] || 0) + 1;
    }
    (pr.kusy1D || []).forEach((q, i) => { const ks = Math.max(0, Math.round(cislo(q.ks, 0))); if ((pocty[i] || 0) !== ks) ch.push(`kus ${i}: počet ${pocty[i] || 0} ≠ ${ks}`); });
    return ch;
  }

  /* ---------------- celý výpočet ---------------- */
  function vypocet(pr, o) {
    o = o || {};
    const t0 = Date.now();
    const d2 = vypocet2D(pr, o);
    const d1 = vypocet1D(pr, Object.assign({}, o, { casMs: o.casMs != null ? Math.max(100, o.casMs * 0.25) : undefined }));
    return { d2, d1, ms: Date.now() - t0 };
  }
  function souhrn(pr, v) {
    let cenaDesek = 0, desek = 0, plD = 0, plU = 0, rezu = 0, delkaRezu = 0, nez = 0;
    for (const s of v.d2.skupiny) {
      cenaDesek += s.cena; desek += s.desky.length; plD += s.plochaDesek; plU += s.plochaDilu; nez += s.nezarazeno.length;
      for (const d of s.desky) for (const r of d.rezy || []) { rezu++; delkaRezu += r.o === 'H' ? r.kus.w : r.kus.h; }
    }
    let cenaTyci = 0, tyci = 0, nez1 = 0;
    for (const s of v.d1.skupiny) { cenaTyci += s.cena; tyci += s.tyce.length; nez1 += s.nezarazeno.length; }
    let cenaHran = 0; for (const h of v.d2.hrany) cenaHran += h.cena;
    return { cenaDesek, desek, vyuziti: plD ? plU / plD : 0, plochaDesek: plD, plochaDilu: plU, rezu, delkaRezu, nezarazeno2D: nez, cenaTyci, tyci, nezarazeno1D: nez1, cenaHran, cenaCelkem: cenaDesek + cenaTyci + cenaHran };
  }

  /* ---------------- zbytky (sklad) ---------------- */
  /** z výsledku vybere použitelné zbytky jako nové skladové desky (směr vláken zachován: w zůstává podél x desky) */
  function noveZbytky(v) {
    const out = [], dnes = new Date().toISOString().slice(0, 10);
    for (const s of v.d2.skupiny) for (const d of s.desky) for (const z of d.zbytky || []) {
      if (!z.pouzitelny) continue;
      out.push({ id: 'Z' + Math.random().toString(36).slice(2, 8), material: d.typ.material, w: Math.floor(z.w), h: Math.floor(z.h), tl: d.typ.tl, cena: 0, ks: 1, vlakna: !!d.typ.vlakna, zbytek: true, datum: dnes, puvod: `deska ${d.cislo}` });
    }
    for (const s of v.d1.skupiny) for (const t of s.tyce) {
      if (!t.pouzitelny) continue;
      out.push({ id: 'Z' + Math.random().toString(36).slice(2, 8), nazev: `Zbytek ${Math.floor(t.zbytek)} mm`, profil: s.profil, L: Math.floor(t.zbytek), cena: 0, ks: 1, zbytek: true, jedno: true, datum: dnes, puvod: `tyč ${t.cislo}` });
    }
    return out;
  }
  /** id zbytků skladu, které výpočet použil */
  function pouziteZbytky(v) {
    const ids = [];
    for (const s of v.d2.skupiny) for (const d of s.desky) if (d.typ.zbytek && d.typ.id) ids.push(d.typ.id);
    for (const s of v.d1.skupiny) for (const t of s.tyce) if (t.typ.zbytek && t.typ.id) ids.push(t.typ.id);
    return ids;
  }

  /* ---------------- import: CSV / schránka / JSON kusovník ---------------- */
  function parsujCsv(text) {
    text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    const prvni = text.split('\n').find((l) => l.trim()) || '';
    const kandid = ['\t', ';', ','];
    let sep = ';', max = -1;
    for (const c of kandid) { const n = prvni.split(c).length - 1; if (n > max) { max = n; sep = c; } }
    const radky = []; let pole = [], s = '', uv = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (uv) { if (c === '"') { if (text[i + 1] === '"') { s += '"'; i++; } else uv = false; } else s += c; continue; }
      if (c === '"' && s === '') uv = true;
      else if (c === sep) { pole.push(s.trim()); s = ''; }
      else if (c === '\n') { pole.push(s.trim()); if (pole.some((x) => x !== '')) radky.push(pole); pole = []; s = ''; }
      else s += c;
    }
    pole.push(s.trim()); if (pole.some((x) => x !== '')) radky.push(pole);
    return radky;
  }
  const bezDia = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALIASY = {
    nazev: ['nazev', 'name', 'dil', 'popis', 'oznaceni', 'part', 'label', 'polozka', 'kus'],
    w: ['delka', 'length', 'l', 'd', 'delkamm', 'rozmer1', 'x', 'dlouha'],
    h: ['sirka', 'width', 's', 'b', 'sirkamm', 'rozmer2', 'y'],
    ks: ['ks', 'pocet', 'qty', 'quantity', 'mnozstvi', 'kusu', 'n', 'pocetks'],
    material: ['material', 'deska', 'dekor', 'materialdekor', 'profil', 'polotovar'],
    tl: ['tl', 'tloustka', 'thickness', 't'],
    vlakna: ['vlakna', 'smer', 'smervlaken', 'grain', 'drzetsmer', 'dekorsmer'],
    otacet: ['otacet', 'rotace', 'rotate', 'otoceni'],
    d1: ['d1', 'hranad1', 'hd1', 'l1', 'hranal1'], d2: ['d2', 'hranad2', 'hd2', 'l2', 'hranal2'],
    s1: ['s1', 'hranas1', 'hs1', 'w1', 'hranaw1'], s2: ['s2', 'hranas2', 'hs2', 'w2', 'hranaw2'],
    hrany: ['hrany', 'hrana', 'hranovani', 'edges'],
    pozn: ['pozn', 'poznamka', 'note', 'komentar'],
  };
  const anoNe = (v) => /^(1|a|ano|y|yes|true|x|✓|✔|pravda|ne?otacet)$/i.test(String(v || '').trim());
  /** text z CSV/schránky → {dilce, kusy1D, varovani} ; jen délka (bez šířky) → 1D kusy */
  function importTabulky(text, pr) {
    const radky = parsujCsv(text), var_ = [];
    if (!radky.length) return { dilce: [], kusy1D: [], varovani: ['prázdná tabulka'] };
    const hl = radky[0].map(bezDia);
    const sloupec = {};
    let mahl = false;
    hl.forEach((h, i) => { for (const [k, al] of Object.entries(ALIASY)) if (sloupec[k] == null && al.includes(h)) { sloupec[k] = i; mahl = true; } });
    let data = radky;
    if (mahl && (sloupec.w != null || sloupec.nazev != null)) data = radky.slice(1);
    else {
      mahl = false;
      const num = (x) => cislo(x, NaN);
      const r0 = radky[0];
      if (isFinite(num(r0[0])) && isFinite(num(r0[1]))) Object.assign(sloupec, { w: 0, h: 1, ks: 2, nazev: 3, material: 4 });
      else Object.assign(sloupec, { nazev: 0, w: 1, h: 2, ks: 3, material: 4, vlakna: 5 });
      if (r0.length >= 2 && !isFinite(num(r0[sloupec.w]))) data = radky.slice(1);
      if (r0.length === 2 || (r0.length === 3 && isFinite(num(r0[0])) && isFinite(num(r0[1])) && !isFinite(num(r0[2])))) { /* délka;ks */ }
    }
    const hm = mapaHran(pr || { hrany: [] }), prvniHrana = ((pr && pr.hrany) || [])[0];
    const hranaId = (v) => {
      v = String(v == null ? '' : v).trim(); if (!v || /^(0|ne|-|–)$/i.test(v)) return '';
      if (hm[v]) return v;
      const f = ((pr && pr.hrany) || []).find((h) => bezDia(h.nazev) === bezDia(v) || bezDia(h.id) === bezDia(v));
      if (f) return f.id;
      return prvniHrana ? prvniHrana.id : '';
    };
    const vychMat = pr && pr.desky && pr.desky[0] ? pr.desky[0].material : 'deska';
    const dilce = [], kusy1D = [];
    data.forEach((r, ri) => {
      const g = (k) => (sloupec[k] != null ? r[sloupec[k]] : undefined);
      const w = cislo(g('w'), NaN), h = cislo(g('h'), NaN);
      const ks = Math.max(1, Math.round(cislo(g('ks'), 1)));
      const nazev = (g('nazev') || '').trim() || `Dílec ${ri + 1}`;
      if (!isFinite(w) || w <= 0) { var_.push(`řádek ${ri + 1}: chybí délka`); return; }
      if (!isFinite(h) || h <= 0) { kusy1D.push({ nazev, L: w, ks, profil: (g('material') || '').trim() || 'profil' }); return; }
      let material = (g('material') || '').trim();
      const tl = cislo(g('tl'), NaN);
      if (!material) material = isFinite(tl) ? `deska ${tl}` : vychMat;
      let vlakna = g('vlakna') != null ? anoNe(g('vlakna')) : false;
      if (g('otacet') != null && g('vlakna') == null) vlakna = !anoNe(g('otacet'));
      const H = { d1: hranaId(g('d1')), d2: hranaId(g('d2')), s1: hranaId(g('s1')), s2: hranaId(g('s2')) };
      const hc = g('hrany');
      if (hc != null && String(hc).trim()) {
        const t = String(hc).trim();
        const m = t.match(/^(\d)\s*[/+x×,-]\s*(\d)$/);
        const def = prvniHrana ? prvniHrana.id : '';
        if (m) { const a = +m[1], b = +m[2]; H.d1 = a >= 1 ? def : ''; H.d2 = a >= 2 ? def : ''; H.s1 = b >= 1 ? def : ''; H.s2 = b >= 2 ? def : ''; }
        else if (/^[01]{4}$/.test(t)) { ['d1', 'd2', 's1', 's2'].forEach((s, i) => { H[s] = t[i] === '1' ? def : ''; }); }
        else for (const s of ['d1', 'd2', 's1', 's2']) if (new RegExp('\\b' + s + '\\b', 'i').test(t)) H[s] = def;
      }
      dilce.push({ nazev, w, h, ks, material, vlakna, hrany: H, pozn: (g('pozn') || '').trim() });
    });
    return { dilce, kusy1D, varovani: var_ };
  }

  /**
   * JSON kusovník (formát pro napojení jiných stránek):
   * { "format": "kusovnik-v1", "zdroj": "...", "projekt": "...",
   *   "dilce": [ { "nazev", "delka", "sirka", "ks", "material", "tloustka"?, "vlakna"?: bool, "hrany"?: {"d1","d2","s1","s2"}, "pozn"? } ],
   *   "tyce":  [ { "nazev", "delka", "ks", "profil" } ],
   *   "desky"?: [ { "material", "delka", "sirka", "tloustka", "cena", "ks", "vlakna" } ],
   *   "polotovary"?: [ { "nazev", "profil", "delka", "cena", "ks" } ],
   *   "hrany_typy"?: [ { "id", "nazev", "tloustka", "sirka", "cena" } ] }
   * Přijme také pole řádků {dil?, nazev, ks, rozmer:"720 × 560 × 18 mm", material} (kusovníky jiných stránek webu).
   */
  function importKusovniku(obj) {
    const out = { dilce: [], kusy1D: [], desky: [], polotovary1D: [], hrany: [], varovani: [], projekt: '' };
    if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch (e) { out.varovani.push('neplatný JSON'); return out; } }
    if (!obj) return out;
    if (obj.verze && obj.nast && Array.isArray(obj.dilce)) {   // celý projekt této stránky
      return Object.assign(out, { projektCely: obj });
    }
    const radky = Array.isArray(obj) ? obj : (obj.dilce || obj.kusovnik || obj.polozky || obj.parts || []);
    out.projekt = obj.projekt || obj.nazev || '';
    const doH = (H) => ({ d1: (H && H.d1) || '', d2: (H && H.d2) || '', s1: (H && H.s1) || '', s2: (H && H.s2) || '' });
    for (const r of radky) {
      const nazev = String(r.nazev || r.name || r.dil || 'Dílec');
      const ks = Math.max(1, Math.round(cislo(r.ks != null ? r.ks : r.pocet != null ? r.pocet : r.qty, 1)));
      let L = cislo(r.delka != null ? r.delka : r.length != null ? r.length : r.L, NaN);
      let W = cislo(r.sirka != null ? r.sirka : r.width != null ? r.width : r.W, NaN);
      let t = cislo(r.tloustka != null ? r.tloustka : r.tl != null ? r.tl : r.thickness, NaN);
      let kulaty = false;
      if (!isFinite(L) && r.rozmer) {
        const m = String(r.rozmer).match(/\d+(?:[.,]\d+)?/g) || [];
        const c = m.map((x) => cislo(x, NaN));
        kulaty = /Ø|⌀|prum/i.test(String(r.rozmer));
        if (c.length >= 3) { L = c[0]; W = c[1]; t = c[2]; } else if (c.length === 2) { if (kulaty) { t = c[0]; L = c[1]; W = NaN; } else { L = c[0]; W = c[1]; } } else if (c.length === 1) L = c[0];
      }
      if (!isFinite(L) || L <= 0) { out.varovani.push(`${nazev}: chybí délka`); continue; }
      const mat = String(r.material || r.materal || '').trim();
      const jeDeska = isFinite(W) && W > 0 && (!isFinite(t) || (W >= 40 && W / t >= 3.5 && t <= 50));
      if (jeDeska && !kulaty) {
        out.dilce.push({ nazev, w: L, h: W, ks, material: mat ? (isFinite(t) && !new RegExp('\\b' + t + '\\b').test(mat) ? `${mat} ${t}` : mat) : (isFinite(t) ? `deska ${t}` : 'deska'), vlakna: !!(r.vlakna || r.grain), hrany: doH(r.hrany), pozn: String(r.pozn || r.poznamka || '') });
      } else {
        const profil = String(r.profil || '') || (kulaty ? `${mat || 'tyč'} Ø${t}` : isFinite(W) && isFinite(t) ? `${mat || 'hranol'} ${W}×${t}` : mat || 'profil');
        out.kusy1D.push({ nazev, L, ks, profil });
      }
    }
    for (const r of obj.tyce || []) {
      const L = cislo(r.delka != null ? r.delka : r.L, NaN);
      if (isFinite(L) && L > 0) out.kusy1D.push({ nazev: String(r.nazev || 'Kus'), L, ks: Math.max(1, Math.round(cislo(r.ks, 1))), profil: String(r.profil || 'profil') });
    }
    for (const r of obj.desky || []) out.desky.push({ material: String(r.material || 'deska'), w: cislo(r.delka != null ? r.delka : r.w, 2800), h: cislo(r.sirka != null ? r.sirka : r.h, 2070), tl: cislo(r.tloustka != null ? r.tloustka : r.tl, 18), cena: cislo(r.cena, 0), ks: r.ks == null ? null : cislo(r.ks, null), vlakna: !!r.vlakna, zbytek: false });
    for (const r of obj.polotovary || []) out.polotovary1D.push({ nazev: String(r.nazev || ''), profil: String(r.profil || 'profil'), L: cislo(r.delka != null ? r.delka : r.L, 6000), cena: cislo(r.cena, 0), ks: r.ks == null ? null : cislo(r.ks, null) });
    for (const r of obj.hrany_typy || []) out.hrany.push({ id: String(r.id || r.nazev), nazev: String(r.nazev || r.id), tl: cislo(r.tloustka != null ? r.tloustka : r.tl, 1), sirka: cislo(r.sirka, 22), cena: cislo(r.cena, 0) });
    return out;
  }
  function exportKusovniku(pr) {
    return {
      format: 'kusovnik-v1', zdroj: 'Řezný plán', projekt: pr.nazev || '',
      dilce: (pr.dilce || []).map((d) => ({ nazev: d.nazev, delka: d.w, sirka: d.h, ks: d.ks, material: d.material, vlakna: !!d.vlakna, hrany: d.hrany, pozn: d.pozn || '' })),
      tyce: (pr.kusy1D || []).map((q) => ({ nazev: q.nazev, delka: q.L, ks: q.ks, profil: q.profil })),
      desky: (pr.desky || []).map((d) => ({ material: d.material, delka: d.w, sirka: d.h, tloustka: d.tl, cena: d.cena, ks: d.ks, vlakna: !!d.vlakna })),
      polotovary: (pr.polotovary1D || []).map((t) => ({ nazev: t.nazev, profil: t.profil, delka: t.L, cena: t.cena, ks: t.ks })),
      hrany_typy: (pr.hrany || []).map((h) => ({ id: h.id, nazev: h.nazev, tloustka: h.tl, sirka: h.sirka, cena: h.cena })),
    };
  }
  /** doplní chybějící materiály/profily do skladu (typický formát, editovatelné) */
  function doplnSklad(pr) {
    const pridano = [];
    for (const d of pr.dilce) if (!pr.desky.some((t) => normMat(t.material) === normMat(d.material))) {
      const tl = cislo((String(d.material).match(/(\d+(?:[.,]\d+)?)\s*(mm)?\s*$/) || [])[1], 18);
      const f = /prekl|překl|plywood/i.test(d.material) ? FORMATY[4] : FORMATY[0];
      pr.desky.push({ id: 'D' + (pr.desky.length + 1) + Math.random().toString(36).slice(2, 5), material: d.material, w: f.w, h: f.h, tl, cena: 0, ks: null, vlakna: !!d.vlakna, zbytek: false });
      pridano.push(d.material);
    }
    for (const q of pr.kusy1D) if (!pr.polotovary1D.some((t) => normMat(t.profil) === normMat(q.profil))) {
      pr.polotovary1D.push({ id: 'T' + (pr.polotovary1D.length + 1) + Math.random().toString(36).slice(2, 5), nazev: `${q.profil} / 6 m`, profil: q.profil, L: Math.max(6000, Math.ceil(cislo(q.L, 0) / 1000) * 1000), cena: 0, ks: null });
      pridano.push(q.profil);
    }
    return pridano;
  }

  const API = {
    EPS, rng, cislo, fmt, normMat, efOkraj, kopie, FORMATY, PROFILY, PREDVOLBY, predvolba, vychoziProjekt, vychoziNastaveni,
    mapaHran, rozmerRezu, spotrebaHran,
    maxRects, maxRectsGlobal, gilotina, skyline, zabal, zabalSkupinu, hledej2D, METODY_GIL, METODY_VOLNE, popisMetody,
    rekonstruuj, volneZbytky, vypocet2D, kontrola2D, simulujRezy,
    ffd, batoh, shp, presne1D, vypocet1D, kontrola1D,
    vypocet, souhrn, noveZbytky, pouziteZbytky,
    parsujCsv, importTabulky, importKusovniku, exportKusovniku, doplnSklad,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  koren.RP = API;
})(typeof window !== 'undefined' ? window : globalThis);
