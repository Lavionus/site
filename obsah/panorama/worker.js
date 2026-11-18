/* Skládání panoramat – výpočet mimo hlavní vlákno.
   Zprávy (UI → worker):
     zarovnej {snimky, nast, rucni}   najít body + optimalizovat → zarovnano + nahled
     optimalizuj {kb, nast, teply}     jen optimalizace nad danými kontrolními body → zarovnano + nahled
     prekresli {nast, rychle}          → nahled
     equi360 {nast}                    → equi360 (náhled pro prohlížeč 360°)
     finalni {nast, meritko, format, kvalita, orez, xmp} → chciSnimek i ← snimek {bitmap} … → hotovo {blob}
   Kontrolní body i úpravy chodí z UI v px celé fotky, uvnitř se počítá v px náhledu. */
'use strict';
importScripts('jadro.js', 'slozeni.js');

let snimky = [], vysl = null, kb = [], cekam = null, zisk = null, ziskKlic = '';
const post = (typ, x = {}) => postMessage({ typ, ...x });

onmessage = async e => {
  const m = e.data;
  try {
    if (m.typ === 'snimek') { if (cekam) cekam(m.bitmap); return; }
    if (m.typ === 'zarovnej') {
      snimky = m.snimky.map(s => ({ ...s, rgba: { w: s.w, h: s.h, d: s.rgba }, sedy: PANO.sedy({ w: s.w, h: s.h, d: s.rgba }).d }));
      const t0 = Date.now(), nast = m.nast;
      const rucni = (m.rucni || []).map(r => ({ a: r.a, b: r.b, body: r.body.map(q => naNahled(r.a, r.b, q)) }));
      if (m.kb) {   // otevřený projekt: uložené kontrolní body, bez hledání
        kb = m.kb.filter(e => e.body.length && snimky[e.a] && snimky[e.b] && e.a !== e.b).map(e => ({ a: e.a, b: e.b, body: e.body.map(q => naNahled(e.a, e.b, q)) }));
        return optimalizuj(nast, null, Date.now() - t0, null);
      }
      const nb = PANO.najdiBody(snimky, { ...nast, rucni }, (text, podil) => post('prubeh', { text, podil }));
      kb = nb.kb;
      optimalizuj(nast, null, Date.now() - t0, nb.statistika);
    } else if (m.typ === 'optimalizuj') {
      if (!snimky.length) return post('chyba', { zprava: 'Nejdřív složte panorama.' });
      kb = m.kb.filter(e => e.body.length && snimky[e.a] && snimky[e.b] && e.a !== e.b).map(e => ({ a: e.a, b: e.b, body: e.body.map(q => naNahled(e.a, e.b, q)) }));
      post('prubeh', { text: 'Optimalizuji…', podil: 0.5 });
      optimalizuj(m.nast, m.teply && vysl, 0, null);
    } else if (m.typ === 'prekresli') {
      if (vysl) nahled(m.nast, m.rychle);
    } else if (m.typ === 'equi360') {
      if (vysl) equi360(m.nast);
    } else if (m.typ === 'finalni') {
      await finalni(m);
    }
  } catch (err) {
    post('chyba', { zprava: String(err && err.message || err) });
  }
};

/* px celé fotky ↔ px náhledu */
const doN = (s, x, y) => [(x + 0.5) * s.w / s.plnaW - 0.5, (y + 0.5) * s.h / s.plnaH - 0.5];
const zN = (s, x, y) => [(x + 0.5) * s.plnaW / s.w - 0.5, (y + 0.5) * s.plnaH / s.h - 0.5];
const naNahled = (a, b, q) => [...doN(snimky[a], q[0], q[1]), ...doN(snimky[b], q[2], q[3]), q[4] || 0];
const naPlne = (a, b, q) => [...zN(snimky[a], q[0], q[1]), ...zN(snimky[b], q[2], q[3]), q[4] || 0];

