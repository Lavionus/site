/* Dopravní magnát – izometrické kreslení (dočasná grafika kreslená kódem, než přijdou atlasy).
   Pole (x,y) s výškou h: obrazovka X = (x − y)·32·Z, Y = (x + y)·16·Z − h·8·Z  (Z = přiblížení).
   Mapa se kreslí po blocích (chunk) do plátna mimo obrazovku; bloky se drží v LRU mezipaměti
   a překreslují jen při změně (zneplatni). Vozidla a popisky se kreslí každý snímek navrch. */
(function (MAG) {
  'use strict';
  const D = MAG.data, T = D.T, M = MAG.mapa;
  const PW = 32, PH = 16, VH = 8;                 // půl šířky pole, půl výšky, výška stupně (při Z = 1)
  const OKRAJ = D.MAX_VYSKA * VH + 64;            // místo nad blokem pro kopce a stavby
  const ZOOMY = [0.25, 0.5, 1, 2];

  // --- atlasy obrázků (MAG.ATLAS z grafika/atlas.js; v node nejsou → kreslí se kódem) ---------------
  const OBR = {};            // jméno atlasu → načtený obrázek
  let TEX = null;            // pole plátek textur terénu (čtverce)
  function nactiAtlasy(hotovo) {
    if (typeof Image === 'undefined' || !MAG.ATLAS) return;
    const jmena = Object.keys(MAG.ATLAS).filter(k => k !== 'uvod');
    let zbyva = jmena.length;
    for (const k of jmena) {
      const im = new Image();
      im.onload = im.onerror = () => {
        if (im.naturalWidth) OBR[k] = im;
        if (--zbyva === 0) {
          if (OBR.teren) {
            const a = MAG.ATLAS.teren, S = a.vel;
            TEX = a.snimky.map(([x, y]) => { const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d').drawImage(OBR.teren, x, y, S, S, 0, 0, S, S); return c; });
          }
          if (hotovo) hotovo();
        }
      };
      im.src = MAG.ATLAS[k].obr;
    }
  }
  // vozidla z Blenderu: obrázky + maska barvy firmy; přebarvený atlas se drží pro každou barvu
  function nactiVozidla(hotovo) {
    const A = MAG.ATLAS_VOZ;
    if (typeof Image === 'undefined' || !A) return;
    let zbyva = 2;
    for (const [k, src] of [['vozidla', A.obr], ['vozidlaM', A.maska]]) {
      const im = new Image();
      im.onload = im.onerror = () => { if (im.naturalWidth) OBR[k] = im; if (--zbyva === 0 && hotovo) hotovo(); };
      im.src = src;
    }
  }
  const obarvene = {};
  function atlasVozidel(barva) {
    if (!OBR.vozidla || !OBR.vozidlaM) return null;
    if (obarvene[barva]) return obarvene[barva];
    const w = OBR.vozidla.naturalWidth, h = OBR.vozidla.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(OBR.vozidla, 0, 0);
    // barva jen tam, kde je maska: vrstva barvy oříznutá maskou, pak násobení
    const v = document.createElement('canvas'); v.width = w; v.height = h;
    const gv = v.getContext('2d');
    gv.fillStyle = barva; gv.fillRect(0, 0, w, h);
    gv.globalCompositeOperation = 'destination-in'; gv.drawImage(OBR.vozidlaM, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.drawImage(v, 0, 0);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(OBR.vozidla, 0, 0);   // vrátit průhlednost
    return (obarvene[barva] = c);
  }
  // jen snímky jednoho typu obarvené danou barvou (barva podle typu – celý atlas pro každou barvu by zabral moc paměti)
  const obarveneTypy = {};
  function snimkyTypu(typ, barva) {
    const klic = typ + barva;
    if (obarveneTypy[klic]) return obarveneTypy[klic];
    const A = MAG.ATLAS_VOZ, f = A && A.snimky[typ];
    if (!f || !OBR.vozidla || !OBR.vozidlaM) return null;
    const x0 = Math.min(...f.map(q => q[0])), y0 = Math.min(...f.map(q => q[1]));
    const x1 = Math.max(...f.map(q => q[0] + q[2])), y1 = Math.max(...f.map(q => q[1] + q[3]));
    const w = x1 - x0, h = y1 - y0;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(OBR.vozidla, x0, y0, w, h, 0, 0, w, h);
    const v = document.createElement('canvas'); v.width = w; v.height = h;
    const gv = v.getContext('2d');
    gv.fillStyle = barva; gv.fillRect(0, 0, w, h);
    gv.globalCompositeOperation = 'destination-in'; gv.drawImage(OBR.vozidlaM, x0, y0, w, h, 0, 0, w, h);
    g.globalCompositeOperation = 'multiply'; g.drawImage(v, 0, 0);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(OBR.vozidla, x0, y0, w, h, 0, 0, w, h);
    return (obarveneTypy[klic] = { c, x0, y0 });
  }
  const SMER_NA_SNIMEK = [6, 0, 2, 4];   // herní d (0 = −y, 1 = +x, 2 = +y, 3 = −x) → snímek z Blenderu (po 45° od +x)

  const snimek = (atlas, k) => MAG.ATLAS && MAG.ATLAS[atlas] && MAG.ATLAS[atlas].snimky[k];
  // obrázek ze sprajtového atlasu: kotva = spodní střed; sirka v px, zrcadlit = převrátit vodorovně (druhá osa izometrie)
  function sprite(g, atlas, k, x, y, sirka, zrcadlit) {
    const im = OBR[atlas], f = snimek(atlas, k);
    if (!im || !f) return false;
    if (f.length >= 7) {   // srovnaná budova: (x, y) = přední roh pole, sirka = šířka základny
      const k = sirka / f[6], w = f[2] * k, hh = f[3] * k, kx = (zrcadlit ? f[2] - f[4] : f[4]) * k;
      if (zrcadlit) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, f[0], f[1], f[2], f[3], -(w - kx), y - f[5] * k, w, hh); g.restore(); }
      else g.drawImage(im, f[0], f[1], f[2], f[3], x - kx, y - f[5] * k, w, hh);
      return true;
    }
    const vys = sirka * f[3] / f[2];
    if (zrcadlit) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, f[0], f[1], f[2], f[3], -sirka / 2, y - vys, sirka, vys); g.restore(); }
    else g.drawImage(im, f[0], f[1], f[2], f[3], x - sirka / 2, y - vys, sirka, vys);
    return true;
  }
  // textury terénu (indexy v archu)
  const TX = { TRAVA: 0, TRAVA2: 1, SUCHA: 2, LES: 3, OBILI: 4, ORANICE: 5, PISEK: 6, SKALA: 7, SNIH: 8, STERK: 9, BETON: 10, ASFALT: 11, MELCINA: 12, HLUBINA: 13, HLINA: 14, DLAZBA: 15 };
  const TEX_POLI = 2.5;     // textura se opakuje po 2,5 pole

  const velBloku = Z => Math.max(8, Math.min(64, Math.round(16 / Z)));

  // bilineární výška bodu (u,v) ∈ [0,1]² v poli
  function vyskaUV(r, u, v) {
    return r[0] * (1 - u) * (1 - v) + r[1] * u * (1 - v) + r[2] * u * v + r[3] * (1 - u) * v;
  }

  function Kreslic(mapa) {
    const m = mapa;
    const mez = new Map();   // klíč → {c, px}
    let pixelu = 0;
    const LIMIT_PX = 80e6;
    let volby = { mrizka: false, barvaFirmy: '#d8442c', stanice: [] };
    const kdoStavi = (stId, x, y) => { const st = volby.stanice[stId]; const c = st && st.casti.find(c => c.x === x && c.y === y); return c ? c.druh : 'bus'; };
    let dpr = 1;

    // hloubka vody (vzdálenost od pobřeží) a šum barvy – jednou při načtení
    const hloubka = new Uint8Array(m.W * m.H);
    {
      const fr = [];
      for (let i = 0; i < hloubka.length; i++) hloubka[i] = m.typ[i] === T.VODA ? 255 : 0;
      for (let i = 0; i < hloubka.length; i++) if (!hloubka[i]) fr.push(i);
      for (let h = 0; fr.length; h++) {
        const dalsi = [];
        for (const i of fr) {
          const x = i % m.W, y = (i / m.W) | 0;
          for (const [dx, dy] of M.SOUSEDE4) {
            const nx = x + dx, ny = y + dy;
            if (!M.uvnitr(m, nx, ny)) continue;
            const j = ny * m.W + nx;
            if (hloubka[j] === 255) { hloubka[j] = Math.min(250, h + 1); dalsi.push(j); }
          }
        }
        fr.length = 0; fr.push(...dalsi);
      }
    }
    const zrnoPole = i => ((i * 2654435761) >>> 24) / 255;

    const rgb = (c, k) => `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`;
    const hexNaRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

    // vzorek textury pro daný kontext (vzorky se vážou na kontext → mezipaměť po kontextech)
    const vzorky = new WeakMap();
    function vzorek(g, k, Z) {
      if (!TEX || !TEX[k]) return null;
      let mapa = vzorky.get(g); if (!mapa) vzorky.set(g, mapa = {});
      const klic = k + ':' + Z;
      if (!mapa[klic]) {
        const p = g.createPattern(TEX[k], 'repeat'), S = TEX[k].width, q = TEX_POLI / S;
        // čtverec textury → izometrický kosočtverec (ukotveno ve světových souřadnicích, takže pole navazují)
        if (p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix([PW * Z * q, PH * Z * q, -PW * Z * q, PH * Z * q, 0, 0]));
        mapa[klic] = p;
      }
      return mapa[klic];
    }
    const PRUM_HLINA = new Set(['dul', 'rudnydul', 'tezba', 'farma', 'vrt']);
    function texturaPole(i, x, y, typ) {
      if (m.prum[i]) return PRUM_HLINA.has(m.prumysl[m.prum[i] - 1].typ) ? TX.HLINA : TX.BETON;
      if (typ === T.VODA) return hloubka[i] <= 1 ? TX.MELCINA : TX.HLUBINA;
      if (typ === T.PISEK) return TX.PISEK;
      if (typ === T.SKALA) return TX.SKALA;
      if (typ === T.SNIH) return TX.SNIH;
      if (typ === T.POLE) return ((x >> 2) + (y >> 2)) % 3 ? TX.OBILI : TX.ORANICE;
      if (m.les[i]) return TX.LES;
      // jedna tráva (míchání dvou textur dělalo šachovnici); suchá jen ve vyšších polohách
      return M.minR(m, x, y) >= Math.max(3, (m.vrch || 8) * 0.62) ? TX.SUCHA : TX.TRAVA;
    }

    // --- kreslení jednoho pole ------------------------------------------------
    // jenObj = jen předměty, které zakrývají vozidla (stromy, garáže a depa, domy, podniky bez sprajtu) – bez terénu a cest
    function kresliPole(g, x, y, Z, jenObj = false) {
      const i = y * m.W + x, r = M.rohy(m, x, y);
      const bod = (u, v, h) => [((x + u) - (y + v)) * PW * Z, ((x + u) + (y + v)) * PH * Z - (h ?? vyskaUV(r, u, v)) * VH * Z];
      const poly = (body, barva) => {
        g.beginPath(); g.moveTo(body[0][0], body[0][1]);
        for (let k = 1; k < body.length; k++) g.lineTo(body[k][0], body[k][1]);
        g.closePath(); g.fillStyle = barva; g.fill();
      };
      const typ = m.typ[i];
      const sx = (r[1] + r[2] - r[0] - r[3]) / 2, sy = (r[3] + r[2] - r[0] - r[1]) / 2;
      if (!jenObj) {
      // světlo zleva shora (od −x): svah stoupající k +x je osvětlený, opačný ve stínu
      let svetlo = 1 + (sx > 0 ? 0.24 : 0.3) * sx + 0.07 * sy + (zrnoPole(i) - 0.5) * 0.06;
      let barva = D.BARVY_TERENU[typ];
      if (typ === T.VODA) {
        const d = Math.min(6, hloubka[i]);
        barva = [Math.max(20, 70 - d * 8), Math.max(60, 132 - d * 11), Math.max(120, 196 - d * 9)];
        svetlo = 1;
      } else if (m.les[i] && Z < 0.5) barva = [62, 112, 52];
      else if (m.les[i]) barva = [86, 138, 64];
      const roh = [bod(0, 0, r[0]), bod(1, 0, r[1]), bod(1, 1, r[2]), bod(0, 1, r[3])];
      const vz = Z >= 0.5 ? vzorek(g, texturaPole(i, x, y, typ), Z) : null;
      if (vz) {
        poly(roh, vz);
        // stínování svahu a jemné rozdíly mezi poli přes texturu
        const k = typ === T.VODA ? 1 + (zrnoPole(i) - 0.5) * 0.04 : svetlo;
        if (k > 1.005) poly(roh, `rgba(255,250,235,${Math.min(0.35, (k - 1) * 0.9).toFixed(3)})`);
        else if (k < 0.995) poly(roh, `rgba(20,24,30,${Math.min(0.45, (1 - k) * 0.9).toFixed(3)})`);
      } else poly(roh, rgb(barva, svetlo));
      // okraj mapy: řez zeminou až pod hladinu (je vidět výška krajiny)
      const dno = -1.5;
      if (x === m.W - 1) poly([roh[1], roh[2], bod(1, 1, dno), bod(1, 0, dno)], typ === T.VODA ? '#1d3f66' : '#6b4e33');
      if (y === m.H - 1) poly([roh[3], roh[2], bod(1, 1, dno), bod(0, 1, dno)], typ === T.VODA ? '#16324f' : '#523a26');
      // přelivy svahů 4 rohy s různou výškou → zvýraznit úhlopříčku jako v reliéfu
      if (typ === T.POLE && Z >= 0.5 && !TEX) {
        g.strokeStyle = rgb([150, 128, 60], svetlo); g.lineWidth = Math.max(1, Z);
        g.beginPath();
        for (let k = 1; k < 4; k++) { const a = bod(k / 4, 0.08), b = bod(k / 4, 0.92); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
        g.stroke();
      }
      if (volby.mrizka && Z >= 0.5) {
        g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1 / dpr;
        g.beginPath(); g.moveTo(roh[0][0], roh[0][1]); for (let k = 1; k < 4; k++) g.lineTo(roh[k][0], roh[k][1]); g.closePath(); g.stroke();
      }
      // pás z polí do sousedů (řeka, silnice)
      const pas = (sirka, barva, spojeno, hp, stred = true) => {
        const w = sirka / 2, b = (u, v) => bod(u, v, hp);
        if (stred) poly([b(0.5 - w, 0.5 - w), b(0.5 + w, 0.5 - w), b(0.5 + w, 0.5 + w), b(0.5 - w, 0.5 + w)], barva);
        M.SOUSEDE4.forEach(([dx, dy]) => {
          if (!spojeno(x + dx, y + dy)) return;
          if (dx) { const u0 = dx > 0 ? 0.5 : 0, u1 = dx > 0 ? 1 : 0.5; poly([b(u0, 0.5 - w), b(u1, 0.5 - w), b(u1, 0.5 + w), b(u0, 0.5 + w)], barva); }
          else { const v0 = dy > 0 ? 0.5 : 0, v1 = dy > 0 ? 1 : 0.5; poly([b(0.5 - w, v0), b(0.5 + w, v0), b(0.5 + w, v1), b(0.5 - w, v1)], barva); }
        });
      };
      // oblouk pole se dvěma kolmými spoji (směry da, db): bod na poloměru r pod úhlem θ ∈ ⟨0, π/2⟩ od hrany da k hraně db
      const obloukUV = (da, db) => {
        const [xa, ya] = M.SOUSEDE4[da], [xb, yb] = M.SOUSEDE4[db];
        const cu = 0.5 + 0.5 * (xa + xb), cv = 0.5 + 0.5 * (ya + yb);
        return (r, t) => [cu + r * (Math.cos(t) * -xb + Math.sin(t) * -xa), cv + r * (Math.cos(t) * -yb + Math.sin(t) * -ya)];
      };
      const kolmeDva = bity => { const ds = [0, 1, 2, 3].filter(d => bity & (1 << d)); return ds.length === 2 && (ds[0] + ds[1]) % 2 === 1 ? ds : null; };
      const obloukBody = (f, r, hh, n = 10) => { const out = []; for (let q = 0; q <= n; q++) { const [u, v] = f(r, q / n * Math.PI / 2); out.push(bod(u, v, hh)); } return out; };
      const lomena = (body, posunY = 0) => { g.beginPath(); body.forEach((p, q) => g[q ? 'lineTo' : 'moveTo'](p[0], p[1] - posunY)); g.stroke(); };
      if (m.reka[i]) pas(0.46, rgb([64, 126, 190], 0.96 + 0.1 * sx), (nx, ny) => M.uvnitr(m, nx, ny) && (m.reka[ny * m.W + nx] || m.typ[ny * m.W + nx] === T.VODA));
      // zdymadlo: betonové zdi podél komory a vrata na obou koncích
      if (m.zdym[i]) {
        const podelX = m.zdym[i] === 1, uv = (a, b) => podelX ? bod(a, b) : bod(b, a);
        for (const b of [0.22, 0.72]) poly([uv(0, b), uv(1, b), uv(1, b + 0.06), uv(0, b + 0.06)], '#b4b0a6');
        for (const b of [0.22, 0.78]) { const p0 = uv(0, b), p1 = uv(1, b); g.fillStyle = '#8e8a80'; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p1[0], p1[1] - 4 * Z); g.lineTo(p0[0], p0[1] - 4 * Z); g.closePath(); g.fill(); }
        g.strokeStyle = '#5a3b22'; g.lineWidth = Math.max(1, 2.4 * Z);
        g.beginPath(); for (const a of [0.06, 0.94]) { const p0 = uv(a, 0.25), p1 = uv(a, 0.75); g.moveTo(p0[0], p0[1] - 3 * Z); g.lineTo(p1[0], p1[1] - 3 * Z); } g.stroke();
      }
      // most: pilíř a mostovka; silnice a kolej se pak kreslí ve výšce mostovky
      const hm = m.most[i] ? m.mostV[i] : undefined;
      if (m.most[i]) {
        const podelX = m.most[i] === 1, uv = (a, b, hh) => podelX ? bod(a, b, hh) : bod(b, a, hh);
        const pz = bod(0.5, 0.5, 0), ph = bod(0.5, 0.5, hm);
        g.fillStyle = '#7d756a'; g.fillRect(pz[0] - 3 * Z, ph[1], 6 * Z, pz[1] - ph[1]);
        poly([uv(0, 0.85, hm), uv(1, 0.85, hm), [uv(1, 0.85, hm)[0], uv(1, 0.85, hm)[1] + 5 * Z], [uv(0, 0.85, hm)[0], uv(0, 0.85, hm)[1] + 5 * Z]], '#6b6258');
        poly([uv(0, 0.15, hm), uv(1, 0.15, hm), uv(1, 0.85, hm), uv(0, 0.85, hm)], '#a39888');
      }
      // silnice: rameno jen tam, kudy vede spojení (zastávka jen podél osy, garáž jen k výjezdu)
      const spoj = (nx, ny) => { const d = M.SOUSEDE4.findIndex(([a, b]) => a === nx - x && b === ny - y); return MAG.cesty.spojeno(m, i, d) >= 0; };
      if ((m.cesta[i] && !m.tunel[i]) || (m.depo[i] && !m.kolej[i] && MAG.cesty.spojeno(m, i, m.smer[i] - 1) >= 0)) {
        const asfalt = (Z >= 0.5 && vzorek(g, TX.ASFALT, Z)) || rgb([112, 110, 106], svetlo);
        let bity = 0; for (let d = 0; d < 4; d++) if (MAG.cesty.spojeno(m, i, d) >= 0) bity |= 1 << d;
        // zatáčka zůstává „L“ (auta jedou přes střed pole), obrubníky a středová čára jen na rovném úseku
        const rovna = m.cesta[i] && !m.stan[i] && !m.kolej[i] && !m.tram[i] && (bity === 0b0101 || bity === 0b1010);
        pas(0.36, asfalt, spoj, hm);
        if (Z >= 1 && rovna) {
          g.lineCap = 'butt';
          g.strokeStyle = 'rgba(214,210,196,.55)'; g.lineWidth = Math.max(1, 0.9 * Z);   // obrubníky
          for (const b of [0.33, 0.67]) { const p0 = bity === 0b1010 ? bod(0, b, hm) : bod(b, 0, hm), p1 = bity === 0b1010 ? bod(1, b, hm) : bod(b, 1, hm); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
          g.strokeStyle = 'rgba(245,242,230,.75)'; g.lineWidth = Math.max(1, 0.8 * Z); g.setLineDash([4 * Z, 4 * Z]);   // středová čára
          { const p0 = bity === 0b1010 ? bod(0, 0.5, hm) : bod(0.5, 0, hm), p1 = bity === 0b1010 ? bod(1, 0.5, hm) : bod(0.5, 1, hm); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
          g.setLineDash([]);
        }
      }
      // tramvajová kolej: dvě kolejnice zapuštěné v asfaltu k sousedům s tramvají (nebo garáži)
      if (m.tram[i] && !m.tunel[i] && Z >= 0.5) {
        // pár kolejnic v každém jízdním pruhu (vozidla jedou 0,17 pole vpravo od osy)
        const ramena = [];
        for (let d = 0; d < 4; d++) {
          const [dx, dy] = M.SOUSEDE4[d], nx = x + dx, ny = y + dy;
          if (!M.uvnitr(m, nx, ny)) continue;
          const j = ny * m.W + nx;
          if ((m.tram[j] || m.depo[j]) && MAG.cesty.spojeno(m, i, d) >= 0) ramena.push([dx, dy]);
        }
        g.lineCap = 'butt';
        for (const [barva, sir] of [['rgba(38,39,43,.85)', 1.7], ['rgba(190,194,200,.75)', 0.6]]) {
          g.strokeStyle = barva; g.lineWidth = Math.max(1, sir * Z);
          g.beginPath();
          for (const [dx, dy] of ramena) for (const b of [-0.155, -0.065, 0.065, 0.155]) {
            const p0 = bod(0.5 - dx * 0.22 + dy * b, 0.5 - dy * 0.22 + dx * b, hm), p1 = bod(0.5 + dx * 0.5 + dy * b, 0.5 + dy * 0.5 + dx * b, hm);
            g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]);
          }
          g.stroke();
        }
      }
      // kolej: štěrkové lože, pražce, kolejnice do každého směru s bitem; šikmý úsek jako tětiva mezi středy hran
      const sterk = () => (Z >= 0.5 && vzorek(g, TX.STERK, Z)) || rgb([150, 140, 122], svetlo);
      if (m.kolej[i] && !m.tunel[i]) {
        const k = m.kolej[i], nad = 17 * Z;
        const usek = (pt, L) => {   // pt(a, b): a = podél od 0 do L, b = napříč
          g.lineCap = 'butt';
          g.strokeStyle = m.vrt[i] ? '#b9bcc0' : '#6a4a32'; g.lineWidth = Math.max(1, 2.2 * Z);   // rychlostní: betonové pražce
          g.beginPath();
          for (let a = 0.08; a < L; a += 0.14) { const p0 = pt(a, -0.17), p1 = pt(a, 0.17); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
          g.stroke();
          for (const [barva, sir, dy] of [['#3d3f44', 1.4, 0], ['rgba(205,210,218,.75)', 0.55, -0.45]]) {   // kolejnice + odlesk
            g.strokeStyle = barva; g.lineWidth = Math.max(Z < 1 ? 0.5 : 1, sir * Z);
            g.beginPath();
            for (const b of [-0.1, 0.1]) { const p0 = pt(-0.1, b), p1 = pt(L, b); g.moveTo(p0[0], p0[1] + dy * Z); g.lineTo(p1[0], p1[1] + dy * Z); }
            g.stroke();
          }
        };
        const oblouk = !m.stan[i] && !m.depo[i] && kolmeDva(k);
        if (MAG.zeleznice && MAG.zeleznice.jeDiag(m, i)) {
          const ds = [0, 1, 2, 3].filter(d => k & (1 << d)), S4 = M.SOUSEDE4;
          const P = [0.5 + S4[ds[0]][0] * 0.5, 0.5 + S4[ds[0]][1] * 0.5], Q = [0.5 + S4[ds[1]][0] * 0.5, 0.5 + S4[ds[1]][1] * 0.5];
          const L = Math.hypot(Q[0] - P[0], Q[1] - P[1]), ux = (Q[0] - P[0]) / L, uy = (Q[1] - P[1]) / L;
          const uvp = (a, b) => [P[0] + ux * a - uy * b, P[1] + uy * a + ux * b], pt = (a, b) => { const q = uvp(a, b); return bod(q[0], q[1], hm); };
          // lože: pás podél tětivy oříznutý na pole (přesah by překreslil terén souseda → zuby)
          let lp = [uvp(-0.4, -0.22), uvp(L + 0.4, -0.22), uvp(L + 0.4, 0.22), uvp(-0.4, 0.22)];
          for (const [os, hr, vne] of [[0, 0, -1], [0, 1, 1], [1, 0, -1], [1, 1, 1]]) {
            const out = [], uvn = q => (q[os] - hr) * vne <= 0;
            lp.forEach((q, k) => {
              const r2 = lp[(k + 1) % lp.length], a1 = uvn(q), a2 = uvn(r2);
              if (a1) out.push(q);
              if (a1 !== a2) { const t = (hr - q[os]) / (r2[os] - q[os]); out.push([q[0] + (r2[0] - q[0]) * t, q[1] + (r2[1] - q[1]) * t]); }
            });
            lp = out;
          }
          if (lp.length > 2) poly(lp.map(q => bod(q[0], q[1], hm)), sterk());
          if (Z >= 0.5) {
            usek((a, b) => pt(a + 0.1, b), L - 0.1);
            if (m.elek[i]) {
              const p0 = pt(0, 0), p1 = pt(L, 0);
              g.strokeStyle = 'rgba(40,42,46,.8)'; g.lineWidth = Math.max(1, 0.8 * Z);
              g.beginPath(); g.moveTo(p0[0], p0[1] - nad); g.lineTo(p1[0], p1[1] - nad); g.stroke();
              if ((x + y) % 2 === 0) {   // stožár ob pole, vždy na stejné straně
                const ps = pt(L / 2, -0.3 * Math.sign(ux + uy || 1)), pc = pt(L / 2, 0);
                g.strokeStyle = '#5b5f66'; g.lineWidth = Math.max(1, 1.6 * Z);
                g.beginPath(); g.moveTo(ps[0], ps[1]); g.lineTo(ps[0], ps[1] - nad - 2 * Z); g.lineTo(pc[0], pc[1] - nad - 2 * Z); g.stroke();
              }
            }
          }
        } else if (oblouk) {
          // oblouk: lože jako mezikruží, pražce paprskovitě, kolejnice soustředné oblouky
          const f = obloukUV(oblouk[0], oblouk[1]);
          poly([...obloukBody(f, 0.72, hm), ...obloukBody(f, 0.28, hm).reverse()], sterk());
          if (Z >= 0.5) {
            g.lineCap = 'butt';
            g.strokeStyle = m.vrt[i] ? '#b9bcc0' : '#6a4a32'; g.lineWidth = Math.max(1, 2.2 * Z);
            g.beginPath();
            for (let a = 0.07; a < Math.PI / 4; a += 0.14) { const t = a / 0.5, [u0, v0] = f(0.33, t), [u1, v1] = f(0.67, t), p0 = bod(u0, v0, hm), p1 = bod(u1, v1, hm); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
            g.stroke();
            for (const [barva, sir, dy] of [['#3d3f44', 1.4, 0], ['rgba(205,210,218,.75)', 0.55, -0.45]]) {
              g.strokeStyle = barva; g.lineWidth = Math.max(1, sir * Z);
              for (const r of [0.4, 0.6]) lomena(obloukBody(f, r, hm), -dy * Z);
            }
            if (m.elek[i]) {
              g.strokeStyle = 'rgba(40,42,46,.8)'; g.lineWidth = Math.max(1, 0.8 * Z);
              lomena(obloukBody(f, 0.5, hm), nad);
              const [us, vs] = f(0.86, Math.PI / 4), [uc, vc] = f(0.5, Math.PI / 4), ps = bod(us, vs, hm), pc = bod(uc, vc, hm);
              g.strokeStyle = '#5b5f66'; g.lineWidth = Math.max(1, 1.6 * Z);
              g.beginPath(); g.moveTo(ps[0], ps[1]); g.lineTo(ps[0], ps[1] - nad - 2 * Z); g.lineTo(pc[0], pc[1] - nad - 2 * Z); g.stroke();
            }
          }
        } else {
          const maBit = (nx, ny) => { const d = M.SOUSEDE4.findIndex(([a, b]) => a === nx - x && b === ny - y); return (k & (1 << d)) !== 0; };
          pas(0.44, sterk(), maBit, hm);
          if (Z >= 0.5) {
            for (let d = 0; d < 4; d++) {
              if (!(k & (1 << d))) continue;
              const [dx, dy] = M.SOUSEDE4[d];
              usek((a, b) => bod(0.5 + dx * a + dy * b, 0.5 + dy * a + dx * b, hm), 0.5);
            }
            // trolej: drát nad osou každého ramene, sloupek u středu pole
            if (m.elek[i]) {
              g.strokeStyle = 'rgba(40,42,46,.8)'; g.lineWidth = Math.max(1, 0.8 * Z);
              g.beginPath();
              for (let d = 0; d < 4; d++) {
                if (!(k & (1 << d))) continue;
                const [dx, dy] = M.SOUSEDE4[d], p0 = bod(0.5, 0.5, hm), p1 = bod(0.5 + dx * 0.5, 0.5 + dy * 0.5, hm);
                g.moveTo(p0[0], p0[1] - nad); g.lineTo(p1[0], p1[1] - nad);
              }
              g.stroke();
              const podelX = (k & 0b1010) && !(k & 0b0101), ps = podelX ? bod(0.5, 0.16, hm) : bod(0.16, 0.5, hm), pc = bod(0.5, 0.5, hm);
              g.strokeStyle = '#5b5f66'; g.lineWidth = Math.max(1, 1.6 * Z);
              g.beginPath(); g.moveTo(ps[0], ps[1]); g.lineTo(ps[0], ps[1] - nad - 2 * Z); g.lineTo(pc[0], pc[1] - nad - 2 * Z); g.stroke();
            }
          }
        }
      }
      // portál tunelu: kamenný oblouk na hraně k vnitřku tunelu
      if (!m.tunel[i] && (m.kolej[i] || m.cesta[i])) {
        for (let d = 0; d < 4; d++) {
          const [dx, dy] = M.SOUSEDE4[d], nx = x + dx, ny = y + dy;
          if (!M.uvnitr(m, nx, ny)) continue;
          const j = ny * m.W + nx;
          if (!m.tunel[j] || m.tunel[j] !== (dx ? 1 : 2)) continue;
          const L = m.tunelV[j], ex = 0.5 + dx * 0.5, ey = 0.5 + dy * 0.5;
          const pp = (b, zv) => { const q = bod(ex + Math.abs(dy) * b, ey + Math.abs(dx) * b, L); return [q[0], q[1] - zv * Z]; };
          const oblouk = (w, hv, barva) => {
            const a0 = pp(-w, 0), a1 = pp(-w, hv * 0.6), t0 = pp(0, hv * 1.25), b1 = pp(w, hv * 0.6), b0 = pp(w, 0);
            g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.quadraticCurveTo(t0[0], t0[1], b1[0], b1[1]); g.lineTo(b0[0], b0[1]); g.closePath();
            g.fillStyle = barva; g.fill();
          };
          oblouk(0.42, 17, '#8b8378');
          oblouk(0.3, 12, '#1d1b1a');
        }
      }

      }
      // krabice na poli (u0..u1, v0..v1), střecha ve výšce `vrch` stupňů nad nejvyšším rohem
      const krabice = (u0, v0, u1, v1, vyskaPx, stena, strecha, sedlo) => {
        const zakl = Math.max(r[0], r[1], r[2], r[3]);
        const top = (u, v) => { const p = bod(u, v, zakl); return [p[0], p[1] - vyskaPx * Z]; };
        const c = hexNaRgb(stena);
        poly([bod(u1, v0), bod(u1, v1), top(u1, v1), top(u1, v0)], rgb(c, 0.82));   // pravá stěna (+x)
        poly([bod(u0, v1), bod(u1, v1), top(u1, v1), top(u0, v1)], rgb(c, 0.64));   // levá stěna (+y)
        if (sedlo) {
          const hr = (v1 - v0) * 0.55 * PW * Z / 1.6, s = (v0 + v1) / 2;
          const hreben = (u) => { const p = top(u, s); return [p[0], p[1] - hr]; };
          const cs = hexNaRgb(strecha);
          poly([top(u0, v0), top(u1, v0), hreben(u1), hreben(u0)], rgb(cs, 1.08));
          poly([top(u0, v1), top(u1, v1), hreben(u1), hreben(u0)], rgb(cs, 0.78));
          poly([top(u1, v0), top(u1, v1), hreben(u1)], rgb(c, 0.9));
        } else poly([top(u0, v0), top(u1, v0), top(u1, v1), top(u0, v1)], rgb(hexNaRgb(strecha || stena), 1.0));
      };

      if (m.les[i] && Z >= 0.5) {
        const n = m.les[i] + 1, z0 = (i * 2246822519) >>> 0;
        const stromy = [];
        for (let k = 0; k < n; k++) {
          const a = ((z0 >>> (k * 5)) & 31) / 31, b = ((z0 >>> (k * 5 + 3)) & 31) / 31;
          stromy.push([0.18 + a * 0.64, 0.18 + ((b + k * 0.37) % 1) * 0.64]);
        }
        stromy.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
        const snih = typ === T.SNIH;
        const maStromy = !!OBR.stromy;
        for (const [u, v] of stromy) {
          const p = bod(u, v), s = Z * (0.85 + ((u * 7 + v * 13) % 0.3));
          if (maStromy) {
            const hsh = ((i * 31 + Math.round(u * 97 + v * 53)) * 2654435761) >>> 0;
            const k = snih ? 8 + (hsh % 2) : (hsh % 10 < 7 ? hsh % 4 : 4 + (hsh >> 4) % 4);
            sprite(g, 'stromy', k, p[0], p[1] + 1 * Z, 19 * s);
            continue;
          }
          g.fillStyle = '#5a3d22'; g.fillRect(p[0] - 1.2 * s, p[1] - 6 * s, 2.4 * s, 6 * s);
          g.beginPath(); g.moveTo(p[0], p[1] - 22 * s); g.lineTo(p[0] + 7 * s, p[1] - 4 * s); g.lineTo(p[0] - 7 * s, p[1] - 4 * s); g.closePath();
          g.fillStyle = snih ? '#e6eef2' : rgb([46, 98, 44], 0.9 + u * 0.25); g.fill();
          g.beginPath(); g.moveTo(p[0], p[1] - 22 * s); g.lineTo(p[0] + 7 * s, p[1] - 4 * s); g.lineTo(p[0], p[1] - 4 * s); g.closePath();
          g.fillStyle = snih ? 'rgba(120,140,160,.35)' : 'rgba(0,0,0,.18)'; g.fill();
        }
      }
      if (!jenObj) {
      if (m.stan[i] && m.kolej[i]) {
        // nízká nástupiště po obou stranách koleje, na zadním stříška na sloupcích v barvě firmy
        const podelX = m.osa[i] === 1, zakl = Math.max(r[0], r[1], r[2], r[3]);
        const uv = (a, b, hpx) => { const p = podelX ? bod(a, b, zakl) : bod(b, a, zakl); return [p[0], p[1] - (hpx || 0) * Z]; };
        const plosina = (b0, b1) => {
          const hr = 3;
          poly([uv(1, b0), uv(1, b1), uv(1, b1, hr), uv(1, b0, hr)], '#9d968a');
          poly([uv(0, b1), uv(1, b1), uv(1, b1, hr), uv(0, b1, hr)], '#8a8378');
          const dl = vzorek(g, TX.DLAZBA, Z);
          poly([uv(0, b0, hr), uv(1, b0, hr), uv(1, b1, hr), uv(0, b1, hr)], dl || '#d2ccbe');
        };
        plosina(0, 0.22); plosina(0.78, 1);
        // sloupky a střecha stříšky (zadní nástupiště)
        g.fillStyle = '#5a5e64';
        for (const a of [0.2, 0.8]) { const p0 = uv(a, 0.11, 3), p1 = uv(a, 0.11, 15); g.fillRect(p1[0] - 0.8 * Z, p1[1], 1.6 * Z, p0[1] - p1[1]); }
        const cs = hexNaRgb(volby.barvaFirmy);
        poly([uv(0.02, -0.02, 15), uv(0.98, -0.02, 15), uv(0.98, 0.26, 15), uv(0.02, 0.26, 15)], rgb(cs, 1.0));
        poly([uv(0.02, 0.26, 15), uv(0.98, 0.26, 15), uv(0.98, 0.26, 13), uv(0.02, 0.26, 13)], rgb(cs, 0.7));
      } else if (m.stan[i] && m.osa[i] === 6) {
        // heliport: betonová plocha, bílý kruh s H
        const vz2 = vzorek(g, TX.BETON, Z);
        poly([bod(0.06, 0.06), bod(0.94, 0.06), bod(0.94, 0.94), bod(0.06, 0.94)], vz2 || '#9a9890');
        g.strokeStyle = '#f4f1ea'; g.lineWidth = Math.max(1, 1.4 * Z);
        g.beginPath(); for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2, p = bod(0.5 + Math.cos(a) * 0.32, 0.5 + Math.sin(a) * 0.32); g[k ? 'lineTo' : 'moveTo'](p[0], p[1]); } g.stroke();
        g.beginPath();
        for (const [a0, b0, a1, b1] of [[0.38, 0.36, 0.38, 0.64], [0.62, 0.36, 0.62, 0.64], [0.38, 0.5, 0.62, 0.5]]) { const p0 = bod(a0, b0), p1 = bod(a1, b1); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
        g.stroke();
        const pz = bod(0.95, 0.95); g.fillStyle = volby.barvaFirmy; g.fillRect(pz[0] - 0.8 * Z, pz[1] - 14 * Z, 1.6 * Z, 14 * Z); g.fillRect(pz[0], pz[1] - 14 * Z, 6 * Z, 4 * Z);
      } else if (m.stan[i] && m.osa[i] === 5) {
        // bóje: červenobílý plovák s tyčkou
        const p = bod(0.5, 0.5, 0);
        g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(p[0], p[1] + 1 * Z, 6 * Z, 3 * Z, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#d8382c'; g.beginPath(); g.moveTo(p[0] - 5 * Z, p[1]); g.lineTo(p[0] + 5 * Z, p[1]); g.lineTo(p[0] + 2.5 * Z, p[1] - 9 * Z); g.lineTo(p[0] - 2.5 * Z, p[1] - 9 * Z); g.closePath(); g.fill();
        g.fillStyle = '#f4f1ea'; g.fillRect(p[0] - 3.6 * Z, p[1] - 6 * Z, 7.2 * Z, 2.4 * Z);
        g.fillStyle = '#2c2c30'; g.fillRect(p[0] - 0.6 * Z, p[1] - 15 * Z, 1.2 * Z, 6 * Z);
        g.fillStyle = volby.barvaFirmy; g.beginPath(); g.arc(p[0], p[1] - 15.5 * Z, 2 * Z, 0, Math.PI * 2); g.fill();
      } else if (m.stan[i] && m.osa[i] === 3) {
        // přístav: molo s jeřábkem směrem k vodě
        const zk = Math.max(r[0], r[1], r[2], r[3]), pz = bod(1, 1, zk), s = m.smer[i] - 1;
        if (!sprite(g, 'stanice', 8, pz[0], pz[1], 60 * Z, s % 2 === 0)) krabice(0.15, 0.15, 0.85, 0.85, 6, '#8a6a46', '#a07850', false);
      } else if (m.stan[i] && m.osa[i] === 4) {
        // letiště: ranvej (sprite letiště se kreslí navrch přes 3 × 3)
        const vz2 = vzorek(g, TX.BETON, Z);
        poly([bod(0, 0, r[0]), bod(1, 0, r[1]), bod(1, 1, r[2]), bod(0, 1, r[3])], vz2 || '#9a9890');
      } else if (m.stan[i]) {
        // průjezdná zastávka: přístřešky po obou stranách silnice
        const bus = m.osa[i] && MAG.hra && kdoStavi(m.stan[i] - 1, x, y) === 'bus';
        const stena = bus ? '#dfe3e6' : '#a08a6c', strecha = bus ? volby.barvaFirmy : '#6d5338';
        const podelX = m.osa[i] === 1;
        const uv = (a, b) => podelX ? bod(a, b) : bod(b, a);     // a = podél osy, b = napříč
        // zálivy (světlejší vozovka) s vodorovným značením
        poly([uv(0.08, 0.14), uv(0.92, 0.14), uv(0.92, 0.3), uv(0.08, 0.3)], bus ? '#c9c4b4' : '#bfae8e');
        poly([uv(0.08, 0.7), uv(0.92, 0.7), uv(0.92, 0.86), uv(0.08, 0.86)], bus ? '#c9c4b4' : '#bfae8e');
        g.strokeStyle = '#f2d24b'; g.lineWidth = Math.max(1, Z);
        g.beginPath();
        for (const b of [0.3, 0.7]) for (let k = 0; k < 4; k++) { const p0 = uv(0.1 + k * 0.22, b), p1 = uv(0.2 + k * 0.22, b); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
        g.stroke();
        const v = bus ? 12 : 7;
        const zadni = podelX ? bod(0.5, 0.1) : bod(0.1, 0.5);
        if (!sprite(g, 'stanice', bus ? 0 : 1, zadni[0], zadni[1] + 3 * Z, 30 * Z, !podelX)) {
          if (podelX) { krabice(0.2, 0.0, 0.8, 0.13, v, stena, strecha, false); krabice(0.2, 0.87, 0.8, 1.0, v, stena, strecha, false); }
          else { krabice(0.0, 0.2, 0.13, 0.8, v, stena, strecha, false); krabice(0.87, 0.2, 1.0, 0.8, v, stena, strecha, false); }
        }
        // sloupek s cedulkou v barvě firmy (přední roh)
        const pz = bod(0.9, 0.9);
        g.fillStyle = '#e8e8e8'; g.fillRect(pz[0] - 0.8 * Z, pz[1] - 22 * Z, 1.6 * Z, 22 * Z);
        g.beginPath(); g.arc(pz[0], pz[1] - 22 * Z, 4.2 * Z, 0, Math.PI * 2); g.fillStyle = volby.barvaFirmy; g.fill();
        g.lineWidth = Math.max(1, Z * 0.8); g.strokeStyle = '#fff'; g.stroke();
      }
      }
      const lodenice = m.depo[i] && !m.kolej[i] && !m.cesta[i] && (() => { const j = MAG.cesty.soused(m, i, m.smer[i] - 1); return j >= 0 && (m.typ[j] === T.VODA || (m.reka[j] && !m.cesta[j] && !m.kolej[j])); })();
      if (lodenice) {
        const zk = Math.max(r[0], r[1], r[2], r[3]), pz = bod(1, 1, zk);
        if (!sprite(g, 'stanice', 13, pz[0], pz[1], 60 * Z, (m.smer[i] - 1) % 2 === 0)) krabice(0.1, 0.1, 0.9, 0.9, 16, '#7a8a96', '#4a5560', false);
      } else if (m.depo[i]) {
        // garáž / depo: budova na straně od výjezdu, vrata k silnici či koleji
        const s = m.smer[i] - 1;
        const [u0, v0, u1, v1] = [[0.08, 0.42, 0.92, 0.95], [0.05, 0.08, 0.58, 0.92], [0.08, 0.05, 0.92, 0.58], [0.42, 0.08, 0.95, 0.92]][s];
        const zakl0 = Math.max(r[0], r[1], r[2], r[3]), pz = bod(1, 1, zakl0);
        if (!sprite(g, 'stanice', m.kolej[i] ? 4 : 5, pz[0], pz[1], 58 * Z, s % 2 === 0)) {
          if (m.kolej[i]) krabice(u0, v0, u1, v1, 20, '#9a6a52', '#4f4a46', false);
          else krabice(u0, v0, u1, v1, 15, '#cdbfae', volby.barvaFirmy, false);
        }
        const zakl = Math.max(r[0], r[1], r[2], r[3]);
        g.fillStyle = 'rgba(30,30,34,.85)';
        if (s === 1 && !OBR.stanice) poly([bod(u1, 0.3, zakl), bod(u1, 0.7, zakl), [bod(u1, 0.7, zakl)[0], bod(u1, 0.7, zakl)[1] - 10 * Z], [bod(u1, 0.3, zakl)[0], bod(u1, 0.3, zakl)[1] - 10 * Z]], 'rgba(30,30,34,.85)');
        if (s === 2 && !OBR.stanice) poly([bod(0.3, v1, zakl), bod(0.7, v1, zakl), [bod(0.7, v1, zakl)[0], bod(0.7, v1, zakl)[1] - 10 * Z], [bod(0.3, v1, zakl)[0], bod(0.3, v1, zakl)[1] - 10 * Z]], 'rgba(30,30,34,.85)');
      }
      if (m.dum[i] && OBR.domy1) {
        const d = m.domy[m.dum[i] - 1], zakl = Math.max(r[0], r[1], r[2], r[3]);
        const novy = (d.rok || 0) >= 1965 && OBR.domy2;
        const VARIANTY = novy ? { chalupa: [0, 1, 2], dum: [3, 6, 7], cinzak: [4, 5, 10, 11], kostel: [14] } : { chalupa: [0, 1, 2, 3], dum: [4, 5, 6, 7], cinzak: [8, 9, 10, 11], kostel: [12] };
        const l = VARIANTY[d.typ] || VARIANTY.dum, k = l[((m.dum[i] * 2654435761) >>> 12) % l.length];
        const p = bod(1, 1, zakl);
        const at = novy ? 'domy2' : 'domy1', fr = MAG.ATLAS && MAG.ATLAS[at] && MAG.ATLAS[at].snimky[k];
        if (fr && fr.length >= 7) sprite(g, at, k, p[0], p[1] - PH * Z * 0.04, 2 * PW * Z * 0.96);   // srovnaná: základna přesně na poli
        else sprite(g, at, k, p[0] - PW * Z * 0.02, p[1], 60 * Z);
      } else if (m.dum[i]) {
        const d = m.domy[m.dum[i] - 1], typD = D.DOMY.find(t => t.id === d.typ);
        if (typD.vez) {
          krabice(0.22, 0.12, 0.42, 0.32, 34, d.barva, d.strecha, false);   // věž vzadu → kreslit první
          krabice(0.2, 0.3, 0.8, 0.8, 16, d.barva, d.strecha, true);
        } else {
          const ok = typD.patra >= 4 ? 0.1 : 0.18;
          krabice(ok, ok, 1 - ok, 1 - ok, 6 + typD.patra * 7, d.barva, d.strecha, typD.patra < 4);
          if (Z >= 1) { // okna
            const zakl = Math.max(r[0], r[1], r[2], r[3]);
            g.fillStyle = 'rgba(40,50,70,.55)';
            for (let p = 0; p < typD.patra; p++) for (let k = 0; k < 2; k++) {
              const a = bod(ok + 0.15 + k * 0.35, 1 - ok, zakl);
              g.fillRect(a[0] - 2 * Z, a[1] - (6 + p * 7) * Z, 3 * Z, 3 * Z);
            }
          }
        }
      }
      if (m.prum[i] && !OBR.prumysl) {
        const q = m.prumysl[m.prum[i] - 1], p = D.PRUMYSL_PODLE_ID[q.typ];
        const lx = x - q.x, ly = y - q.y;
        const vys = p.vyska * (((lx + ly) % 2) ? 0.75 : 1);
        krabice(0.04, 0.04, 0.96, 0.96, vys, p.barva, null, false);
        if (p.komin && lx === q.w - 1 && ly === 0) krabice(0.35, 0.35, 0.6, 0.6, vys + 34, '#7d6e66', '#3a3430', false);
        if (q.typ === 'dul' && lx === 1 && ly === 1) krabice(0.3, 0.3, 0.7, 0.7, vys + 18, '#2c2c30', '#111', false);
        if (q.typ === 'vrt' && lx === 0 && ly === 0) krabice(0.4, 0.4, 0.6, 0.6, vys + 30, '#22222a', '#555', false);
      }
    }

    // --- bloky ----------------------------------------------------------------
    function obdelnikBloku(bx, by, Z) {
      const N = velBloku(Z), x0 = bx * N, y0 = by * N;
      return { x0, y0, N, l: (x0 - y0 - N) * PW * Z, t: (x0 + y0) * PH * Z - OKRAJ * Z, w: 2 * N * PW * Z, h: (2 * N * PH + OKRAJ + 16) * Z };   // +16 = řez okrajem mapy pod hladinou
    }
    function vytvorPlatno(w, h) {
      if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
      const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }
    function vykresliBlok(bx, by, Z) {
      const o = obdelnikBloku(bx, by, Z);
      const w = Math.ceil(o.w * dpr), h = Math.ceil(o.h * dpr);
      const c = vytvorPlatno(w, h), g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, -o.l * dpr, -o.t * dpr);
      g.lineJoin = 'round';
      const x1 = Math.min(m.W, o.x0 + o.N), y1 = Math.min(m.H, o.y0 + o.N);
      for (let s = o.x0 + o.y0; s <= x1 + y1 - 2; s++) {
        for (let x = Math.max(o.x0, s - (y1 - 1)); x <= Math.min(x1 - 1, s - o.y0); x++) kresliPole(g, x, s - x, Z);
      }
      return { c, px: w * h, o };
    }

    function zneplatni(x0, y0, x1, y1) {
      if (x0 === undefined) { mez.clear(); pixelu = 0; return; }
      for (const [k, b] of mez) {
        const o = b.o;
        // stavba sahá i do sousedních bloků (kopec mění výšky rohů) → okraj 1 pole
        if (x1 + 1 >= o.x0 && x0 - 1 < o.x0 + o.N && y1 + 1 >= o.y0 && y0 - 1 < o.y0 + o.N) { mez.delete(k); pixelu -= b.px; }
      }
    }

    /* Vykreslí viditelné bloky do kontextu `g` (v pixelech plátna).
       kamera {x, y} = střed pohledu ve světových px při Z = 1; vrací true, když ještě něco chybí (dokreslit příště). */
    function kresli(g, sirka, vyska, kamera, Z, rozpocetMs = 14) {
      const t0 = performance.now();
      const N = velBloku(Z), nbx = Math.ceil(m.W / N), nby = Math.ceil(m.H / N);
      const ox = sirka / 2 - kamera.x * Z, oy = vyska / 2 - kamera.y * Z;
      let chybi = false;
      for (let s = 0; s < nbx + nby - 1; s++) for (let bx = Math.max(0, s - nby + 1); bx <= Math.min(nbx - 1, s); bx++) {
        const by = s - bx, o = obdelnikBloku(bx, by, Z);
        if (o.l + ox > sirka || o.l + o.w + ox < 0 || o.t + oy > vyska || o.t + o.h + oy < 0) continue;
        const k = `${Z}:${bx}:${by}:${volby.mrizka ? 1 : 0}:${dpr}`;
        let b = mez.get(k);
        if (b) { mez.delete(k); mez.set(k, b); }
        else if (performance.now() - t0 < rozpocetMs) {
          b = vykresliBlok(bx, by, Z); mez.set(k, b); pixelu += b.px;
          while (pixelu > LIMIT_PX && mez.size > 1) { const [k0, b0] = mez.entries().next().value; mez.delete(k0); pixelu -= b0.px; }
        } else { chybi = true; continue; }
        g.drawImage(b.c, Math.round((o.l + ox) * dpr), Math.round((o.t + oy) * dpr), b.c.width, b.c.height);
      }
      return chybi;
    }

    // světový bod (fx, fy v polích, výška z mapy) → světové px při Z = 1
    function svetNaObr(fx, fy) {
      const x = Math.min(m.W - 1, Math.max(0, Math.floor(fx))), y = Math.min(m.H - 1, Math.max(0, Math.floor(fy)));
      const i = y * m.W + x;
      const hgt = m.most[i] ? m.mostV[i] : vyskaUV(M.rohy(m, x, y), fx - x, fy - y);
      return [(fx - fy) * PW, (fx + fy) * PH - hgt * VH];
    }
    /* vozidla: krabička orientovaná podél směru jízdy; seznam [{x, y, d, barva, naklad, druh, vybrane}] (x, y v polích).
       Kreslí se do kontextu v px obrazovky: posun (ox, oy) a přiblížení z. Řazení podle hloubky. */
    /* Zakrývání: předměty na polích těsně před vozidlem (domy, stromy, garáže, podniky) se po něm znovu nakreslí –
       každý hned po posledním (nejhlubším) vozidle, které zakrývá; vozidla dál vpředu je pak překreslí sama. */
    function zakryvajici(seznam, z) {
      const mapa = new Map();
      seznam.forEach((v, k) => {
        if (v.vyska) return;   // letadlo ve vzduchu nic nezakrývá
        const tx = Math.floor(v.x), ty = Math.floor(v.y);
        for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) {
          if (!dx && !dy) continue;
          const x = tx + dx, y = ty + dy;
          if (!M.uvnitr(m, x, y)) continue;
          const i = y * m.W + x;
          let klic, o;
          if (m.prum[i]) { const q = m.prumysl[m.prum[i] - 1]; if (!OBR.prumysl || z < 0.25 || q.zrusen) continue; klic = 'q' + q.id; o = { q, hl: q.x + q.w + q.y + q.h }; }
          else if (m.dum[i] || (m.les[i] && z >= 0.5 && !m.stan[i]) || (m.depo[i] && !m.kolej[i])) { klic = i; o = { x, y, hl: x + y + 1 }; }
          else continue;
          const b = mapa.get(klic);
          if (b) b.posl = k; else { o.posl = k; mapa.set(klic, o); }
        }
      });
      const po = new Map();
      for (const o of [...mapa.values()].sort((a, b) => a.hl - b.hl)) { if (!po.has(o.posl)) po.set(o.posl, []); po.get(o.posl).push(o); }
      return po;
    }
    function kresliVozidla(g, seznam, z, ox, oy) {
      seznam.sort((a, b) => (a.x + a.y) - (b.x + b.y));
      const zakryt = volby.zakryti === false ? new Map() : zakryvajici(seznam, z);
      seznam.forEach((v, poradi) => { kresliVozidlo(g, v, z, ox, oy); const l = zakryt.get(poradi); if (l) for (const o of l) {
        if (o.q) kresliPodnik(g, o.q, z, ox, oy);
        else { g.save(); g.translate(ox, oy); kresliPole(g, o.x, o.y, z, true); g.restore(); }
      } });
    }
    function kresliVozidlo(g, v, z, ox, oy) {
      {
        if (!v.vyska) { const tx = Math.floor(v.x), ty = Math.floor(v.y); if (M.uvnitr(m, tx, ty) && m.tunel[ty * m.W + tx]) return; }   // v tunelu není vidět
        // sprite z Blenderu, když je
        const A = MAG.ATLAS_VOZ, fr = A && v.typ && A.snimky[v.typ] && A.snimky[v.typ][v.k !== undefined ? v.k : SMER_NA_SNIMEK[v.d]];
        const typT = v.barvaTypu && fr && snimkyTypu(v.typ, v.barvaTypu);
        const atl = typT ? typT.c : fr && atlasVozidel(v.firma || v.barva);
        if (atl) {
          const [sx0, sy0] = svetNaObr(v.x, v.y), s = z * (PW * Math.SQRT2) / A.pxNaPole;
          const px = sx0 * z + ox;
          let py = sy0 * z + oy;
          const smer = v.k !== undefined ? v.k * Math.PI / 4 : [Math.PI * 1.5, 0, Math.PI / 2, Math.PI][v.d] || 0;
          const sm = (a, b) => [((Math.cos(smer) * a - Math.sin(smer) * b) - (Math.sin(smer) * a + Math.cos(smer) * b)) * PW * z, ((Math.cos(smer) * a - Math.sin(smer) * b) + (Math.sin(smer) * a + Math.cos(smer) * b)) * PH * z];   // posun v polích (podél, napříč) → px
          if (v.druh === 'lod' && v.jede) {   // brázda: dvě rozbíhavé pěnové čáry za zádí a pěna u přídě
            g.save(); g.lineCap = 'round';
            for (const [w, a] of [[3.2, 0.18], [1.4, 0.45]]) {
              g.strokeStyle = `rgba(240,248,255,${a})`; g.lineWidth = Math.max(1, w * z);
              g.beginPath();
              for (const b of [-1, 1]) { const p0 = sm(-0.42, b * 0.05), p1 = sm(-0.85, b * 0.16); g.moveTo(px + p0[0], py + p0[1]); g.lineTo(px + p1[0], py + p1[1]); }
              g.stroke();
            }
            const pr = sm(0.47, 0); g.fillStyle = 'rgba(240,248,255,.45)'; g.beginPath(); g.ellipse(px + pr[0], py + pr[1], 5 * z, 2.5 * z, 0, 0, Math.PI * 2); g.fill();
            g.restore();
          } else if (!v.vyska && v.druh !== 'lod') {   // měkký stín na zemi (světlo zleva shora → stín vpravo dole)
            const w = fr[2] * s;
            g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(px + w * 0.05, py + w * 0.03, w * 0.4, w * 0.16, 0, 0, Math.PI * 2); g.fill();
          }
          if (v.vyska) {   // letadlo: stín na zemi, samo výš
            g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(px, py, 14 * z, 6 * z, 0, 0, Math.PI * 2); g.fill();
            py -= v.vyska * 46 * z;
          }
          g.drawImage(atl, fr[0] - (typT ? typT.x0 : 0), fr[1] - (typT ? typT.y0 : 0), fr[2], fr[3], px - fr[4] * s, py - fr[5] * s, fr[2] * s, fr[3] * s);
          if (v.ukaz && v.podil !== undefined) {   // pruh naložení nad vozem
            const w = 15 * Math.max(0.6, z), hb = Math.max(2, 2.6 * z), by = py - fr[5] * s - hb - 2;
            g.fillStyle = 'rgba(20,22,26,.75)'; g.fillRect(px - w / 2 - 1, by - 1, w + 2, hb + 2);
            g.fillStyle = v.podil >= 0.999 ? '#7dff8e' : '#e8d14a'; g.fillRect(px - w / 2, by, w * Math.min(1, v.podil), hb);   // plný zeleně, jinak žlutě
          }
          if (v.vybrane) { g.strokeStyle = '#ffec8c'; g.lineWidth = 2; g.beginPath(); g.ellipse(px, py, 16 * z, 8 * z, 0, 0, Math.PI * 2); g.stroke(); }
          return;
        }
        const podelX = v.d === 1 || v.d === 3;
        const L = v.druh === 'bus' ? 0.27 : 0.25, S = 0.11;
        const ax = podelX ? L : S, ay = podelX ? S : L;
        const zem = (fx, fy) => { const [a, b] = svetNaObr(fx, fy); return [a * z + ox, b * z + oy]; };
        const vys = (v.druh === 'bus' ? 9 : 8) * z;
        const krabicka = (x0, y0, x1, y1, barva, vyska) => {
          const c = hexNaRgb(barva), up = p => [p[0], p[1] - vyska];
          const a = zem(x1, y0), b = zem(x1, y1), cc = zem(x0, y1), dd = zem(x0, y0);
          const p = (body, k) => { g.beginPath(); g.moveTo(body[0][0], body[0][1]); for (const q of body.slice(1)) g.lineTo(q[0], q[1]); g.closePath(); g.fillStyle = rgb(c, k); g.fill(); };
          p([a, b, up(b), up(a)], 0.8); p([cc, b, up(b), up(cc)], 0.62); p([up(dd), up(a), up(b), up(cc)], 1.05);
        };
        if (v.druh === 'lok' || v.druh === 'vagon') {
          const Lv = v.druh === 'lok' ? 0.3 : 0.22, Sv = 0.12;
          const bx = podelX ? Lv : Sv, by = podelX ? Sv : Lv;
          const vy = (v.druh === 'lok' ? 11 : 9) * z;
          krabicka(v.x - bx, v.y - by, v.x + bx, v.y + by, v.druh === 'lok' ? v.barva : v.barva || '#777', vy);
          if (v.druh === 'vagon' && v.plny && v.naklad) {   // náklad nahoře
            const [dx, dy] = [podelX ? bx * 0.75 : Sv * 0.7, podelX ? Sv * 0.7 : by * 0.75];
            const p = [zem(v.x - dx, v.y - dy), zem(v.x + dx, v.y - dy), zem(v.x + dx, v.y + dy), zem(v.x - dx, v.y + dy)].map(q => [q[0], q[1] - vy - 1]);
            g.beginPath(); p.forEach((q, k) => g[k ? 'lineTo' : 'moveTo'](q[0], q[1])); g.closePath(); g.fillStyle = v.naklad; g.fill();
          }
          if (v.druh === 'lok' && v.trakce === 'para') {   // komín vpředu
            const [dx, dy] = M.SOUSEDE4[v.d];
            krabicka(v.x + dx * 0.2 - 0.045, v.y + dy * 0.2 - 0.045, v.x + dx * 0.2 + 0.045, v.y + dy * 0.2 + 0.045, '#2a2a2e', vy + 3 * z);
          }
        } else if (v.druh === 'bus') {
          krabicka(v.x - ax, v.y - ay, v.x + ax, v.y + ay, v.barva, vys);
          // okna pruhem
          const [sx, sy] = zem(v.x, v.y);
          g.fillStyle = 'rgba(30,40,55,.55)';
          g.fillRect(sx - 7 * z, sy - vys * 0.78, 14 * z, 2.2 * z);
        } else {
          // kabina vpředu, korba vzadu v barvě nákladu
          const [dx, dy] = M.SOUSEDE4[v.d];
          const kx = v.x + dx * L * 0.62, ky = v.y + dy * L * 0.62, kz = v.x - dx * L * 0.3, kzy = v.y - dy * L * 0.3;
          const kab = podelX ? [0.09, S] : [S, 0.09], kor = podelX ? [L * 0.68, S] : [S, L * 0.68];
          const kreslitKabinuDriv = (v.d === 0 || v.d === 3);   // kabina vzadu na obrazovce → první
          const kabina = () => krabicka(kx - kab[0], ky - kab[1], kx + kab[0], ky + kab[1], v.barva, vys * 0.9);
          const korba = () => krabicka(kz - kor[0], kzy - kor[1], kz + kor[0], kzy + kor[1], v.naklad || '#888', vys * (v.plny ? 0.85 : 0.6));
          if (kreslitKabinuDriv) { kabina(); korba(); } else { korba(); kabina(); }
        }
        if (v.vybrane) {
          const [sx, sy] = zem(v.x, v.y);
          g.strokeStyle = '#ffec8c'; g.lineWidth = 2;
          g.beginPath(); g.ellipse(sx, sy, 16 * z, 8 * z, 0, 0, Math.PI * 2); g.stroke();
        }
      }
    }

    /* Noc: ztmavení (násobení modravou barvou) a světla – okna domů, lampy na městských silnicích, stanice,
       reflektory vozidel, blikačky letadel. n = 0 (den) … 1 (hluboká noc). Kreslí se v px obrazovky. */
    function kresliNoc(g, z, ox, oy, sirka, vyska, n, vozidla) {
      if (n <= 0.01) return;
      g.save();
      g.globalCompositeOperation = 'multiply';
      const k = n * 0.64;
      g.fillStyle = `rgb(${Math.round(255 - k * 205)},${Math.round(255 - k * 190)},${Math.round(255 - k * 130)})`;
      g.fillRect(0, 0, sirka, vyska);
      g.globalCompositeOperation = 'lighter';
      const bod = (fx, fy, nad) => { const [a, b] = svetNaObr(fx, fy); return [a * z + ox, b * z + oy - nad * z]; };
      const kruh = (p, r, barva) => { g.fillStyle = barva; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill(); };
      const zare = (p, r, rgb, a) => {   // měkká záře: přechod do průhledna, na zemi zploštělá
        const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        gr.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`); gr.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = gr; g.beginPath(); g.ellipse(p[0], p[1], r, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      };
      if (z >= 0.35) {
        // viditelná pole (bez výšky; dolů rezerva na kopce)
        const naPole = (sx, sy) => { const X = (sx - ox) / z, Y = (sy - oy) / z; return [(X / PW + Y / PH) / 2, (Y / PH - X / PW) / 2]; };
        const rez = (m.vrch || 4) * VH + 40;
        const rohy = [naPole(0, -40), naPole(sirka, -40), naPole(0, vyska + rez), naPole(sirka, vyska + rez)];
        const x0 = Math.max(0, Math.floor(Math.min(...rohy.map(p => p[0])))), x1 = Math.min(m.W - 1, Math.ceil(Math.max(...rohy.map(p => p[0]))));
        const y0 = Math.max(0, Math.floor(Math.min(...rohy.map(p => p[1])))), y1 = Math.min(m.H - 1, Math.ceil(Math.max(...rohy.map(p => p[1]))));
        const okno = `rgba(255,186,90,${(0.55 * n).toFixed(3)})`;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const i = y * m.W + x;
          if (m.dum[i]) {
            const hsh = (i * 2654435761) >>> 0;
            if ((hsh % 100) < n * 85) { kruh(bod(x + 0.45, y + 0.75, 9), 2.6 * z, okno); if (hsh & 64) kruh(bod(x + 0.75, y + 0.45, 13), 2.2 * z, okno); }
          } else if (m.cesta[i] === 1 && (x + y) % 2 === 0) zare(bod(x + 0.5, y + 0.5, 0), 11 * z, '255,206,120', 0.32 * n);
          else if (m.stan[i] && !m.tunel[i]) zare(bod(x + 0.5, y + 0.5, 0), 12 * z, '215,232,255', 0.34 * n);
        }
      }
      for (const v of vozidla || []) {
        if (v.vyska) {   // letadlo: blikačka
          if ((performance.now() / 500 | 0) % 2) kruh(bod(v.x, v.y, v.vyska * 46), 2.4 * z, `rgba(255,70,60,${n.toFixed(3)})`);
          continue;
        }
        if (v.druh === 'vagon') continue;
        const tx = Math.floor(v.x), ty = Math.floor(v.y);
        if (M.uvnitr(m, tx, ty) && m.tunel[ty * m.W + tx]) continue;
        const [dx, dy] = v.k !== undefined ? [Math.cos(v.k * Math.PI / 4), Math.sin(v.k * Math.PI / 4)] : M.SOUSEDE4[v.d] || [1, 0];
        zare(bod(v.x + dx * 0.5, v.y + dy * 0.5, 1), 9 * z, '255,240,190', 0.6 * n);
      }
      g.restore();
    }
    // míra noci pro herní čas: jeden den a noc za 8 herních dní, noc asi třetinu cyklu s plynulým soumrakem
    function noc(h) {
      const faze = ((h.den + (h.tick || 0) / D.DEN_TICKU) / 8) % 1, s = -Math.cos(faze * Math.PI * 2);
      const t = Math.max(0, Math.min(1, (s + 0.2) / 0.8));
      return t * t * (3 - 2 * t);
    }

    // body obrysu pole ve světových px (Z = 1)
    function obrysPole(x, y) {
      const r = M.rohy(m, x, y);
      return [[x - y, x + y, r[0]], [x + 1 - y, x + 1 + y, r[1]], [x - y, x + y + 2, r[2]], [x - y - 1, x + y + 1, r[3]]]
        .map(([a, b, h]) => [a * PW, b * PH - h * VH]);
    }
    function vBodu(p, poly) {
      let uvnitr = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) uvnitr = !uvnitr;
      }
      return uvnitr;
    }
    // pole pod bodem obrazovky (světové px při Z = 1); nejpřednější zásah vyhrává
    function poleNa(wx, wy) {
      let nej = null;
      for (let h = D.MAX_VYSKA; h >= 0; h--) {
        const a = wx / PW, b = (wy + h * VH) / PH;
        const tx = Math.floor((a + b) / 2), ty = Math.floor((b - a) / 2);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = tx + dx, y = ty + dy;
          if (!M.uvnitr(m, x, y) || (nej && x + y <= nej.x + nej.y)) continue;
          if (vBodu([wx, wy], obrysPole(x, y))) nej = { x, y };
        }
      }
      return nej;
    }
    // světový bod (Z = 1) středu pole
    function stredPole(x, y) {
      const r = M.rohy(m, x, y);
      return [(x - y) * PW, (x + y + 1) * PH - vyskaUV(r, 0.5, 0.5) * VH];
    }

    /* Podniky ze sprajtu: kreslí se každý snímek navrch (velký sprite by v blocích ořízla hranice bloku).
       Kotva = spodní roh základny (x + w, y + h), šířka = (w + h) polí. */
    const INDEX_PRUM = { dul: 0, elektrarna: 1, tezba: 2, pila: 3, rudnydul: 4, ocelarna: 5, tovarna: 6, farma: 7, potravinarna: 8, vrt: 9, rafinerie: 10, vodarna: 15 };
    function kresliPodnik(g, q, z, ox, oy, sirka = Infinity, vyska = Infinity) {
      const vys = m.v[(q.y + q.h) * m.R + q.x + q.w];
      const bx = (q.x + q.w - q.y - q.h) * PW * z + ox, by = ((q.x + q.w + q.y + q.h) * PH - vys * VH) * z + oy;
      const w = (q.w + q.h) * PW * z * 0.97;
      if (bx + w < 0 || bx - w > sirka || by < 0 || by - w * 1.4 > vyska) return;
      sprite(g, 'prumysl', INDEX_PRUM[q.typ] ?? 6, bx, by, w);
    }
    function kresliPrumysl(g, z, ox, oy, sirka, vyska) {
      if (!OBR.prumysl || z < 0.25) return;
      const viditelne = m.prumysl.filter(q => !q.zrusen).sort((a, b) => (a.x + a.w + a.y + a.h) - (b.x + b.w + b.y + b.h));
      for (const q of viditelne) kresliPodnik(g, q, z, ox, oy, sirka, vyska);
      for (const st of volby.stanice || []) if (st) for (const c of st.casti) {
        if (c.druh !== 'let' || c.typLet === 'heli') continue;
        const n = c.w || 3, vys = m.v[(c.y + n) * m.R + c.x + n];
        const bx = (c.x + n - c.y - n) * PW * z + ox, by = ((c.x + c.y + 2 * n) * PH - vys * VH) * z + oy, w = 2 * n * PW * z * 0.97;
        if (bx + w < 0 || bx - w > sirka || by < 0 || by - w * 1.4 > vyska) continue;
        sprite(g, 'prumysl', 13, bx, by, w);
      }
    }

    return {
      kresliPrumysl,
      kresli, zneplatni, poleNa, obrysPole, stredPole,
      nastav(v) { const zmena = (v.mrizka !== undefined && v.mrizka !== volby.mrizka) || (v.barvaFirmy && v.barvaFirmy !== volby.barvaFirmy); volby = { ...volby, ...v }; if (zmena) zneplatni(); },
      kresliVozidla, svetNaObr, kresliNoc, noc,
      nastavDpr(d) { if (d !== dpr) { dpr = d; zneplatni(); } },
      hloubka,
      get pocetBloku() { return mez.size; },
    };
  }

  // minimapa: barva pole podle vrstvy
  function barvaMinimapy(m, i, vrstva) {
    if (m.typ[i] === T.VODA) return [44, 96, 160];
    if (m.prum[i]) return hexRgb(D.PRUMYSL_PODLE_ID[m.prumysl[m.prum[i] - 1].typ].barva, 1.3);
    if (m.dum[i] || m.cesta[i]) return [214, 120, 80];
    if (m.reka[i]) return [70, 140, 200];
    if (vrstva === 'vyska') { const t = M.maxR(m, i % m.W, (i / m.W) | 0) / Math.max(1, m.vrch); return [80 + t * 150, 140 + t * 90, 70 + t * 160]; }
    if (m.les[i]) return [50, 100, 46];
    return D.BARVY_TERENU[m.typ[i]];
  }
  function hexRgb(h, k = 1) { return [parseInt(h.slice(1, 3), 16) * k, parseInt(h.slice(3, 5), 16) * k, parseInt(h.slice(5, 7), 16) * k].map(v => Math.min(255, v)); }

  MAG.grafika = { nactiVozidla, atlasVozidel, snimkyTypu, nactiAtlasy, OBR, sprite, Kreslic, barvaMinimapy, ZOOMY, PW, PH, VH, vyskaUV };
})(globalThis.MAG = globalThis.MAG || {});
