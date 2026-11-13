/* ============================================================
   gen3d/zaklad.js – společné jádro 3D generátorů bez DOM (běží i v node).
   Smlouva a postup pro nový generátor: docs/plany/Sjednoceni3D_PLAN.md, kap. 6.

   G3D.kopie / vezmi / poloz / slij        – práce s projektem (cesty „a.b.c“)
   G3D.ctiCislo(s)                         – „12,5“ / „−3“ → číslo (NaN, když nejde)
   G3D.normalizuj(vstup, schema)           – doplní výchozí, ořízne meze, opraví výčty → {p, hlaseni}
       schema = {VYCHOZI, MEZE: {cesta: [min, max, celé?]}, VYCTY: {cesta: [...]}, fmt}
   G3D.projektJson(typ, p, verze) / G3D.nactiProjektJson(text, typ, normalizuj, nazev)
   G3D.obal(poz)                           – [minx, miny, minz, maxx, maxy, maxz]
   G3D.tiskoveRozlozeni(dily, kusu, mezera, sirka) – díly na podložku (d.otocit = vzhůru nohama)
   G3D.rozborTisku(dil, uhel)              – {previs, most} v mm² (plochy dolů nad podložkou)
   G3D.tridyPrevisu(poz, idx, uhel)        – Uint8Array na trojúhelník: 0 ok, 1 strop/most, 2 převis, 3 na podložce
   G3D.BARVY_TRID                          – barvy tříd [r,g,b] 0–1 (jako spojky: modrá, žlutá, červená, modrá, šedá = podpora)
   G3D.odhadTisku(objem, hustota, {dilu})  – {g, metru, minut} (hrubý odhad, plný díl)
   G3D.jmenoSouboru(nazev, nahradni, pripona)
   G3D.zakoduj(p) / G3D.dekoduj(t)         – stav do odkazu (deflate-raw + base64url, async)
   ============================================================ */