function optimalizuj(nast, start, msHledani, statistika) {
  const t0 = Date.now();
  vysl = PANO.optimalizuj(snimky, kb, { ...nast, cistit: !!statistika }, start ? { R: vysl.R, f: vysl.f } : null);
  kb = vysl.kb;
  zisk = null;
  const kor = snimky[vysl.koren] || snimky[0], mk = s => s.plnaW / s.w;
  post('zarovnano', {
    kb: kb.map(e => ({ a: e.a, b: e.b, body: e.body.map(q => naPlne(e.a, e.b, q)) })),
    chyby: vysl.chyby.map((c, i) => c.map(x => x == null ? null : x * mk(snimky[kb[i] ? kb[i].a : 0]))),
    hrany: vysl.hrany.map(h => ({ ...h, rms: h.rms == null ? null : h.rms * mk(snimky[h.a]), max: h.max * mk(snimky[h.a]) })),
    statistika, spojene: vysl.spojene, koren: vysl.koren, iter: vysl.iter,
    rms: vysl.rms == null ? null : vysl.rms * mk(kor), max: vysl.max * mk(kor),
    f: vysl.f ? vysl.f.map((f, i) => f * mk(snimky[i])) : null, R: vysl.R || null, Rv: vysl.Rv || null,
    ms: msHledani + Date.now() - t0
  });
  nahled(nast);
}

/* pohledy aktuálního řešení s natočením pohledu a ručními úpravami */
function kPlny() {
  const k = snimky[vysl.koren];
  return vysl.T ? k.plnaW / k.w : vysl.f[vysl.koren] * k.plnaW / k.w;
}
function pohledy(n, projekce) {
  const r = [];
  if (vysl.T) {
    const m = kPlny();
    snimky.forEach((s, i) => {
      if (!vysl.T[i]) return;
      const u = n.upravy && n.upravy[i], uu = u && { dx: (u.dx || 0) / m, dy: (u.dy || 0) / m, uhel: u.uhel || 0 };
      r.push({ i, v: PANO.pohledRovina(s.w, s.h, PANO.upravenaRovina(vysl.T[i], uu)) });
    });
    return r;
  }
  const p = n.pohled || {}, Pm = PANO.nas(PANO.pohledU(p.yaw || 0, p.pitch || 0, p.roll || 0), vysl.Rv);
  snimky.forEach((s, i) => {
    if (!vysl.R[i]) return;
    const u = n.upravy && n.upravy[i];
    let M = PANO.nas(vysl.R[i], PANO.tr(Pm));
    if (u && u.Q) M = PANO.nas(M, PANO.tr(u.Q));
    r.push({ i, v: PANO.pohledKoule(s.w, s.h, vysl.f[i], M, projekce || n.projekce) });
  });
  return r;
}
/* šířka lineárního přechodu: procento šířky snímku (u koule úhlové) převedené na px výstupu */
function nastaveniSkladani(n, rychle, V, k) {
  if (rychle) return { prolnuti: 'zadne', sev: 'vaha' };
  const v = V[0], sirka = v.typ === 'koule' ? 2 * Math.atan(v.w / 2 / v.f) : v.w;
  return { prolnuti: n.prolnuti || 'multi', sev: n.sev || 'vaha', pasma: 7, pas: (n.prechod || 0) / 100 * sirka * k };
}
function spoctiZisk(n, V, zdroje, roz) {
  if (!n.zisky) return null;
  const klic = JSON.stringify([n.projekce, n.pohled, n.upravy, V.length]);
  if (!zisk || ziskKlic !== klic) { zisk = PANO.zisky(V, zdroje, roz); ziskKlic = klic; }
  return zisk;
}
function velikost(roz, k) {
  return { W: Math.max(1, roz.obtoc ? Math.round(2 * Math.PI * k) : Math.ceil((roz.x1 - roz.x0) * k)), H: Math.max(1, Math.ceil((roz.y1 - roz.y0) * k)) };
}
function kNahledu(roz, mw, mh) { return Math.min(kPlny(), mw / (roz.obtoc ? 2 * Math.PI : roz.x1 - roz.x0), mh / (roz.y1 - roz.y0)); }
function pripravRozvrh(n, projekce) {
  const pv = pohledy(n, projekce);
  if (!pv.length) return null;
  const V = pv.map(p => p.v), zdroje = pv.map(p => snimky[p.i].rgba), roz = PANO.rozvrh(V);
  const ok = roz.x1 > roz.x0 && roz.y1 > roz.y0 && (roz.x1 - roz.x0) * (roz.y1 - roz.y0) * kPlny() ** 2 < 4e9;
  return { pv, V, zdroje, roz, ok };
}

