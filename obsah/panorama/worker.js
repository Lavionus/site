/* Skládání panoramat – výpočet mimo hlavní vlákno.
   Zprávy: zarovnej {snimky, nast} → zarovnano + nahled; prekresli {nast} → nahled;
   finalni {nast, meritko, format, kvalita, orez} → chciSnimek i ← snimek {i, bitmap} … → hotovo {blob} */
'use strict';
importScripts('jadro.js');

let snimky = [], vysl = null, cekam = null;
const post = (typ, x = {}) => postMessage({ typ, ...x });

onmessage = async e => {
  const m = e.data;
  try {
    if (m.typ === 'snimek') { if (cekam) cekam(m.bitmap); return; }
    if (m.typ === 'zarovnej') {
      snimky = m.snimky.map(s => ({ ...s, rgba: { w: s.w, h: s.h, d: s.rgba }, sedy: PANO.sedy({ w: s.w, h: s.h, d: s.rgba }).d }));
      const t0 = Date.now();
      vysl = PANO.zarovnej(snimky, nastavZarovnani(m.nast), (text, podil) => post('prubeh', { text, podil }));
      post('zarovnano', { hrany: vysl.hrany, koren: vysl.koren, body: vysl.body, spojene: vysl.T.map(Boolean), model: vysl.model, ms: Date.now() - t0 });
      nahled(m.nast);
    } else if (m.typ === 'prekresli') {
      if (vysl) nahled(m.nast);
    } else if (m.typ === 'finalni') {
      await finalni(m);
    }
  } catch (err) {
    post('chyba', { zprava: String(err && err.message || err) });
  }
};

/* nastavení v px celé fotky → px náhledu */
function nastavZarovnani(n) {
  return {
    valec: n.valec, model: n.model, maxBody: n.maxBody, vyrovnat: n.vyrovnat,
    rucni: (n.rucni || []).map(r => ({
      a: r.a, b: r.b,
      body: r.body.map(q => [...doNahledu(snimky[r.a], q[0], q[1]), ...doNahledu(snimky[r.b], q[2], q[3])])
    }))
  };
}
function doNahledu(s, x, y) { return [(x + 0.5) * s.w / s.plnaW - 0.5, (y + 0.5) * s.h / s.plnaH - 0.5]; }
/* pano jednotky = px náhledu kořenového snímku; mPano = kolik px celé fotky na jednotku */
function mPano() { const k = snimky[vysl.koren]; return k.plnaW / k.w; }

function pohledy(n) {
  const r = [], m = mPano();
  snimky.forEach((s, i) => {
    if (!vysl.T[i]) return;
    const u = n.upravy && n.upravy[i], uu = u && { dx: (u.dx || 0) / m, dy: (u.dy || 0) / m, uhel: u.uhel || 0 };
    const T = PANO.upravena(vysl.T[i], s.w, s.h, s.f, n.valec, uu);
    r.push({ i, v: PANO.pohled(s.w, s.h, s.f, n.valec, T) });
  });
  return r;
}