(function () {
  'use strict';
  const kopie = o => JSON.parse(JSON.stringify(o));
  const vezmi = (o, c) => c.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function poloz(o, c, h) {
    const k = c.split('.'), l = k.pop();
    k.reduce((a, x) => (a[x] && typeof a[x] === 'object' ? a[x] : (a[x] = {})), o)[l] = h;
  }
  function slij(cil, zdroj) {
    for (const k of Object.keys(zdroj || {})) {
      if (zdroj[k] && typeof zdroj[k] === 'object' && !Array.isArray(zdroj[k]) && cil[k] && typeof cil[k] === 'object' && !Array.isArray(cil[k])) slij(cil[k], zdroj[k]);
      else cil[k] = kopie(zdroj[k]);
    }
    return cil;
  }
  const ctiCislo = s => {
    if (typeof s === 'number') return s;
    const t = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.').replace('−', '-');
    return t === '' ? NaN : Number(t);
  };
  // „20“ zůstane „20“ (žádné ořezání nul celých čísel), desetinná čárka
  function fmt(x, des = 1) {
    if (!Number.isFinite(x)) return '–';
    const t = x.toFixed(des);
    return (des > 0 ? t.replace(/\.?0+$/, '') : t).replace('.', ',').replace(/^-0$/, '0');
  }

  /** Obecná normalizace podle výchozího projektu: listy VYCHOZI určují typ (bool / číslo / text / výčet). */
  function normalizuj(vstup, schema) {
    const { VYCHOZI, MEZE = {}, VYCTY = {} } = schema, f = schema.fmt || fmt;
    const p = kopie(VYCHOZI), hlaseni = [];
    const v = vstup && typeof vstup === 'object' ? vstup : {};
    const listy = [];
    (function projdi(o, cesta) {
      for (const k of Object.keys(o)) {
        const c = cesta ? cesta + '.' + k : k;
        if (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) projdi(o[k], c); else listy.push(c);
      }
    })(VYCHOZI, '');
    for (const c of listy) {
      if (c === 'verze') continue;
      const h = vezmi(v, c), vych = vezmi(VYCHOZI, c);
      if (h === undefined || h === null) continue;
      if (VYCTY[c]) {
        const moz = VYCTY[c], hh = typeof moz[0] === 'number' ? ctiCislo(h) : h;
        if (moz.includes(hh)) poloz(p, c, hh); else hlaseni.push(`${c}: neznámá volba „${h}“ → ${vych}`);
        continue;
      }
      if (typeof vych === 'boolean') { poloz(p, c, !!h); continue; }
      if (typeof vych === 'string') { poloz(p, c, String(h).slice(0, c === 'nazev' ? 120 : 2000)); continue; }
      if (Array.isArray(vych)) { if (Array.isArray(h)) poloz(p, c, kopie(h)); continue; }
      if (typeof vych === 'number') {
        let x = ctiCislo(h);
        if (!Number.isFinite(x)) { hlaseni.push(`${c}: neplatné číslo → ${f(vych, 2)}`); continue; }
        const m = MEZE[c];
        if (m) {
          if (m[2]) x = Math.round(x);
          if (x < m[0] || x > m[1]) { const y = Math.min(m[1], Math.max(m[0], x)); hlaseni.push(`${c}: ${f(x, 2)} mimo rozsah → ${f(y, 2)}`); x = y; }
        }
        poloz(p, c, x);
      }
    }
    return { p, hlaseni };
  }

  const projektJson = (typ, p, verze = 1) => JSON.stringify({ typ, verze, projekt: p }, null, 1);
  /** Načte projekt; přijme i holý objekt parametrů (starší soubory). */
  function nactiProjektJson(text, typ, norm, nazev) {
    let j;
    try { j = JSON.parse(text); } catch (e) { throw new Error('Soubor není platný JSON.'); }
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error(`Soubor není projekt ${nazev || typ}.`);
    if (j.projekt === undefined) return norm(j);   // holý objekt parametrů (jeho „typ“ je podtyp dílu)
    if (j.typ !== typ || !j.projekt || typeof j.projekt !== 'object') throw new Error(`Soubor není projekt ${nazev || typ}${j.typ ? ` (je to „${j.typ}“)` : ''}.`);
    return norm(j.projekt);
  }

  function obal(poz) {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < poz.length; i += 3) for (let j = 0; j < 3; j++) { const v = poz[i + j]; if (v < b[j]) b[j] = v; if (v > b[j + 3]) b[j + 3] = v; }
    return b;
  }
  /** Díly v tiskové poloze: otočené (d.otocit), z ≥ 0, v řadách bez překryvu, vystředěné; kusu = počet sad. */
  function tiskoveRozlozeni(dily, kusu = 1, mezera = 6, sirkaPodlozky = 200) {
    const polozky = [];
    for (let i = 0; i < kusu; i++) for (const d of dily) polozky.push(Object.assign({}, d, { nazev: d.nazev + (kusu > 1 ? ` ${i + 1}` : '') }));
    let x = 0, y = 0, radek = 0;
    const out = polozky.map(d => {
      const P = new Float32Array(d.poz.length);
      for (let i = 0; i < P.length; i += 3) {
        P[i] = d.poz[i];
        P[i + 1] = d.otocit ? -d.poz[i + 1] : d.poz[i + 1];
        P[i + 2] = d.otocit ? -d.poz[i + 2] : d.poz[i + 2];
      }
      const b = obal(P), sx = b[3] - b[0], sy = b[4] - b[1];
      if (x > 0 && x + sx > sirkaPodlozky) { x = 0; y += radek + mezera; radek = 0; }
      for (let i = 0; i < P.length; i += 3) { P[i] += x - b[0]; P[i + 1] += y - b[1]; P[i + 2] -= b[2]; }
      x += sx + mezera; radek = Math.max(radek, sy);
      return Object.assign({}, d, { poz: P });
    });
    const B = [Infinity, Infinity, -Infinity, -Infinity];
    for (const d of out) { const b = obal(d.poz); B[0] = Math.min(B[0], b[0]); B[1] = Math.min(B[1], b[1]); B[2] = Math.max(B[2], b[3]); B[3] = Math.max(B[3], b[4]); }
    const cx = (B[0] + B[2]) / 2, cy = (B[1] + B[3]) / 2;
    for (const d of out) for (let i = 0; i < d.poz.length; i += 3) { d.poz[i] -= cx; d.poz[i + 1] -= cy; }
    return out;
  }
  /** Třída každého trojúhelníku v tiskové poloze: 0 ok, 1 vodorovný strop (most), 2 převis nad „uhel“ od svislice, 3 na podložce. */
  function tridyPrevisu(P, I, uhel = 45, zmin) {
    const mez = -Math.sin(uhel * Math.PI / 180) - 0.02, T = new Uint8Array(I.length / 3);
    if (zmin === undefined) { zmin = Infinity; for (let i = 2; i < P.length; i += 3) zmin = Math.min(zmin, P[i]); }
    for (let t = 0; t < I.length; t += 3) {
      const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
      if (Math.max(P[a + 2], P[b + 2], P[c + 2]) < zmin + 0.01) { T[t / 3] = 3; continue; }
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-12) continue;
      const cz = nz / l;
      T[t / 3] = cz < -0.985 ? 1 : cz < mez ? 2 : 0;
    }
    return T;
  }
  function rozborTisku(dil, uhel) {
    const P = dil.poz, I = dil.idx, T = tridyPrevisu(P, I, uhel);
    let previs = 0, most = 0;
    for (let t = 0; t < T.length; t++) {
      if (T[t] !== 1 && T[t] !== 2) continue;
      const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const A = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      if (T[t] === 1) most += A; else previs += A;
    }
    return { previs, most };
  }
  /** Hrubý odhad pro plný díl: hmotnost (g), filament 1,75 mm (m), doba tisku (min) při ~6 mm³/s + 90 s najetí na díl. */
  function odhadTisku(objem, hustota, volby = {}) {
    const dilu = volby.dilu || 1;
    return { g: objem / 1000 * hustota, metru: objem / (Math.PI * 0.875 * 0.875) / 1000, minut: Math.round((objem / 6 + 90 * dilu) / 60) };
  }
  const jmenoSouboru = (nazev, nahradni, pripona) => ((nazev || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '') || nahradni) + pripona;

  /* ---------- sdílení odkazem: JSON → deflate-raw → base64url, předpona z (zkomprimováno) / j (holý JSON) ---------- */
  const b64u = u8 => { let t = ''; for (const b of u8) t += String.fromCharCode(b); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const zB64u = t => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  async function proud(data, Trida, druh) { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new Trida(druh))).arrayBuffer()); }
  async function zakoduj(q) {
    const json = new TextEncoder().encode(JSON.stringify(q));
    if (typeof CompressionStream === 'undefined') return 'j' + b64u(json);
    return 'z' + b64u(await proud(json, CompressionStream, 'deflate-raw'));
  }
  async function dekoduj(t) {
    const data = zB64u(t.slice(1));
    const json = t[0] === 'z' ? await proud(data, DecompressionStream, 'deflate-raw') : data;
    return JSON.parse(new TextDecoder().decode(json));
  }

  const BARVY_TRID = [[0.25, 0.48, 0.84], [0.85, 0.66, 0.2], [0.86, 0.22, 0.2], [0.25, 0.48, 0.84], [0.66, 0.68, 0.72]];
  const API = {
    BARVY_TRID,
    kopie, vezmi, poloz, slij, ctiCislo, fmt, normalizuj, projektJson, nactiProjektJson,
    obal, tiskoveRozlozeni, tridyPrevisu, rozborTisku, odhadTisku, jmenoSouboru, zakoduj, dekoduj,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else window.G3D = Object.assign(window.G3D || {}, API);
})();