/* náhled: složit zmenšeniny, najít ořez, poslat obraz + obrysy + rozměr plného výstupu */
function nahled(n, rychle) {
  const p = pripravRozvrh(n);
  if (!p) { post('nahled', { prazdny: true }); return; }
  if (!p.ok) { post('chyba', { zprava: 'Výsledek vychází nesmyslně velký – snímky se nejspíš špatně spárovaly, nebo projekce nesedí (přímočará nad 150°). Zkuste jinou projekci, ohnisko nebo zkontrolujte kontrolní body.' }); return; }
  const { pv, V, zdroje, roz } = p;
  const k = kNahledu(roz, rychle ? 1000 : 2400, rychle ? 700 : 1600), { W, H } = velikost(roz, k);
  if (!rychle) post('prubeh', { text: 'Skládám náhled…', podil: 0.97 });
  const g = spoctiZisk(n, V, zdroje, roz);
  const out = PANO.sloz(PANO.novyVystup(W, H, roz.x0, roz.y0, k, roz.obtoc), V, roz, zdroje, g, nastaveniSkladani(n, rychle, V, k));
  let orez = null;
  if (n.orez && n.projekce !== 'stereo') {   // malá planeta je kruh – obdélník by ji usekl
    const o = PANO.nejvetsiObdelnik((x, y) => out.d[(y * W + x) * 4 + 3] > 0, W, H);
    // u celých 360° zůstane plná šířka (navazující okraje), ořízne se jen nahoře a dole
    if (o.w > 4 && o.h > 4) orez = o.w >= W - 1 && o.h >= H - 1 ? null : roz.obtoc && o.w >= W - 1 ? { x: 0, y: o.y + 1, w: W, h: o.h - 2 } : { x: o.x + 1, y: o.y + 1, w: o.w - 2, h: o.h - 2 };
  }
  const obrysy = pv.map(q => ({ i: q.i, body: PANO.obrysRozbaleny(q.v, 8, roz.x0).map(([x, y]) => [(x - roz.x0) * k, (y - roz.y0) * k]) }));
  const r = orez || { x: 0, y: 0, w: W, h: H }, kp = kPlny();
  const pocty = { sirka: roz.obtoc ? 360 : null };
  if (vysl.R && !vysl.T && PANO.PROJEKCE[n.projekce] && PANO.PROJEKCE[n.projekce].delka) {
    pocty.sirka = Math.round(r.w / k / PANO.RAD); pocty.vyska = Math.round(r.h / k / PANO.RAD);
  }
  post('nahled', {
    W, H, rgba: out.d, obrysy, orez, k, kPlny: kp, zisk: g, rychle: !!rychle, obtoc: roz.obtoc, x0: roz.x0, y0: roz.y0,
    plnyW: Math.round(r.w / k * kp), plnyH: Math.round(r.h / k * kp), uhly: pocty
  }, [out.d.buffer]);
}

