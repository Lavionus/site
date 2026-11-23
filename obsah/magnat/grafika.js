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
  const snimek = (atlas, k) => MAG.ATLAS && MAG.ATLAS[atlas] && MAG.ATLAS[atlas].snimky[k];
  // obrázek ze sprajtového atlasu: kotva = spodní střed; sirka v px, zrcadlit = převrátit vodorovně (druhá osa izometrie)
  function sprite(g, atlas, k, x, y, sirka, zrcadlit) {
    const im = OBR[atlas], f = snimek(atlas, k);
    if (!im || !f) return false;
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
      const n = zrnoPole((x >> 1) * 7 + (y >> 1) * 131);
      return n < 0.12 ? TX.SUCHA : n < 0.55 ? TX.TRAVA : TX.TRAVA2;
    }

    // --- kreslení jednoho pole ------------------------------------------------
    function kresliPole(g, x, y, Z) {
      const i = y * m.W + x, r = M.rohy(m, x, y);
      const bod = (u, v, h) => [((x + u) - (y + v)) * PW * Z, ((x + u) + (y + v)) * PH * Z - (h ?? vyskaUV(r, u, v)) * VH * Z];
      const poly = (body, barva) => {
        g.beginPath(); g.moveTo(body[0][0], body[0][1]);
        for (let k = 1; k < body.length; k++) g.lineTo(body[k][0], body[k][1]);
        g.closePath(); g.fillStyle = barva; g.fill();
      };
      const typ = m.typ[i];
      const sx = (r[1] + r[2] - r[0] - r[3]) / 2, sy = (r[3] + r[2] - r[0] - r[1]) / 2;
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
      if (m.reka[i]) pas(0.46, rgb([64, 126, 190], 0.96 + 0.1 * sx), (nx, ny) => M.uvnitr(m, nx, ny) && (m.reka[ny * m.W + nx] || m.typ[ny * m.W + nx] === T.VODA));
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
      if (m.cesta[i] || (m.depo[i] && !m.kolej[i])) pas(0.36, (Z >= 0.5 && vzorek(g, TX.ASFALT, Z)) || rgb([112, 110, 106], svetlo), spoj, hm);
      // kolej: štěrkové lože, pražce, kolejnice do každého směru s bitem
      if (m.kolej[i]) {
        const k = m.kolej[i], maBit = (nx, ny) => { const d = M.SOUSEDE4.findIndex(([a, b]) => a === nx - x && b === ny - y); return (k & (1 << d)) !== 0; };
        pas(0.44, (Z >= 0.5 && vzorek(g, TX.STERK, Z)) || rgb([150, 140, 122], svetlo), maBit, hm);
        if (Z >= 0.5) {
          g.lineCap = 'butt';
          for (let d = 0; d < 4; d++) {
            if (!(k & (1 << d))) continue;
            const [dx, dy] = M.SOUSEDE4[d];
            const pt = (a, b) => bod(0.5 + dx * a + dy * b, 0.5 + dy * a + dx * b, hm);   // a = podél ramene, b = napříč
            g.strokeStyle = '#6a4a32'; g.lineWidth = Math.max(1, 2.2 * Z);
            g.beginPath();
            for (let a = 0.08; a < 0.5; a += 0.14) { const p0 = pt(a, -0.17), p1 = pt(a, 0.17); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
            g.stroke();
            g.strokeStyle = '#3d3f44'; g.lineWidth = Math.max(1, 1.2 * Z);
            g.beginPath();
            for (const b of [-0.1, 0.1]) { const p0 = pt(-0.1, b), p1 = pt(0.5, b); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); }
            g.stroke();
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
      if (m.stan[i] && m.kolej[i]) {
        // nástupiště po obou stranách koleje, přístřešek v barvě firmy na zadním
        const podelX = m.osa[i] === 1;
        if (podelX) { krabice(0, 0.0, 1, 0.2, 3, '#cfc8b8', '#d8d2c4', false); krabice(0.15, 0.02, 0.85, 0.16, 14, '#cfc8b8', volby.barvaFirmy, false); krabice(0, 0.8, 1, 1, 3, '#cfc8b8', '#d8d2c4', false); }
        else { krabice(0.0, 0, 0.2, 1, 3, '#cfc8b8', '#d8d2c4', false); krabice(0.02, 0.15, 0.16, 0.85, 14, '#cfc8b8', volby.barvaFirmy, false); krabice(0.8, 0, 1, 1, 3, '#cfc8b8', '#d8d2c4', false); }
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
      if (m.depo[i]) {
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
        if (sprite(g, novy ? 'domy2' : 'domy1', k, p[0] - PW * Z * 0.02, p[1], 60 * Z)) { /* hotovo */ }
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
    function kresliVozidla(g, seznam, z, ox, oy) {
      seznam.sort((a, b) => (a.x + a.y) - (b.x + b.y));
      for (const v of seznam) {
        const podelX = v.d === 1 || v.d === 3;
        const L = v.druh === 'bus' ? 0.27 : 0.25, S = 0.11;
        const ax = podelX ? L : S, ay = podelX ? S : L;
        const zem = (fx, fy) => { const [a, b] = svetNaObr(fx, fy); return [a * z + ox, b * z + oy]; };
        const vys = (v.druh === 'bus' ? 9 : 8) * z;
        const nahoru = p => [p[0], p[1] - vys];
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
    function kresliPrumysl(g, z, ox, oy, sirka, vyska) {
      if (!OBR.prumysl || z < 0.25) return;
      const INDEX = { dul: 0, elektrarna: 1, tezba: 2, pila: 3, rudnydul: 4, ocelarna: 5, tovarna: 6, farma: 7, potravinarna: 8, vrt: 9, rafinerie: 10 };
      const viditelne = m.prumysl.filter(q => !q.zrusen).sort((a, b) => (a.x + a.w + a.y + a.h) - (b.x + b.w + b.y + b.h));
      for (const q of viditelne) {
        const vys = m.v[(q.y + q.h) * m.R + q.x + q.w];
        const bx = (q.x + q.w - q.y - q.h) * PW * z + ox, by = ((q.x + q.w + q.y + q.h) * PH - vys * VH) * z + oy;
        const w = (q.w + q.h) * PW * z * 0.97;
        if (bx + w < 0 || bx - w > sirka || by < 0 || by - w * 1.4 > vyska) continue;
        sprite(g, 'prumysl', INDEX[q.typ] ?? 6, bx, by, w);
      }
    }

    return {
      kresliPrumysl,
      kresli, zneplatni, poleNa, obrysPole, stredPole,
      nastav(v) { const zmena = (v.mrizka !== undefined && v.mrizka !== volby.mrizka) || (v.barvaFirmy && v.barvaFirmy !== volby.barvaFirmy); volby = { ...volby, ...v }; if (zmena) zneplatni(); },
      kresliVozidla, svetNaObr,
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

  MAG.grafika = { nactiAtlasy, OBR, sprite, Kreslic, barvaMinimapy, ZOOMY, PW, PH, VH, vyskaUV };
})(globalThis.MAG = globalThis.MAG || {});
