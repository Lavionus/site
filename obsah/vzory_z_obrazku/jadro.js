/* Vzory z obrázku – křížková výšivka, zažehlovací korálky, mozaika. Jádro bez DOM (test: _test/vzory_z_obrazku_test.js).
   Barvy se porovnávají v CIE Lab (D65, sRGB), vzdálenost ΔE 2000 nebo CIE76. Indexy vzoru ukazují do CELÉ palety (−1 = prázdné). */
(function () {
  'use strict';
  const PALETY = typeof module !== 'undefined' ? require('./palety.js') : window.VzoryPalety;

  const VERZE = 1;
  const KLIC = 'webapp_vzory_z_obrazku';

  /* Ručně stárnoucí odhady (stav k 11/2026, orientačně). */
  const PARAMETRY = {
    rok: 2026,
    pasmoM: 8,            // pasmo DMC mouline = 8 m šestipramenné příze
    pramenuVPasmu: 6,
    odpad: 0.3,           // rezerva na zapošívání, začátky a přejezdy (+30 %)
    baleniKoralku: 1000
  };

  /* Rozteč bodu v cm podle druhu. */
  const ROZTEC = {
    aida: ct => 2.54 / ct,
    hama: 0.5, hama_mini: 0.26, perler: 0.5, artkal: 0.5
  };

  /* Symboly pro vzor – nejdřív dobře rozlišitelné tvary, pak písmena a číslice (bez záměnných O/0, I/1/l). */
  const SYMBOLY = Array.from('●▲■◆★♥✚✖○△□◇☆♡▼◀▶◐◑♣♠♦⊕⊗⊞⊠⊙∴≡※#@%&$+=?!<>ABCDEFGHJKLMNPQRSTUVWXYZ2345679abdefghkmnqrtuyΩΣΦΨΔΘΛΞΠ¤§¶©®±÷µ¥£€');

  /* ---------- palety ---------- */
  function nactiPaletu(text) {
    const vys = [], videno = new Set();
    for (const radek of String(text || '').split(/\r?\n/)) {
      const r = radek.trim(); if (!r || r[0] === ';' || r.startsWith('//')) continue;
      let kod, nazev, hex;
      if (r.includes('|')) { [kod, nazev, hex] = r.split('|').map(s => s.trim()); }
      else {
        const m = r.match(/#?([0-9a-f]{6})\b/i); if (!m) continue;
        hex = m[1];
        const zbytek = r.replace(m[0], '').trim().split(/[\s,;]+/).filter(Boolean);
        kod = zbytek[0] || '#' + hex.toUpperCase(); nazev = zbytek.slice(1).join(' ') || kod;
      }
      const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i); if (!m) continue;
      const n = parseInt(m[1], 16), rgb = [n >> 16 & 255, n >> 8 & 255, n & 255];
      if (!kod) kod = '#' + m[1].toUpperCase();
      if (videno.has(kod)) continue; videno.add(kod);
      vys.push({ kod, nazev: nazev || kod, rgb, lab: rgbNaLab(rgb[0], rgb[1], rgb[2]) });
    }
    return vys;
  }
  /* Speciální barvy korálků (průhledné, třpytivé, svítící…) – volitelně vynechat. */
  const ZVLASTNI = /transparent|glitter|neon|glow|pearl|metallic|fluo|clear|translucent|sparkl/i;
  function paleta(id, vlastni, jenPlne) {
    const p = id === 'vlastni' ? nactiPaletu(vlastni) : nactiPaletu((PALETY[id] || PALETY.dmc).data);
    return jenPlne ? p.filter(b => !ZVLASTNI.test(b.nazev)) : p;
  }

  /* ---------- barvy ---------- */
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function rgbNaLab(r, g, b) {
    const R = lin(r), G = lin(g), B = lin(b);
    const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    const y = (R * 0.2126729 + G * 0.7151522 + B * 0.0721750);
    const z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
    const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
    const fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function deltaE76(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  /* CIEDE2000 podle Sharma, Wu, Dalal (2005), kL = kC = kH = 1. */
  function deltaE00(l1, l2) {
    const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
    const RAD = Math.PI / 180, P7 = Math.pow(25, 7);
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cs = (C1 + C2) / 2;
    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cs, 7) / (Math.pow(Cs, 7) + P7)));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const h = (b, a) => { if (a === 0 && b === 0) return 0; const u = Math.atan2(b, a) / RAD; return u < 0 ? u + 360 : u; };
    const h1p = h(b1, a1p), h2p = h(b2, a2p);
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dhp = 0;
    if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * RAD / 2);
    const Lp = (L1 + L2) / 2, Cp = (C1p + C2p) / 2;
    let hp = h1p + h2p;
    if (C1p * C2p !== 0) {
      if (Math.abs(h1p - h2p) <= 180) hp /= 2;
      else hp = h1p + h2p < 360 ? (hp + 360) / 2 : (hp - 360) / 2;
    }
    const T = 1 - 0.17 * Math.cos((hp - 30) * RAD) + 0.24 * Math.cos(2 * hp * RAD) + 0.32 * Math.cos((3 * hp + 6) * RAD) - 0.20 * Math.cos((4 * hp - 63) * RAD);
    const dTh = 30 * Math.exp(-Math.pow((hp - 275) / 25, 2));
    const Rc = 2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + P7));
    const Sl = 1 + 0.015 * Math.pow(Lp - 50, 2) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
    const Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T;
    const Rt = -Math.sin(2 * dTh * RAD) * Rc;
    const x = dLp / Sl, y = dCp / Sc, z = dHp / Sh;
    return Math.sqrt(x * x + y * y + z * z + Rt * y * z);
  }
  /* Index nejbližší barvy palety k barvě v Lab; `povolene` = volitelný seznam indexů. */
  function nejblizsiBarva(lab, pal, metrika, povolene) {
    const d = metrika === 'cie76' ? deltaE76 : deltaE00;
    let nej = -1, nd = Infinity;
    const projdi = i => { const v = d(lab, pal[i].lab); if (v < nd) { nd = v; nej = i; } };
    if (povolene) povolene.forEach(projdi); else for (let i = 0; i < pal.length; i++) projdi(i);
    return nej;
  }
  const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

  /* ---------- obraz ---------- */
  /* Zmenšení RGBA průměrem plochy (box filtr), průhlednost váží barvu. */
  function zmensi(px, w, h, nw, nh) {
    const out = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      const y0 = y * h / nh, y1 = (y + 1) * h / nh;
      for (let x = 0; x < nw; x++) {
        const x0 = x * w / nw, x1 = (x + 1) * w / nw;
        let r = 0, g = 0, b = 0, a = 0, plocha = 0;
        for (let sy = Math.floor(y0); sy < Math.min(h, Math.ceil(y1)); sy++) {
          const vy = Math.min(sy + 1, y1) - Math.max(sy, y0);
          for (let sx = Math.floor(x0); sx < Math.min(w, Math.ceil(x1)); sx++) {
            const v = vy * (Math.min(sx + 1, x1) - Math.max(sx, x0)), i = (sy * w + sx) * 4, va = v * px[i + 3];
            r += px[i] * va; g += px[i + 1] * va; b += px[i + 2] * va; a += va; plocha += v;
          }
        }
        const o = (y * nw + x) * 4;
        if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
        out[o + 3] = plocha ? a / plocha : 0;
      }
    }
    return out;
  }
  /* Velikost mřížky se zachováním poměru stran (šířka nebo výška zadaná, druhá dopočtená). */
  function velikostMrizky(wObr, hObr, sirka, vyska) {
    if (sirka) return { w: Math.max(1, Math.round(sirka)), h: Math.max(1, Math.round(sirka * hObr / wObr)) };
    return { w: Math.max(1, Math.round(vyska * wObr / hObr)), h: Math.max(1, Math.round(vyska)) };
  }
  const bodyZCm = (cm, roztecCm) => Math.max(1, Math.round(cm / roztecCm));
  const cmZBodu = (body, roztecCm) => body * roztecCm;

  /* ---------- kvantizace ---------- */
  function nahodne(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  /* k-means v Lab (k-means++ start, pevné semínko → stejný výsledek při stejném vstupu). */
  function kmeans(body, k, iteraci) {
    const n = body.length; if (!n) return [];
    k = Math.min(k, n);
    const rnd = nahodne(12345), st = [body[Math.floor(rnd() * n)].slice()];
    const dist = new Float64Array(n).fill(Infinity);
    while (st.length < k) {
      const c = st[st.length - 1]; let suma = 0;
      for (let i = 0; i < n; i++) { const p = body[i], d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < dist[i]) dist[i] = d; suma += dist[i]; }
      if (!suma) break;
      let t = rnd() * suma, i = 0;
      for (; i < n - 1; i++) { t -= dist[i]; if (t <= 0) break; }
      st.push(body[i].slice());
    }
    const prir = new Int32Array(n);
    for (let it = 0; it < (iteraci || 12); it++) {
      const sum = st.map(() => [0, 0, 0, 0]);
      for (let i = 0; i < n; i++) {
        const p = body[i]; let nej = 0, nd = Infinity;
        for (let j = 0; j < st.length; j++) { const c = st[j], d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < nd) { nd = d; nej = j; } }
        prir[i] = nej; const s = sum[nej]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++;
      }
      let zmena = 0;
      st.forEach((c, j) => { const s = sum[j]; if (!s[3]) return; for (let q = 0; q < 3; q++) { const v = s[q] / s[3]; zmena += Math.abs(v - c[q]); c[q] = v; } });
      if (zmena < 0.01) break;
    }
    return st.map((c, j) => ({ lab: c, vaha: prir.reduce((a, v) => a + (v === j), 0) }));
  }

  /* Převede RGBA pixely na indexy palety.
     volby: maxBarev (0 = bez omezení), dither (Floyd–Steinberg), metrika ('de2000' | 'cie76'), sila (0–1 síla ditheringu).
     Vrací { indexy: Int16Array, povolene: [indexy palety] }. */
  function kvantizuj(px, w, h, pal, maxBarev, dither, volby) {
    volby = volby || {};
    const metrika = volby.metrika || 'de2000', sila = volby.sila == null ? 1 : volby.sila;
    const n = w * h, viditelne = [];
    for (let i = 0; i < n; i++) if (px[i * 4 + 3] >= 128) viditelne.push(i);
    const cache = new Map();
    /* mezipaměť po 6 bitech na kanál (chyba ≤ 2/255, u fotek s ditheringem několikanásobné zrychlení) */
    const najdi = (r, g, b, pov) => {
      const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let v = cache.get(k);
      if (v === undefined) { v = nejblizsiBarva(rgbNaLab((r & ~3) + 1.5, (g & ~3) + 1.5, (b & ~3) + 1.5), pal, metrika, pov); cache.set(k, v); }
      return v;
    };
    let povolene = null;
    if (maxBarev > 0 && maxBarev < pal.length) {
      /* 1) k-means v Lab nad barvami obrázku, 2) středy na nejbližší barvy palety, 3) doplnit nejčastějšími barvami prostého mapování */
      const labCache = new Map(), body = [];
      for (const i of viditelne) {
        const k = (px[i * 4] << 16) | (px[i * 4 + 1] << 8) | px[i * 4 + 2];
        let l = labCache.get(k); if (!l) { l = rgbNaLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); labCache.set(k, l); }
        body.push(l);
      }
      const set = new Set();
      kmeans(body, maxBarev).sort((a, b) => b.vaha - a.vaha).forEach(c => set.add(nejblizsiBarva(c.lab, pal, metrika)));
      if (set.size < maxBarev) {
        const pocty = new Map();
        for (const i of viditelne) { const j = najdi(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); pocty.set(j, (pocty.get(j) || 0) + 1); }
        [...pocty].sort((a, b) => b[1] - a[1]).forEach(([j]) => { if (set.size < maxBarev) set.add(j); });
      }
      povolene = [...set];
      cache.clear();
    }
    const indexy = new Int16Array(n).fill(-1);
    if (!dither) {
      for (const i of viditelne) indexy[i] = najdi(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], povolene);
    } else {
      const chyba = new Float32Array(n * 3);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (px[i * 4 + 3] < 128) continue;
        const c = [0, 1, 2].map(q => Math.max(0, Math.min(255, Math.round(px[i * 4 + q] + chyba[i * 3 + q]))));
        const j = najdi(c[0], c[1], c[2], povolene); indexy[i] = j;
        const t = pal[j].rgb;
        const roznes = (dx, dy, v) => {
          const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy >= h) return;
          const o = yy * w + xx; if (px[o * 4 + 3] < 128) return;
          for (let q = 0; q < 3; q++) chyba[o * 3 + q] += (c[q] - t[q]) * v * sila;
        };
        roznes(1, 0, 7 / 16); roznes(-1, 1, 3 / 16); roznes(0, 1, 5 / 16); roznes(1, 1, 1 / 16);
      }
    }
    return { indexy, povolene: povolene || [...new Set(indexy)].filter(v => v >= 0) };
  }

  /* Osamocené body: bod, kolem kterého (8 sousedů) je nejvýš `prah` bodů stejné barvy, dostane nejčastější barvu sousedů.
     Vrací počet změněných bodů (pracuje nad kopií, výsledek zapíše do pole). */
  function odstranSiroty(indexy, w, h, prah) {
    prah = prah || 0;
    const puv = Int16Array.from(indexy); let zmen = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = puv[i]; if (v < 0) continue;
      const pocty = new Map(); let stejne = 0, sousedu = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const s = puv[yy * w + xx]; if (s < 0) continue;
        sousedu++;
        if (s === v) stejne++; else pocty.set(s, (pocty.get(s) || 0) + 1);
      }
      if (!sousedu || stejne > prah || !pocty.size) continue;
      let nej = -1, np = 0; pocty.forEach((p, s) => { if (p > np) { np = p; nej = s; } });
      indexy[i] = nej; zmen++;
    }
    return zmen;
  }
  /* Počty bodů podle barev, seřazené sestupně: [{i, pocet}]. */
  function spocitejBarvy(indexy) {
    const m = new Map();
    for (const v of indexy) if (v >= 0) m.set(v, (m.get(v) || 0) + 1);
    return [...m].map(([i, pocet]) => ({ i, pocet })).sort((a, b) => b.pocet - a.pocet || a.i - b.i);
  }
  function zamenBarvu(indexy, z, na) { let n = 0; for (let i = 0; i < indexy.length; i++) if (indexy[i] === z) { indexy[i] = na; n++; } return n; }
  /* Symbol pro každou použitou barvu – nejčastější barva dostane první (nejčitelnější) symbol. */
  function prirad(pocty) { const m = {}; pocty.forEach((p, k) => { m[p.i] = SYMBOLY[k % SYMBOLY.length] + (k >= SYMBOLY.length ? Math.floor(k / SYMBOLY.length) : ''); }); return m; }

  /* ---------- tisk po listech ---------- */
  /* Kolik bodů se vejde na list (rozměry v mm). */
  function kapacitaListu(sirkaMm, vyskaMm, okrajMm, hlavickaMm, bunkaMm) {
    return { sloupcu: Math.max(1, Math.floor((sirkaMm - 2 * okrajMm) / bunkaMm)), radku: Math.max(1, Math.floor((vyskaMm - 2 * okrajMm - hlavickaMm) / bunkaMm)) };
  }
  /* Rozdělí mřížku w×h na listy po `sloupcu`×`radku` bodech; sousední listy se překrývají o `presah` bodů.
     Vrací [{cislo, radek, sloupec, x0, y0, x1, y1}] (x1/y1 výlučně), číslováno po řádcích zleva doprava. */
  function rozdelNaListy(w, h, sloupcu, radku, presah) {
    presah = Math.max(0, Math.min(presah || 0, sloupcu - 1, radku - 1));
    const zacatky = (celk, kus) => { const z = [0]; while (z[z.length - 1] + kus < celk) z.push(z[z.length - 1] + kus - presah); return z; };
    const xs = zacatky(w, sloupcu), ys = zacatky(h, radku), listy = [];
    ys.forEach((y0, r) => xs.forEach((x0, s) => listy.push({ cislo: listy.length + 1, radek: r + 1, sloupec: s + 1, x0, y0, x1: Math.min(w, x0 + sloupcu), y1: Math.min(h, y0 + radku) })));
    return listy;
  }

  /* ---------- spotřeba ---------- */
  /* Celý křížek: dvě úhlopříčky líc + dva svislé přejezdy rub = (2√2 + 2) × strana čtverečku, plus odpad. */
  function spotrebaPasem(stehu, ct, vlaken) {
    const strana = 2.54 / ct, naSteh = (2 * Math.SQRT2 + 2) * strana * (1 + PARAMETRY.odpad) * vlaken; // cm jednoho pramene × vláken
    const pasmoCm = PARAMETRY.pasmoM * 100 * PARAMETRY.pramenuVPasmu;
    const delkaM = stehu * naSteh / 100;
    return { delkaM, stehuNaPasmo: Math.floor(pasmoCm / naSteh), pasem: stehu ? Math.ceil(stehu * naSteh / pasmoCm) : 0 };
  }
  const spotrebaKoralku = (pocet, baleni) => ({ pocet, baleni: Math.ceil(pocet / (baleni || PARAMETRY.baleniKoralku)) });

  /* ---------- nastavení ---------- */
  function vychozi() {
    return { verze: VERZE, rezim: 'vysivka', paleta: { vysivka: 'dmc', koralky: 'hama', mozaika: 'lego', vlastni: 'vlastni' }, vlastniPaleta: '',
      sirka: 60, jednotka: 'body', sirkaCm: 20, ct: 14, vlaken: 2, dlazdiceCm: 0.8, baleni: 1000,
      maxBarev: 20, dither: false, sila: 0.8, metrika: 'de2000', siroty: true, jenPlne: true,
      zobrazeni: 'obe', bunkaMm: 3, presah: 2 };
  }
  function migruj(d) {
    const v = vychozi();
    if (!d || typeof d !== 'object') return v;
    const o = Object.assign(v, d, { paleta: Object.assign(v.paleta, d.paleta || {}) });
    o.verze = VERZE; return o;
  }

  const API = {
    VERZE, KLIC, PARAMETRY, ROZTEC, SYMBOLY, PALETY,
    nactiPaletu, paleta, rgbNaLab, deltaE76, deltaE00, nejblizsiBarva, hex,
    zmensi, velikostMrizky, bodyZCm, cmZBodu, kmeans, kvantizuj, odstranSiroty, spocitejBarvy, zamenBarvu, prirad,
    kapacitaListu, rozdelNaListy, spotrebaPasem, spotrebaKoralku, vychozi, migruj
  };
  if (typeof module !== 'undefined') module.exports = API; else window.VzoryJadro = API;
})();