/* náhled equirect celé koule pro prohlížeč 360° */
function equi360(n) {
  if (vysl.T) return post('chyba', { zprava: 'Prohlížeč 360° potřebuje sférický model – rovinná mozaika do koule nepatří.' });
  const p = pripravRozvrh(n, 'equi');
  if (!p || !p.ok) return post('chyba', { zprava: 'Panorama zatím nejde zobrazit.' });
  const { V, zdroje, roz } = p, k = Math.min(kPlny(), 2048 / (2 * Math.PI));
  const { W, H } = velikost(roz, k);
  post('prubeh', { text: 'Připravuji pohled 360°…', podil: 0.5 });
  const out = PANO.sloz(PANO.novyVystup(W, H, roz.x0, roz.y0, k, roz.obtoc), V, roz, zdroje, spoctiZisk(n, V, zdroje, roz), nastaveniSkladani(n, false, V, k));
  post('equi360', { W, H, rgba: out.d, gpano: PANO.gpanoZVyrezu(W, H, roz.x0, roz.y0, k) }, [out.d.buffer]);
}

async function finalni(m) {
  const n = m.nast, p = pripravRozvrh(n);
  if (!p || !p.ok) throw new Error('Není co ukládat.');
  const { pv, V, zdroje, roz } = p;
  const kN = kNahledu(roz, 2400, 1600), k = kPlny() * m.meritko;
  let x0 = roz.x0, y0 = roz.y0, sw = roz.obtoc ? 2 * Math.PI : roz.x1 - roz.x0, sh = roz.y1 - roz.y0, obtoc = roz.obtoc;
  if (m.orez) {
    y0 = roz.y0 + m.orez.y / kN; sh = m.orez.h / kN;
    if (!(roz.obtoc && m.orez.x === 0 && m.orez.w >= Math.round(2 * Math.PI * kN))) { x0 = roz.x0 + m.orez.x / kN; sw = m.orez.w / kN; obtoc = false; }
  }
  const W = Math.max(1, obtoc ? Math.round(2 * Math.PI * k) : Math.round(sw * k)), H = Math.max(1, Math.round(sh * k));
  const g = spoctiZisk(n, V, zdroje, roz);
  const out = PANO.novyVystup(W, H, x0, y0, k, obtoc), o = nastaveniSkladani(n, false, V, k);
  const por = PANO.poradi(roz), posuny = roz.obtoc && !obtoc ? [0, -2 * Math.PI, 2 * Math.PI] : [0];
  for (let j = 0; j < por.length; j++) {
    const idx = por[j];
    post('prubeh', { text: `Plné rozlišení: snímek ${j + 1}/${por.length}`, podil: j / por.length });
    const bmp = await new Promise(res => { cekam = res; post('chciSnimek', { i: pv[idx].i }); });
    cekam = null;
    const c = new OffscreenCanvas(bmp.width, bmp.height), cx = c.getContext('2d');
    cx.drawImage(bmp, 0, 0); bmp.close();
    const src = { w: c.width, h: c.height, d: cx.getImageData(0, 0, c.width, c.height).data };
    c.width = c.height = 1;
    const b = roz.boxy[idx];
    for (const s of posuny) PANO.pridej(out, V[idx], s ? { ...b, x0: b.x0 + s, x1: b.x1 + s } : b, src, g && g[idx], o);
  }
  post('prubeh', { text: 'Ukládám obrázek…', podil: 0.99 });
  // neplatné pixely: u JPG bílé, u PNG průhledné
  if (m.format === 'image/jpeg') for (let i = 3; i < out.d.length; i += 4) if (!out.d[i]) { out.d[i - 3] = out.d[i - 2] = out.d[i - 1] = 255; out.d[i] = 255; }
  const c = new OffscreenCanvas(W, H);
  c.getContext('2d').putImageData(new ImageData(out.d, W, H), 0, 0);
  let blob = await c.convertToBlob({ type: m.format, quality: m.kvalita });
  let gpano = null;
  if (m.xmp && n.projekce === 'equi' && !vysl.T) {
    gpano = PANO.gpanoZVyrezu(W, H, x0, y0, k);
    const bajty = new Uint8Array(await blob.arrayBuffer()), xmp = PANO.xmpGPano(gpano);
    blob = new Blob([m.format === 'image/png' ? PANO.vlozXmpPng(bajty, xmp) : PANO.vlozXmpJpeg(bajty, xmp)], { type: m.format });
  }
  post('hotovo', { blob, W, H, gpano });
}