/* náhled: složit zmenšeniny, najít ořez, poslat obraz + obrysy + rozměr plného výstupu */
function nahled(n) {
  const pv = pohledy(n);
  if (!pv.length) { post('nahled', { prazdny: true }); return; }
  const V = pv.map(p => p.v), zdroje = pv.map(p => snimky[p.i].rgba);
  const b = PANO.hranice(V), sirka = b.x1 - b.x0, vyska = b.y1 - b.y0;
  if (!(sirka > 0 && vyska > 0) || sirka * vyska > 4e8) { post('chyba', { zprava: 'Výsledek vychází nesmyslně velký – snímky se nejspíš špatně spárovaly. Zkuste rovinnou/válcovou projekci, jiné ohnisko nebo ruční body.' }); return; }
  const k = Math.min(1, 2400 / sirka, 1600 / vyska);
  const W = Math.max(1, Math.ceil(sirka * k)), H = Math.max(1, Math.ceil(vyska * k));
  post('prubeh', { text: 'Skládám náhled…', podil: 0.97 });
  const zisk = n.zisky ? PANO.zisky(V, zdroje) : null;
  const pas = prechodPx(n, V) * k;
  const out = PANO.sloz(PANO.novyVystup(W, H, b.x0, b.y0, k), V, zdroje, zisk, pas);
  // ořez: vnitřní obdélník, o 1 px menší kvůli okrajům
  let orez = null;
  if (n.orez) {
    const o = PANO.nejvetsiObdelnik((x, y) => out.d[(y * W + x) * 4 + 3] > 0, W, H);
    if (o.w > 4 && o.h > 4) orez = { x: o.x + 1, y: o.y + 1, w: o.w - 2, h: o.h - 2 };
  }
  const obrysy = pv.map(p => ({ i: p.i, body: PANO.obrys(p.v, 8).map(([x, y]) => [(x - b.x0) * k, (y - b.y0) * k]) }));
  const m = mPano(), r = orez || { x: 0, y: 0, w: W, h: H };
  post('nahled', {
    W, H, rgba: out.d, obrysy, orez, k, mPano: m, zisk,
    plnyW: Math.round(r.w / k * m), plnyH: Math.round(r.h / k * m)
  }, );
}
function prechodPx(n, V) {
  const sir = V.reduce((s, v) => s + v.w, 0) / V.length;
  return sir * (n.prechod || 0) / 100;
}

async function finalni(m) {
  const n = m.nast, pv = pohledy(n), V = pv.map(p => p.v), zdroje = pv.map(p => snimky[p.i].rgba);
  const b = PANO.hranice(V), sirka = b.x1 - b.x0, vyska = b.y1 - b.y0;
  // stejný ořez jako v náhledu (v jednotkách pano)
  const kN = Math.min(1, 2400 / sirka, 1600 / vyska);
  let x0 = b.x0, y0 = b.y0, sw = sirka, sh = vyska;
  if (m.orez) { x0 = b.x0 + m.orez.x / kN; y0 = b.y0 + m.orez.y / kN; sw = m.orez.w / kN; sh = m.orez.h / kN; }
  const k = mPano() * m.meritko;
  const W = Math.max(1, Math.round(sw * k)), H = Math.max(1, Math.round(sh * k));
  const zisk = n.zisky ? PANO.zisky(V, zdroje) : null;
  const out = PANO.novyVystup(W, H, x0, y0, k);
  const pas = prechodPx(n, V) * k;
  const por = PANO.poradi(V);
  for (let j = 0; j < por.length; j++) {
    const idx = por[j];
    post('prubeh', { text: `Plné rozlišení: snímek ${j + 1}/${por.length}`, podil: j / por.length });
    const bmp = await new Promise(res => { cekam = res; post('chciSnimek', { i: pv[idx].i }); });
    cekam = null;
    const c = new OffscreenCanvas(bmp.width, bmp.height), cx = c.getContext('2d');
    cx.drawImage(bmp, 0, 0); bmp.close();
    const src = { w: c.width, h: c.height, d: cx.getImageData(0, 0, c.width, c.height).data };
    c.width = c.height = 1;
    PANO.pridej(out, V[idx], src, zisk && zisk[idx], pas);
  }
  post('prubeh', { text: 'Ukládám obrázek…', podil: 0.99 });
  // neplatné pixely mimo ořez: u JPG bílé, u PNG průhledné
  if (m.format === 'image/jpeg') for (let i = 3; i < out.d.length; i += 4) if (!out.d[i]) { out.d[i - 3] = out.d[i - 2] = out.d[i - 1] = 255; out.d[i] = 255; }
  const c = new OffscreenCanvas(W, H);
  c.getContext('2d').putImageData(new ImageData(out.d, W, H), 0, 0);
  const blob = await c.convertToBlob({ type: m.format, quality: m.kvalita });
  post('hotovo', { blob, W, H });
}
