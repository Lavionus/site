/* Úhel dopadu krevních stop – rozhraní (jádro bez DOM: jadro.js, test _test/krevni_stopy_test.js, UI _test/krevni_stopy_ui.py) */
(function () {
'use strict';
const J = window.KrevniStopyJadro;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const RAD = Math.PI / 180;
if (window.self === window.top) document.body.classList.add('samostatne');
const fmt = (v, d) => Number.isFinite(v) ? v.toLocaleString(document.documentElement.lang || 'cs', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';

const NAPOVEDY = {
  posun: 'Táhnutím posun, kolečkem nebo dvěma prsty zoom. Klik na stopu ji vybere.',
  meritko: 'Klikněte na dva body měřítka se známou vzdáleností (např. 0 a 100 mm na pravítku), pak zadáte vzdálenost.',
  perspektiva: 'Klikněte na 4 rohy obdélníku známých rozměrů, který leží v rovině stop – v pořadí levý dolní, pravý dolní, pravý horní, levý horní (jak by ležel na narovnané fotce).',
  pocatek: 'Klikněte na referenční bod plochy (počátek souřadnic). Osa x doprava, y nahoru.',
  body: 'Klikejte po okraji eliptické části stopy (bez ocásku a satelitů), aspoň 5 bodů, nejlépe 8–12 rovnoměrně dokola. Pak Proložit nebo Enter.',
  prah: 'Klikněte do stopy: vybere se souvislá oblast tmavší než práh a elipsa se spočte z momentů. Je-li ocásek spojený se stopou, délka vyjde větší – pak raději body.',
  ocasek: 'Klikněte na stranu vybrané stopy, kam míří ocásek (směr letu kapky).'
};
/* barvy překryvů – pevné, protože leží na fotce (nezávisle na tématu) */
const ZBARVY = ['#d84315', '#6a1b9a', '#00838f', '#2e7d32', '#ad1457', '#5d4037'];
const SEDA = '#8a8a8a', MODRA = '#1565c0', ZELENA = '#2e7d32';
const barvaZdroje = i => ZBARVY[i % ZBARVY.length];
const KLADENI = new Set(['meritko', 'perspektiva', 'pocatek', 'body', 'prah', 'ocasek']);

/* ---------- stav ---------- */
let data = J.prazdna();
const fotky = {}; // id plochy → { obr (canvas), blob, jasy, prahOtsu, textura }
let prah = 128;
let nastroj = 'posun', predchozi = 'body', pohled = 'foto', vybrana = null;
let rozpracovane = [], meritkoBody = [], rohyBody = [], rozmerObdelniku = [297, 210];
let pohledFoto = { s: 1, tx: 0, ty: 0 }, celaFotka = true;
let A = null, mc = null, lupa = true, mys = null;
let razeni = { k: 'nazev', smer: 1 };

const plocha = () => data.plochy.find(p => p.id === data.aktivni) || data.plochy[0];
const fotka = () => fotky[plocha().id] || null;
const obrazek = () => (fotka() || {}).obr || null;
const jednotka = () => J.vsechnyMm(data) ? 'mm' : 'px';
const nazevPlochy = id => (data.plochy.find(p => p.id === id) || {}).nazev || id;
const stopa = id => data.stopy.find(s => s.id === id);
const rovinaStopy = id => A && A.rovina.find(r => r.id === id);
const odlehla = id => !!A && A.odlehle.includes(id);
function barvaStopy(s) {
  if (!s.pouzit) return SEDA;
  const zi = A && A.vZdroji[s.id];
  return zi != null ? barvaZdroje(zi) : odlehla(s.id) ? SEDA : MODRA;
}

/* ---------- IndexedDB ---------- */
const DB = 'webapp_krevni_stopy';
function otevriDb() {
  return new Promise((ok, ne) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('projekt');
    r.onsuccess = () => ok(r.result); r.onerror = () => ne(r.error);
  });
}
async function dbOperace(fn) {
  const db = await otevriDb();
  return new Promise((ok, ne) => {
    const t = db.transaction('projekt', 'readwrite'), st = t.objectStore('projekt'), r = fn(st);
    t.oncomplete = () => { db.close(); ok(r && r.result); }; t.onerror = () => { db.close(); ne(t.error); };
  });
}
let casUlozeni = 0;
function uloz() {
  clearTimeout(casUlozeni);
  casUlozeni = setTimeout(() => {
    const obrazky = {};
    for (const pl of data.plochy) if (fotky[pl.id]) obrazky[pl.id] = fotky[pl.id].blob;
    dbOperace(st => st.put({ data, obrazky }, 'aktualni')).catch(() => Dialog.chyba('Projekt se nepodařilo uložit do prohlížeče.'));
  }, 400);
}
function obnovUkazku(d) {
  const u = d && d.ukazka;
  if (u && typeof u.id === 'string' && J.UKAZKY.some(x => x.id === u.id) && Array.isArray(u.zdroje))
    data.ukazka = { id: u.id, zdroje: u.zdroje.filter(z => Array.isArray(z) && z.length === 3 && z.every(Number.isFinite)) };
}
async function nacti() {
  try {
    const z = await dbOperace(st => st.get('aktualni'));
    if (!z) return;
    data = J.migruj(z.data);
    obnovUkazku(z.data);
    const obr = z.obrazky || (z.obrazek ? { [data.plochy[0].id]: z.obrazek } : {});
    for (const pl of data.plochy) if (obr[pl.id]) await nastavObrazek(pl.id, obr[pl.id], false);
  } catch (e) { /* bez IndexedDB se jen neukládá */ }
}

/* ---------- obrázek ---------- */
const MAX_STRANA = 4000;
async function nastavObrazek(id, blob, novy) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, MAX_STRANA / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  const jasy = J.jas(x.getImageData(0, 0, c.width, c.height).data), prahOtsu = J.otsu(jasy);
  fotky[id] = { obr: c, blob: k < 1 ? await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.92)) : blob, jasy, prahOtsu, textura: null };
  const pl = data.plochy.find(p => p.id === id);
  if (novy && pl) pl.kal = Object.assign(J.novaPlocha().kal, { ox: 0, oy: c.height });
  if (id === plocha().id) prah = prahOtsu;
}
function obnovUvod() {
  $('bezFotky').hidden = !!obrazek();
  $('zoomTl').hidden = !obrazek();
}

/* ---------- výpočet ---------- */
let casMc = 0;
function prepocti() {
  A = J.analyza(data);
  if (vybrana && !stopa(vybrana)) vybrana = null;
  mc = null;
  clearTimeout(casMc);
  if (A.zdroje.length) casMc = setTimeout(() => {
    mc = J.nejistotaZdroju(A.rovina, A.baze, A.zdroje, { sRozmer: data.nastaveni.sRozmer, sGamma: data.nastaveni.sGamma, n: 300, seed: 1 });
    obnovPohled();
  }, 250);
}
function obnovPohled() {
  if (pohled === 'foto') { vykresliPanel(); kresliPlatno(); } else if (pohled === 'tabulka') vykresliTabulku(); else kresli3d();
}
function zmena() { prepocti(); uloz(); vykresli(); }

/* ---------- kreslení (plátno i SVG stejným kódem) ---------- */
function peroPlatno(c) {
  const cesta = body => { c.beginPath(); let prvni = true; for (const [x, y] of body) { if (!Number.isFinite(x) || !Number.isFinite(y)) { prvni = true; continue; } if (prvni) c.moveTo(x, y); else c.lineTo(x, y); prvni = false; } };
  return {
    cara(body, barva, sirka, carky) {
      c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
      if (carky) c.setLineDash(carky);
      cesta(body);
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = sirka + 2.5; c.stroke();
      c.strokeStyle = barva; c.lineWidth = sirka; c.stroke(); c.restore();
    },
    plocha(body, barva, pruhl, obrys) {
      c.save(); cesta(body); c.closePath();
      c.globalAlpha = pruhl; c.fillStyle = barva; c.fill(); c.globalAlpha = 1;
      if (obrys) { c.strokeStyle = obrys; c.lineWidth = 1.2; c.stroke(); }
      c.restore();
    },
    kruh(x, y, r, vypln, obrys, sirka) {
      c.save(); c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI);
      if (vypln) { c.fillStyle = vypln; c.fill(); }
      if (obrys) { c.strokeStyle = obrys; c.lineWidth = sirka || 1; c.stroke(); }
      c.restore();
    },
    text(t, x, y, barva) {
      c.save(); c.font = '600 12px system-ui,sans-serif'; c.lineWidth = 3.5; c.strokeStyle = 'rgba(255,255,255,.9)'; c.fillStyle = barva;
      c.strokeText(t, x, y); c.fillText(t, x, y); c.restore();
    }
  };
}
function peroSvg(casti) {
  const b = body => body.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return {
    cara(body, barva, sirka, carky) {
      const d = carky ? ` stroke-dasharray="${carky.join(' ')}"` : '', sp = ' fill="none" stroke-linejoin="round" stroke-linecap="round"' + d;
      casti.push(`<polyline points="${b(body)}"${sp} stroke="#fff" stroke-opacity="0.8" stroke-width="${sirka + 2.5}"/><polyline points="${b(body)}"${sp} stroke="${barva}" stroke-width="${sirka}"/>`);
    },
    plocha(body, barva, pruhl, obrys) { casti.push(`<polygon points="${b(body)}" fill="${barva}" fill-opacity="${pruhl}"${obrys ? ` stroke="${obrys}" stroke-width="1.2"` : ''}/>`); },
    kruh(x, y, r, vypln, obrys, sirka) { casti.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${vypln || 'none'}"${obrys ? ` stroke="${obrys}" stroke-width="${sirka || 1}"` : ''}/>`); },
    text(t, x, y, barva) { casti.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${barva}" stroke="#fff" stroke-opacity="0.9" stroke-width="3.5" paint-order="stroke" font-family="system-ui,sans-serif" font-size="12" font-weight="600">${esc(t)}</text>`); }
  };
}

/* překryvy plochy idPl; v = { s, tx, ty } (obrazovka = obraz·s + t) */
function kresliScenu(pero, v, idPl) {
  const pl = data.plochy.find(p => p.id === idPl), f = fotky[idPl];
  if (!pl || !f) return;
  const kal = pl.kal, W = f.obr.width, H = f.obr.height, aktivni = idPl === plocha().id;
  const P = (x, y) => [x * v.s + v.tx, y * v.s + v.ty], Q = (x, y) => P(...J.doObrazu(kal, x, y));
  const rohyMm = [[0, 0], [W, 0], [W, H], [0, H]].map(p => J.zObrazu(kal, ...p));
  const L = Math.min(20000, Math.max(...rohyMm.map(a => Math.max(...rohyMm.map(b => Math.hypot(a[0] - b[0], a[1] - b[1]))))));
  const stopyPl = data.stopy.filter(s => s.plocha === idPl);
  const krizek = (x, y, r, barva, s) => { pero.cara([[x - r, y], [x + r, y]], barva, s); pero.cara([[x, y - r], [x, y + r]], barva, s); };
  if (A && A.baze[idPl]) {
    A.zdroje.forEach((z, i) => {
      const barva = barvaZdroje(i), rv = z.roviny.find(q => q.plocha === idPl);
      if (rv && rv.konvergence.obal.length >= 3) pero.plocha(rv.konvergence.obal.map(q => Q(q.x, q.y)), barva, 0.13, barva);
      const [zx, zy, zz] = J.zMistnosti(A.baze[idPl], [z.bod.x, z.bod.y, z.bod.z]);
      const cil = rv ? [rv.konvergence.x, rv.konvergence.y] : [zx, zy];
      for (const s of stopyPl) {
        if (A.vZdroji[s.id] !== i) continue;
        const r = rovinaStopy(s.id), [tx, ty] = J.vektorZGamma(r.gamma);
        const d = Math.max(0, -((cil[0] - r.x) * tx + (cil[1] - r.y) * ty) * 1.1);
        pero.cara([Q(r.x, r.y), Q(r.x - tx * d, r.y - ty * d)], barva, 1.2, [6, 5]);
      }
      if (rv) for (const q of rv.konvergence.pruseciky) { const [x, y] = Q(q.x, q.y); pero.kruh(x, y, 1.6, barva); }
      const o = mc && mc[i];
      if (o) {
        const e = J.elipsa2D(o.body.map(b => J.zMistnosti(A.baze[idPl], b).slice(0, 2)));
        if (e && e.a > 0) { const b = J.bodyElipsy(e, 48); b.push(b[0]); pero.cara(b.map(p => Q(...p)), barva, 1.4, [3, 3]); }
      }
      if (zz > 0) {
        const [x, y] = Q(zx, zy);
        krizek(x, y, 10, barva, 2); pero.kruh(x, y, 6, null, barva, 2);
        pero.text(z.id, x + 9, y - 9, barva);
      }
    });
    for (const s of stopyPl) {
      if (!odlehla(s.id)) continue;
      const r = rovinaStopy(s.id), [tx, ty] = J.vektorZGamma(r.gamma);
      pero.cara([Q(r.x, r.y), Q(r.x - tx * L * 0.35, r.y - ty * L * 0.35)], SEDA, 1, [2, 5]);
    }
  }
  for (const s of stopyPl) {
    const r = rovinaStopy(s.id), vyb = s.id === vybrana, barva = barvaStopy(s);
    if (vyb) { const b = J.bodyElipsy(Object.assign({}, s, { a: s.a + 6 / v.s, b: s.b + 6 / v.s }), 48); b.push(b[0]); pero.cara(b.map(p => P(...p)), '#111', 1.2, [4, 3]); }
    const body = J.bodyElipsy(s, 48); body.push(body[0]);
    pero.cara(body.map(p => P(...p)), barva, vyb ? 2.4 : 1.6);
    const [cx, cy] = P(s.cx, s.cy);
    krizek(cx, cy, 4, barva, 1);
    if (r && r.gamma != null) {
      const [tx, ty] = J.vektorZGamma(r.gamma), a0 = Q(r.x, r.y), a1 = Q(r.x + tx, r.y + ty);
      let dx = a1[0] - a0[0], dy = a1[1] - a0[1];
      const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const Ls = Math.max(s.a * v.s * 1.5, 18), kx = cx + dx * Ls, ky = cy + dy * Ls;
      pero.cara([[cx + dx * s.a * v.s, cy + dy * s.a * v.s], [kx, ky]], barva, 1.8);
      pero.cara([[kx - dx * 7 - dy * 4, ky - dy * 7 + dx * 4], [kx, ky], [kx - dx * 7 + dy * 4, ky - dy * 7 - dx * 4]], barva, 1.8);
    }
    if (odlehla(s.id) || !s.pouzit) { pero.cara([[cx - 7, cy - 7], [cx + 7, cy + 7]], SEDA, 1.6); pero.cara([[cx - 7, cy + 7], [cx + 7, cy - 7]], SEDA, 1.6); }
    const rr = Math.max(s.b * v.s, 6);
    pero.text(s.nazev + (r && Number.isFinite(r.alfa) ? ' ' + fmt(r.alfa, 0) + '°' : ''), cx + rr + 4, cy - rr - 2, barva);
  }
  // měřítko, perspektiva, počátek
  if (kal.body && !kal.H) {
    const [a, b] = kal.body;
    pero.cara([P(...a), P(...b)], ZELENA, 2);
    const [mx, my] = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    pero.text(fmt(kal.mm, 1) + ' mm', mx + 6, my - 6, ZELENA);
  }
  if (kal.H && kal.rohy) {
    const b = kal.rohy.map(p => P(...p));
    pero.cara(b.concat([b[0]]), ZELENA, 1.8);
    b.forEach(([x, y], i) => pero.text(String(i + 1), x + 5, y - 5, ZELENA));
    const [mx, my] = P((kal.rohy[0][0] + kal.rohy[1][0]) / 2, (kal.rohy[0][1] + kal.rohy[1][1]) / 2);
    pero.text(fmt(kal.rozmer[0], 0) + ' × ' + fmt(kal.rozmer[1], 0) + ' mm', mx - 30, my + 16, ZELENA);
  }
  {
    const [ox, oy] = Q(0, 0), osa = (x, y) => { const [ax, ay] = Q(x, y), n = Math.hypot(ax - ox, ay - oy) || 1; return [ox + (ax - ox) / n * 34, oy + (ay - oy) / n * 34]; };
    const kx = osa(10, 0), ky = osa(0, 10);
    pero.cara([[ox, oy], kx], ZELENA, 1.6); pero.cara([[ox, oy], ky], ZELENA, 1.6);
    pero.text('x', kx[0] + 3, kx[1] + 4, ZELENA); pero.text('y', ky[0] - 4, ky[1] - 4, ZELENA);
    pero.kruh(ox, oy, 4, ZELENA);
  }
  if (aktivni) {
    for (const [x, y] of meritkoBody.concat(rozpracovane, rohyBody)) { const [sx, sy] = P(x, y); pero.kruh(sx, sy, 3.5, '#c62828', '#000', 1); }
    rohyBody.forEach(([x, y], i) => { const [sx, sy] = P(x, y); pero.text(String(i + 1), sx + 6, sy - 6, '#c62828'); });
    if (rozpracovane.length >= 5) {
      const e = J.elipsaZBodu(rozpracovane);
      if (e) { const b = J.bodyElipsy(e, 48); b.push(b[0]); pero.cara(b.map(p => P(...p)), '#c62828', 1, [4, 3]); }
    }
  }
}

/* ---------- plátno ---------- */
const platno = $('platno'), ctx = platno.getContext('2d');
function velikostPlatna() {
  const r = $('obalPlatna').getBoundingClientRect(), dpr = devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (platno.width !== w || platno.height !== h) { platno.width = w; platno.height = h; }
  return { w: r.width, h: r.height, dpr };
}
function vejdiSe() {
  const o = obrazek();
  if (!o) return kresliPlatno();
  const { w, h } = velikostPlatna();
  const s = Math.min(w / o.width, h / o.height) * 0.96;
  pohledFoto = { s, tx: (w - o.width * s) / 2, ty: (h - o.height * s) / 2 };
  celaFotka = true;
  kresliPlatno();
}
function zoomKolem(f, sx, sy) {
  const p = pohledFoto, ns = Math.max(0.02, Math.min(40, p.s * f));
  p.tx = sx - (sx - p.tx) * ns / p.s; p.ty = sy - (sy - p.ty) * ns / p.s; p.s = ns;
  celaFotka = false;
  kresliPlatno();
}
const naObr = (sx, sy) => [(sx - pohledFoto.tx) / pohledFoto.s, (sy - pohledFoto.ty) / pohledFoto.s];
function kresliPlatno() {
  const { w, h, dpr } = velikostPlatna(), o = obrazek(), v = pohledFoto;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!o) return;
  ctx.save(); ctx.imageSmoothingEnabled = v.s < 3; ctx.translate(v.tx, v.ty); ctx.scale(v.s, v.s); ctx.drawImage(o, 0, 0); ctx.restore();
  kresliScenu(peroPlatno(ctx), v, plocha().id);
  if (lupa && mys && KLADENI.has(nastroj)) kresliLupu(o, w, h);
}
/* lupa: 4× zvětšené okolí kurzoru v rohu plátna */
function kresliLupu(o, w, h) {
  const R = Math.min(75, w / 5, h / 4), Z = 4, [ix, iy] = naObr(...mys), k = pohledFoto.s * Z;
  const lx = mys[0] > w / 2 ? R + 10 : w - R - 10, ly = R + 10;
  ctx.save();
  ctx.beginPath(); ctx.arc(lx, ly, R, 0, 2 * Math.PI); ctx.fillStyle = '#000'; ctx.fill(); ctx.clip();
  ctx.imageSmoothingEnabled = k < 3;
  ctx.drawImage(o, lx - ix * k, ly - iy * k, o.width * k, o.height * k);
  const pero = peroPlatno(ctx);
  for (const [x, y] of meritkoBody.concat(rozpracovane, rohyBody)) pero.kruh(lx + (x - ix) * k, ly + (y - iy) * k, 3, '#c62828', '#000');
  pero.cara([[lx - R, ly], [lx - 5, ly]], '#c62828', 1); pero.cara([[lx + 5, ly], [lx + R, ly]], '#c62828', 1);
  pero.cara([[lx, ly - R], [lx, ly - 5]], '#c62828', 1); pero.cara([[lx, ly + 5], [lx, ly + R]], '#c62828', 1);
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, R, 0, 2 * Math.PI); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
}

/* ---------- myš a dotyk ---------- */
const ukazatele = new Map();
let tah = null, casLupy = 0;
platno.addEventListener('pointerdown', e => {
  if (!obrazek()) return;
  platno.setPointerCapture(e.pointerId);
  ukazatele.set(e.pointerId, [e.offsetX, e.offsetY]);
  tah = { x: e.offsetX, y: e.offsetY, pohnuto: false, stisk: ukazatele.size };
});
platno.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && lupa && KLADENI.has(nastroj)) {
    mys = [e.offsetX, e.offsetY];
    if (!casLupy) casLupy = requestAnimationFrame(() => { casLupy = 0; kresliPlatno(); });
  }
  if (!ukazatele.has(e.pointerId) || !tah) return;
  const pred = ukazatele.get(e.pointerId);
  if (ukazatele.size === 2) {
    const [a, b] = [...ukazatele.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
    ukazatele.set(e.pointerId, [e.offsetX, e.offsetY]);
    const [a2, b2] = [...ukazatele.values()], d1 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
    if (d0 > 0) zoomKolem(d1 / d0, (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2);
    tah.pohnuto = true; return;
  }
  ukazatele.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (!tah.pohnuto && Math.hypot(e.offsetX - tah.x, e.offsetY - tah.y) < 5) return;
  tah.pohnuto = true;
  pohledFoto.tx += e.offsetX - pred[0]; pohledFoto.ty += e.offsetY - pred[1];
  celaFotka = false;
  kresliPlatno();
});
platno.addEventListener('pointerleave', () => { if (mys) { mys = null; kresliPlatno(); } });
function konecTahu(e) {
  if (!ukazatele.has(e.pointerId)) return;
  ukazatele.delete(e.pointerId);
  if (tah && !tah.pohnuto && tah.stisk === 1 && e.type === 'pointerup') klik(...naObr(e.offsetX, e.offsetY));
  if (!ukazatele.size) tah = null;
}
platno.addEventListener('pointerup', konecTahu);
platno.addEventListener('pointercancel', konecTahu);
platno.addEventListener('wheel', e => { if (!obrazek()) return; e.preventDefault(); zoomKolem(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY); }, { passive: false });

function stopaPod(x, y) {
  let nej = null, nejV = Infinity;
  for (const s of data.stopy) {
    if (s.plocha !== plocha().id) continue;
    const dx = x - s.cx, dy = y - s.cy, c = Math.cos(s.theta), sn = Math.sin(s.theta);
    const u = dx * c + dy * sn, w = -dx * sn + dy * c, rez = 8 / pohledFoto.s;
    const v = (u / (s.a + rez)) ** 2 + (w / (s.b + rez)) ** 2;
    if (v <= 1.3 && v < nejV) { nej = s; nejV = v; }
  }
  return nej;
}
/* konvexní čtyřúhelník s pořadím levý dolní → pravý dolní → pravý horní → levý horní (v obrázku y dolů = záporná orientace) */
function spravneRohy(r) {
  let zn = 0;
  for (let i = 0; i < 4; i++) {
    const a = r[i], b = r[(i + 1) % 4], c = r[(i + 2) % 4], k = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (k === 0) return false;
    if (zn && Math.sign(k) !== zn) return false;
    zn = Math.sign(k);
  }
  return zn < 0;
}

async function klik(x, y) {
  const pl = plocha(), kal = pl.kal, f = fotka();
  if (nastroj === 'posun') { const s = stopaPod(x, y); vybrana = s ? s.id : null; return vykresli(); }
  if (nastroj === 'pocatek') { kal.ox = x; kal.oy = y; nastavNastroj('posun'); return zmena(); }
  if (nastroj === 'meritko') {
    meritkoBody.push([x, y]); kresliPlatno();
    if (meritkoBody.length < 2) return vykresliPanel();
    const [a, b] = meritkoBody, px = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const odp = await Dialog.zeptej(`Skutečná vzdálenost mezi body (mm) – na fotce ${fmt(px, 0)} px`, kal.mm ? String(kal.mm) : '100');
    meritkoBody = [];
    const mm = Number(String(odp || '').replace(',', '.'));
    if (odp != null && mm > 0 && px > 0) {
      Object.assign(kal, { mmNaPx: mm / px, body: [a, b], mm, H: null, rohy: null, rozmer: null });
      if (px < 200) Dialog.info('Měřítko je na fotce krátké – pro přesnost volte delší úsek.');
      nastavNastroj('posun');
    } else if (odp != null) Dialog.chyba('Zadejte kladné číslo v milimetrech.');
    return zmena();
  }
  if (nastroj === 'perspektiva') {
    rohyBody.push([x, y]);
    if (rohyBody.length < 4) { kresliPlatno(); return vykresliPanel(); }
    const r = rohyBody; rohyBody = [];
    const [w, h] = rozmerObdelniku;
    if (!spravneRohy(r)) { vykresli(); return Dialog.chyba('Rohy musí tvořit konvexní čtyřúhelník v pořadí levý dolní, pravý dolní, pravý horní, levý horní. Zkuste znovu.'); }
    const H = J.homografie(r, [[0, 0], [w, 0], [w, h], [0, h]]);
    if (!H) { vykresli(); return Dialog.chyba('Z těchto bodů nejde perspektivu spočítat.'); }
    Object.assign(kal, { H, rohy: r, rozmer: [w, h], ox: r[0][0], oy: r[0][1], body: null, mm: 0 });
    kal.mmNaPx = J.meritkoH(kal, f.obr.width / 2, f.obr.height / 2);
    Dialog.info('Perspektiva nastavena, počátek je v 1. rohu (levý dolní).');
    nastavNastroj('posun');
    return zmena();
  }
  if (nastroj === 'body') { rozpracovane.push([x, y]); kresliPlatno(); return vykresliPanel(); }
  if (nastroj === 'prah') {
    const z = J.zaplav(f.jasy, f.obr.width, f.obr.height, x, y, prah);
    if (!z) return Dialog.info('Bod je světlejší než práh – klikněte do stopy, nebo práh zvyšte.');
    if (z.preteklo || z.okraj) return Dialog.chyba('Oblast se rozlila (sahá na okraj nebo je obrovská) – snižte práh.');
    if (z.body.length < 30) return Dialog.info('Oblast má jen ' + z.body.length + ' px – na spolehlivé proložení je stopa malá. Přibližte fotku s vyšším rozlišením nebo použijte body.');
    return pridejStopu(J.elipsaZMomentu(z.body), 'prah', []);
  }
  if (nastroj === 'ocasek') {
    const s = stopa(vybrana) || stopaPod(x, y);
    if (!s) return Dialog.info('Nejdřív vyberte stopu.');
    s.smer = J.smerZOcasku(s, x, y); s.gammaRucne = null; vybrana = s.id;
    nastavNastroj(predchozi);
    return zmena();
  }
}
function pridejStopu(e, metoda, body) {
  if (!e || !(e.a > 0 && e.b > 0)) return Dialog.chyba('Elipsu se nepodařilo proložit – zkuste body rozmístit rovnoměrně po celém okraji.');
  const id = 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  data.stopy.push({ id, nazev: J.dalsiNazev(data.stopy), plocha: plocha().id, cx: e.cx, cy: e.cy, a: e.a, b: e.b, theta: e.theta, smer: 0, metoda, body: body.map(p => p.map(v => Math.round(v * 10) / 10)), upraveno: false, sirkaMm: 0, delkaMm: 0, gammaRucne: null, pouzit: true, pozn: '' });
  vybrana = id;
  if (2 * e.b < 20) Dialog.info('Stopa má na fotce šířku jen ' + fmt(2 * e.b, 0) + ' px – úhel bude nepřesný.');
  predchozi = nastroj === 'ocasek' ? predchozi : nastroj;
  nastavNastroj('ocasek');
  zmena();
}
function prolozBody() {
  if (rozpracovane.length < 5) return Dialog.info('Potřeba aspoň 5 bodů po okraji.');
  const b = rozpracovane; rozpracovane = [];
  pridejStopu(J.elipsaZBodu(b), 'body', b);
}
/* jemné doladění vybrané elipsy: posun (px), otočení (°), šířka/délka (px celé osy) */
function dolad(co, krok) {
  const s = stopa(vybrana);
  if (!s) return;
  const k = krok || 1;
  if (co === 'x') s.cx += 0.5 * k; else if (co === 'y') s.cy += 0.5 * k;
  else if (co === 'r') s.theta = J.normOsa(s.theta + 0.5 * k * RAD);
  else if (co === 'b') s.b = Math.max(0.5, s.b + 0.25 * k);
  else if (co === 'a') s.a = Math.max(0.5, s.a + 0.25 * k);
  if (s.b > s.a) { [s.a, s.b] = [s.b, s.a]; s.theta = J.normOsa(s.theta + Math.PI / 2); s.smer = 0; }
  s.upraveno = true;
  zmena();
}

/* ---------- panel ---------- */
function htmlUkazka(kratce) {
  const u = data.ukazka, def = u && J.UKAZKY.find(x => x.id === u.id);
  if (!def) return '';
  let h = `<div class="ukazka"><b>${def.ikona} Ukázka: ${esc(def.nazev)}</b>`;
  if (!kratce) h += `<div style="margin-top:3px">${esc(def.popis)}</div><div style="margin-top:5px"><b>Co si tu vyzkoušet</b><ul>${def.zkuste.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  h += '<div style="margin-top:5px"><b>Skutečnost</b>';
  u.zdroje.forEach((S, k) => {
    let por = '';
    if (A && A.zdroje.length && A.mm) {
      const d = A.zdroje.map(z => Math.hypot(z.bod.x - S[0], z.bod.y - S[1], z.bod.z - S[2])), i = d.indexOf(Math.min(...d));
      por = ` → <span>nejbližší nalezený ${A.zdroje[i].id} je od něj ${fmt(d[i], 0)} mm</span>`;
    }
    h += `<div>zdroj ${k + 1}: X; Y; Z = ${fmt(S[0], 0)}; ${fmt(S[1], 0)}; ${fmt(S[2], 0)} mm${por}</div>`;
  });
  if (u.id === 'gravitace') h += '<div>Rychlost dopadu kapek byla asi 3,0 m/s.</div>';
  return h + '</div></div>';
}
function htmlVysledky(kratce) {
  const u = jednotka(), pl = plocha(), N = data.nastaveni;
  const odl = A && A.odlehle.length ? `<p class="tip" style="margin:6px 0 0">Odlehlé stopy (mimo zdroje, do výpočtu nevstupují): ${A.odlehle.map(id => esc((stopa(id) || {}).nazev || id)).join(', ')}</p>` : '';
  if (!data.stopy.length) return '<p class="tip">Zatím žádné stopy.</p>';
  if (!A || !A.zdroje.length) return `<p class="tip">Pro výpočet jsou potřeba aspoň 2 stopy se směrem (➜ ocásek), které nejsou rovnoběžné${N.shluky ? `; při hledání více zdrojů aspoň ${N.minShluk} stopy na zdroj` : ''}.</p>` + odl;
  let h = '';
  if (!A.mm && data.plochy.length > 1) h += '<p class="varovani"><b>Chybí měřítko</b> na některé ploše – plochy v místnosti nejde spojit, výsledek je v px.</p>';
  A.zdroje.forEach((z, i) => {
    const o = mc && mc[i], [lx, ly, lz] = J.zMistnosti(A.baze[pl.id] || J.bazePlochy(pl), [z.bod.x, z.bod.y, z.bod.z]);
    const iv = k => o ? `${fmt(o.statistika[k].p5, 0)} – ${fmt(o.statistika[k].p95, 0)}` : '…';
    let grav = '';
    if (z.gravitace) {
      const [g0, g1] = z.gravitace;
      grav = g0 && g1 ? `<dt>S gravitací ${fmt(N.vMin, 1)}–${fmt(N.vMax, 1)} m/s</dt><dd>Z = <b>${fmt(g0.z, 0)} – ${fmt(g1.z, 0)}</b> mm${g0.z < 0 && data.plochy.some(p => p.typ === 'podlaha') ? ' <span class="tip">(nižší rychlost by dala zdroj pod podlahou – tak pomalé kapky nebyly)</span>' : ''}</dd>`
        : '<dt>S gravitací</dt><dd>nelze – dráhy jsou skoro svislé</dd>';
    } else if (!A.mm) grav = '<dt>S gravitací</dt><dd>potřebuje měřítko</dd>';
    h += `<div class="zdroj"><h3><span class="tecka" style="background:${barvaZdroje(i)}"></span>Zdroj ${z.id} · ${z.ids.length} stop</h3><dl class="hodnoty">
      <dt>Místnost X; Y; Z</dt><dd><b>${fmt(z.bod.x, 0)}; ${fmt(z.bod.y, 0)}; ${fmt(z.bod.z, 0)}</b> ${u}</dd>
      <dt>Rozptyl přímek</dt><dd>${fmt(z.bod.rms, 1)} ${u} (RMS)</dd>
      <dt>Vůči ploše</dt><dd data-i18n="ne">${esc(pl.nazev)}</dd>
      <dt>x; y; vzdálenost</dt><dd>${fmt(lx, 0)}; ${fmt(ly, 0)}; <b>${fmt(lz, 0)}</b> ${u}</dd>
      ${o ? `<dt>90% interval X</dt><dd>${iv(0)} ${u}</dd><dt>90% interval Y</dt><dd>${iv(1)} ${u}</dd><dt>90% interval Z</dt><dd>${iv(2)} ${u}</dd><dt>90% elipsoid</dt><dd>poloosy ${o.osy.map(v => fmt(v, 0)).join(' × ')} ${u}</dd>` : '<dt>Nejistota</dt><dd>počítá se…</dd>'}
      ${z.roviny.map(rv => `<dt>Tangentová metoda</dt><dd>${esc(nazevPlochy(rv.plocha))}: vzdálenost <b>${fmt(rv.tangenta.z, 0)}</b> ± ${fmt(rv.tangenta.sd, 0)} ${u} <span class="tip">(${rv.n} stop)</span></dd>`).join('')}
      ${grav}
    </dl></div>`;
  });
  h += odl;
  if (!kratce) h += '<p class="varovani" style="margin-top:8px"><b>Horní odhad:</b> přímky i tangentová metoda berou dráhu jako přímku, skutečná je zakřivená – výška vychází větší než skutečná. Pás „s gravitací“ to přibližně opravuje (předpokládá správný typ plochy v ⚙).</p>';
  return h;
}
function vykresliPanel() {
  const pl = plocha(), kal = pl.kal, f = fotka(), u = jednotka();
  const stopyPl = data.stopy.filter(s => s.plocha === pl.id);
  const smer = stopyPl.filter(s => { const r = rovinaStopy(s.id); return r && r.gamma != null; }).length;
  const kroky = [
    [!!f, f ? `Fotka ${f.obr.width} × ${f.obr.height} px` : 'Fotka plochy', '<button class="btn" data-prikaz="fotka" title="Otevřít fotku">📷</button>'],
    [!!(kal.H || kal.mmNaPx > 0), kal.H ? `Perspektiva ${fmt(kal.rozmer[0], 0)} × ${fmt(kal.rozmer[1], 0)} mm` : kal.mmNaPx > 0 ? `Měřítko ${fmt(1 / kal.mmNaPx, 2)} px/mm` : 'Měřítko nebo perspektiva', '<button class="btn" data-nastroj="meritko" title="Měřítko">📏</button><button class="btn" data-nastroj="perspektiva" title="Perspektiva">⧉</button>']
  ];
  if (data.plochy.length > 1) kroky.push([pl.id === data.plochy[0].id || pl.O.some(v => v !== 0) || pl.natoceni !== 0, 'Umístění plochy v místnosti', '<button class="btn" data-prikaz="plocha" title="Umístění plochy">⚙</button>']);
  kroky.push(
    [stopyPl.length >= 3, `Stopy na ploše: ${stopyPl.length} (aspoň 3)`, '<button class="btn" data-nastroj="body" title="Body">✏️</button><button class="btn" data-nastroj="prah" title="Práh">🪄</button>'],
    [stopyPl.length > 0 && smer === stopyPl.length, `Směr letu: ${smer} z ${stopyPl.length}`, '<button class="btn" data-prikaz="dalsiBezSmeru" title="Další stopa bez směru">➜</button>'],
    [!!(A && A.zdroje.length), A && A.zdroje.length ? `Zdroje: ${A.zdroje.length}, odlehlé: ${A.odlehle.length}` : 'Oblast původu', '<button class="btn" data-pohled="3d" title="3D">🧊</button>'],
    [false, 'Protokol, CSV, nákres', '<button class="btn" data-prikaz="protokol" title="Protokol">🖨️</button>']);
  const dalsi = kroky.findIndex(k => !k[0]);
  let h = `<div><h2>Průvodce postupem</h2><div class="pruvodce">${kroky.map((k, i) => `<div class="krok${i === dalsi ? ' dalsi' : ''}"><span class="z">${k[0] ? '✅' : i === dalsi ? '👉' : '⬜'}</span><span class="t">${k[1]}</span>${k[2]}</div>`).join('')}</div></div>`;
  h += htmlUkazka(false);
  h += `<div class="napoveda-nastroje"><b>${esc(document.querySelector(`[data-nastroj="${nastroj}"]`).title)}</b><br>${NAPOVEDY[nastroj]}`;
  if (nastroj === 'body') h += `<div class="radek-tl"><button class="btn primary mini" data-prikaz="proloz" ${rozpracovane.length < 5 ? 'disabled' : ''}>✓ Proložit (${rozpracovane.length})</button><button class="btn mini" data-prikaz="bodZpet" ${rozpracovane.length ? '' : 'disabled'}>↶ Zpět</button><button class="btn mini" data-prikaz="bodyZrus" ${rozpracovane.length ? '' : 'disabled'}>✕ Zrušit</button></div>`;
  if (nastroj === 'prah') h += `<div class="radek-tl"><label style="flex:1;display:flex;gap:6px;align-items:center">Práh <input type="range" id="prah" min="0" max="255" value="${prah}" style="flex:1"> <b id="prahHodnota">${prah}</b></label><button class="btn mini" data-prikaz="otsu" title="Automatický práh (Otsu)">Auto</button></div>`;
  if (nastroj === 'meritko' && meritkoBody.length) h += '<div class="radek-tl">První bod zadán, klikněte na druhý.</div>';
  if (nastroj === 'perspektiva') h += `<div class="radek-tl"><label>Šířka <input class="vstup" id="obdW" type="number" min="1" step="any" value="${rozmerObdelniku[0]}" style="width:5.5em"></label><label>výška <input class="vstup" id="obdH" type="number" min="1" step="any" value="${rozmerObdelniku[1]}" style="width:5.5em"> mm</label></div>
    <div class="radek-tl"><span>Zadáno rohů: <b>${rohyBody.length}</b> / 4</span><button class="btn mini" data-prikaz="rohyZrus" ${rohyBody.length ? '' : 'disabled'}>✕ Znovu</button>${kal.H ? '<button class="btn mini danger" data-prikaz="zrusPerspektivu">Zrušit perspektivu</button>' : ''}</div>`;
  if (nastroj === 'ocasek') h += '<div class="radek-tl"><button class="btn mini" data-prikaz="bezOcasku">Bez směru, pokračovat</button></div>';
  h += '</div>';
  if (stopyPl.length) h += `<div><h2>Stopy na ploše</h2><div class="cipy">${stopyPl.map(s => `<button class="cip${s.pouzit ? '' : ' vyrazena'}${rovinaStopy(s.id) && rovinaStopy(s.id).gamma != null ? '' : ' bezsmeru'}" data-vyber="${esc(s.id)}" aria-pressed="${s.id === vybrana}" data-i18n="ne"><span class="tecka" style="background:${barvaStopy(s)}"></span>${esc(s.nazev)}</button>`).join('')}</div></div>`;
  const s = stopa(vybrana), r = s && rovinaStopy(s.id);
  if (s && r) {
    const ra = J.rozsahAlfa(r.sirka, r.delka, u === 'mm' ? data.nastaveni.sRozmer : 0), zi = A.vZdroji[s.id];
    const pp = A.paprsky.find(p => p.id === s.id), z = zi != null ? A.zdroje[zi] : null;
    h += `<div><h2>Vybraná stopa</h2>
      <dl class="hodnoty">
        <dt>Označení</dt><dd><input class="vstup" id="jmenoStopy" value="${esc(s.nazev)}" maxlength="40" style="width:8em" data-i18n="ne"></dd>
        <dt>Šířka × délka</dt><dd>${fmt(r.sirka, 2)} × ${fmt(r.delka, 2)} ${u}${s.sirkaMm || s.delkaMm ? ' <span class="tip">(ručně)</span>' : ''}</dd>
        <dt>š / d</dt><dd>${fmt(r.pomer, 3)}</dd>
        <dt>Úhel dopadu α</dt><dd><span class="velke">${fmt(r.alfa, 1)}°</span> ${u === 'mm' ? `<span class="tip">(${fmt(ra[0], 1)}–${fmt(ra[1], 1)}° při ±${fmt(data.nastaveni.sRozmer, 2)} mm)</span>` : ''}</dd>
        <dt>Směr γ</dt><dd>${r.gamma == null ? '<i>neurčen – ➜ ocásek</i>' : fmt(r.gamma, 1) + '°'}</dd>
        <dt>Poloha x; y</dt><dd>${fmt(r.x, 0)}; ${fmt(r.y, 0)} ${u}</dd>
        <dt>Zdroj</dt><dd>${z ? `<span class="tecka" style="background:${barvaZdroje(zi)}"></span>${z.id} · přímka ${fmt(J.vzdOdPrimky(pp, [z.bod.x, z.bod.y, z.bod.z]), 1)} ${u} od něj` : odlehla(s.id) ? 'odlehlá – mimo zdroje' : !s.pouzit ? 'vyřazena ručně' : '–'}</dd>
        <dt>Metoda</dt><dd>${s.metoda === 'prah' ? '🪄 práh (momenty)' : `✏️ ${s.body.length} bodů`}${s.upraveno ? ' · doladěno' : ''}</dd>
      </dl>
      ${r.alfa > 70 ? '<p class="varovani" style="margin-top:6px">α nad 70°: stopa je skoro kulatá, směr γ je nejistý – pro konvergenci se moc nehodí.</p>' : ''}
      <h2 style="margin-top:8px">Jemné doladění elipsy</h2>
      <div class="dolad">
        <button class="btn mini" data-prikaz="dolad" data-co="x" data-k="-1" title="Posun doleva (←)" aria-label="Posun doleva">←</button>
        <button class="btn mini" data-prikaz="dolad" data-co="x" data-k="1" title="Posun doprava (→)" aria-label="Posun doprava">→</button>
        <button class="btn mini" data-prikaz="dolad" data-co="y" data-k="-1" title="Posun nahoru (↑)" aria-label="Posun nahoru">↑</button>
        <button class="btn mini" data-prikaz="dolad" data-co="y" data-k="1" title="Posun dolů (↓)" aria-label="Posun dolů">↓</button>
        <button class="btn mini" data-prikaz="dolad" data-co="r" data-k="-1" title="Otočit proti směru hodin (Q)" aria-label="Otočit doleva">⟲</button>
        <button class="btn mini" data-prikaz="dolad" data-co="r" data-k="1" title="Otočit po směru hodin (E)" aria-label="Otočit doprava">⟳</button>
        <button class="btn mini" data-prikaz="dolad" data-co="b" data-k="-1" title="Užší (A)">š−</button>
        <button class="btn mini" data-prikaz="dolad" data-co="b" data-k="1" title="Širší (D)">š+</button>
        <button class="btn mini" data-prikaz="dolad" data-co="a" data-k="-1" title="Kratší (S)">d−</button>
        <button class="btn mini" data-prikaz="dolad" data-co="a" data-k="1" title="Delší (W)">d+</button>
        <button class="btn mini" data-prikaz="lupaStopy" title="Přiblížit na stopu (Z)" aria-label="Přiblížit na stopu">🔍</button>
      </div>
      <p class="tip" style="margin:4px 0 0">Krok 0,5 px (posun, osy) a 0,5°; se Shiftem na klávesnici 10×.</p>
      <div class="radek-tl">
        <button class="btn mini" data-prikaz="ocasekVybrane">➜ Ocásek</button>
        <button class="btn mini" data-prikaz="obratit" ${r.gamma == null ? 'disabled' : ''}>⇅ Obrátit směr</button>
        <button class="btn mini" data-prikaz="pouzit">${s.pouzit ? '⊘ Vyřadit z výpočtu' : '✓ Zahrnout'}</button>
        <button class="btn mini danger" data-prikaz="smazStopu">🗑️ Smazat</button>
      </div></div>`;
  }
  h += `<div><h2>Výsledek</h2>${htmlVysledky(false)}</div>`;
  $('panel').innerHTML = h;
  if ($('prah')) $('prah').addEventListener('input', e => { prah = +e.target.value; $('prahHodnota').textContent = prah; });
  if ($('jmenoStopy')) $('jmenoStopy').addEventListener('change', e => { const s2 = stopa(vybrana); if (s2) { s2.nazev = e.target.value.trim().slice(0, 40) || s2.nazev; zmena(); } });
  for (const [idv, i] of [['obdW', 0], ['obdH', 1]]) if ($(idv)) $(idv).addEventListener('change', e => { const v = Number(e.target.value); if (v > 0) rozmerObdelniku[i] = v; });
}

/* ---------- tabulka ---------- */
function radkyTabulky() {
  return data.stopy.map(s => {
    const r = rovinaStopy(s.id) || {}, zi = A ? A.vZdroji[s.id] : null, z = zi != null ? A.zdroje[zi] : null;
    const pp = A && A.paprsky.find(p => p.id === s.id), rv = z && z.roviny.find(q => q.plocha === s.plocha), vy = rv && rv.tangenta.vysky.find(v => v.id === s.id);
    return { s, r, zi, z, odch: z && pp ? J.vzdOdPrimky(pp, [z.bod.x, z.bod.y, z.bod.z]) : NaN, D: vy ? vy.D : NaN, ztg: vy ? vy.z : NaN };
  });
}
const KLICE_RAZENI = {
  nazev: q => q.s.nazev, plocha: q => nazevPlochy(q.s.plocha), zdroj: q => q.zi != null ? q.zi : odlehla(q.s.id) ? 98 : 99,
  x: q => q.r.x, y: q => q.r.y, sirka: q => q.r.sirka, delka: q => q.r.delka, pomer: q => q.r.pomer, alfa: q => q.r.alfa,
  gamma: q => q.r.gamma, odch: q => q.odch, D: q => q.D, z: q => q.ztg
};
function vykresliTabulku() {
  const u = jednotka();
  if (!data.stopy.length) { $('pTabulka').innerHTML = '<p class="tip">Zatím žádné stopy – přidejte je na fotce (✏️ Body nebo 🪄 Práh), nebo otevřete 🧪 ukázku.</p>'; return; }
  const radky = radkyTabulky(), kl = KLICE_RAZENI[razeni.k] || KLICE_RAZENI.nazev;
  radky.sort((p, q) => {
    const a = kl(p), b = kl(q);
    if (typeof a === 'string') return a.localeCompare(b, 'cs', { numeric: true }) * razeni.smer;
    const fa = Number.isFinite(a), fb = Number.isFinite(b);
    if (!fa || !fb) return fa === fb ? 0 : fa ? -1 : 1;
    return (a - b) * razeni.smer;
  });
  const vice = data.plochy.length > 1;
  const th = (k, t, c, titul) => `<th${c ? ' class="c"' : ''}${razeni.k === k ? ` aria-sort="${razeni.smer > 0 ? 'ascending' : 'descending'}"` : ''}><button class="raz" data-raz="${k}" title="${titul || 'Seřadit'}">${t}${razeni.k === k ? (razeni.smer > 0 ? ' ▲' : ' ▼') : ''}</button></th>`;
  const inp = (pole, hodnota, rucne, titul) => `<input class="vstup${rucne ? ' rucne' : ''}" data-pole="${pole}" inputmode="decimal" value="${Number.isFinite(hodnota) ? +hodnota.toFixed(pole === 'gammaRucne' ? 1 : 2) : ''}" title="${titul}" aria-label="${titul}">`;
  $('pTabulka').innerHTML = `<p class="tip">Kliknutím na záhlaví se řadí. Šířku, délku a γ lze přepsat ručně (oranžový rámeček = ruční hodnota; smazáním se vrátí změřená). Šířka a délka v ${u}. Odchylka = vzdálenost zpětné přímky od zdroje v prostoru, D = vzdálenost od bodu konvergence na ploše, z = vzdálenost od plochy tangentovou metodou.</p>
  <div class="tab-obal"><table><thead><tr><th>✓</th>${th('nazev', 'Stopa')}${vice ? th('plocha', 'Plocha') : ''}${th('zdroj', 'Zdroj')}${th('x', 'x', 1)}${th('y', 'y', 1)}${th('sirka', 'Šířka', 1)}${th('delka', 'Délka', 1)}${th('pomer', 'š/d', 1)}${th('alfa', 'α °', 1)}${th('gamma', 'γ °', 1)}${th('odch', 'Odchylka', 1)}${th('D', 'D', 1)}${th('z', 'z (tg)', 1)}<th>Metoda</th><th></th></tr></thead><tbody>
  ${radky.map(q => {
    const { s, r, z, zi } = q;
    return `<tr data-id="${esc(s.id)}" class="${s.id === vybrana ? 'vybrana' : ''}${s.pouzit ? '' : ' vyrazena'}">
      <td><input type="checkbox" data-pole="pouzit" ${s.pouzit ? 'checked' : ''} aria-label="Použít ve výpočtu"></td>
      <td><input class="vstup jm" data-pole="nazev" value="${esc(s.nazev)}" maxlength="40" data-i18n="ne" aria-label="Označení"></td>
      ${vice ? `<td data-i18n="ne">${esc(nazevPlochy(s.plocha))}</td>` : ''}
      <td>${z ? `<span class="tecka" style="background:${barvaZdroje(zi)}"></span>${z.id}` : odlehla(s.id) ? 'odlehlá' : ''}</td>
      <td class="c">${fmt(r.x, 0)}</td><td class="c">${fmt(r.y, 0)}</td>
      <td class="c">${inp('sirkaMm', r.sirka, s.sirkaMm > 0, 'Šířka')}</td><td class="c">${inp('delkaMm', r.delka, s.delkaMm > 0, 'Délka')}</td>
      <td class="c">${fmt(r.pomer, 3)}</td><td class="c"><b>${fmt(r.alfa, 1)}</b></td>
      <td class="c">${inp('gammaRucne', r.gamma == null ? NaN : r.gamma, Number.isFinite(s.gammaRucne), 'Směr γ')}</td>
      <td class="c">${Number.isFinite(q.odch) ? fmt(q.odch, 1) : ''}</td><td class="c">${Number.isFinite(q.D) ? fmt(q.D, 0) : ''}</td><td class="c">${Number.isFinite(q.ztg) ? fmt(q.ztg, 0) : ''}</td>
      <td>${s.metoda === 'prah' ? '🪄' : '✏️'}${s.upraveno ? '±' : ''}</td>
      <td><button class="btn mini" data-prikaz="ukazNaFotce" title="Ukázat na fotce" aria-label="Ukázat na fotce">🖼️</button> <button class="btn mini danger" data-prikaz="smazRadek" title="Smazat" aria-label="Smazat">🗑️</button></td></tr>`;
  }).join('')}</tbody></table></div>
  <div class="vysledky" style="margin-top:14px;max-width:680px">${htmlUkazka(true)}${htmlVysledky(false)}</div>`;
}
$('pTabulka').addEventListener('change', e => {
  const el = e.target, tr = el.closest('tr[data-id]'), s = tr && stopa(tr.dataset.id);
  if (!s || !el.dataset.pole) return;
  const p = el.dataset.pole;
  if (p === 'pouzit') s.pouzit = el.checked;
  else if (p === 'nazev') s.nazev = el.value.trim().slice(0, 40) || s.nazev;
  else {
    const t = el.value.trim().replace(',', '.'), n = Number(t);
    if (p === 'gammaRucne') s.gammaRucne = t === '' || !Number.isFinite(n) ? null : n;
    else s[p] = t === '' || !(n > 0) ? 0 : n;
  }
  zmena();
});

/* ---------- 3D místnost ---------- */
let r3 = null;
function nactiThree() {
  if (window.THREE) return Promise.resolve();
  return new Promise((ok, ne) => { const sc = document.createElement('script'); sc.src = 'lib/three.r128.min.js'; sc.onload = ok; sc.onerror = ne; document.head.appendChild(sc); });
}
async function init3d() {
  if (r3) return;
  try { await nactiThree(); } catch (e) { return Dialog.chyba('Knihovnu 3D se nepodařilo načíst.'); }
  const el = $('scena3d');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); }
  catch (e) { el.insertAdjacentHTML('beforeend', '<p class="tip" style="padding:20px">WebGL není v tomto prohlížeči k dispozici.</p>'); return; }
  renderer.setPixelRatio(devicePixelRatio || 1);
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, 1, 1e6);
  camera.up.set(0, 0, 1);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sv = new THREE.DirectionalLight(0xffffff, 0.6); sv.position.set(1, -2, 3); scene.add(sv);
  const skupina = new THREE.Group(); scene.add(skupina);
  r3 = { renderer, scene, camera, skupina, orb: { az: -0.6, el: 0.45, r: 1500, cil: new THREE.Vector3() } };
  const orb = r3.orb;
  let t = null;
  const ukaz = new Map();
  renderer.domElement.addEventListener('pointerdown', e => { renderer.domElement.setPointerCapture(e.pointerId); ukaz.set(e.pointerId, [e.clientX, e.clientY]); t = { x: e.clientX, y: e.clientY, b: e.button }; });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!t || !ukaz.has(e.pointerId)) return;
    if (ukaz.size === 2) {
      const [a, b] = [...ukaz.values()], d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      ukaz.set(e.pointerId, [e.clientX, e.clientY]);
      const [a2, b2] = [...ukaz.values()], d1 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
      if (d1 > 0) { orb.r *= d0 / d1; vykresli3dSnimek(); } return;
    }
    ukaz.set(e.pointerId, [e.clientX, e.clientY]);
    const dx = e.clientX - t.x, dy = e.clientY - t.y; t.x = e.clientX; t.y = e.clientY;
    if (t.b === 2 || e.shiftKey) {
      const k = orb.r * 0.0015, p = new THREE.Vector3(), nah = new THREE.Vector3();
      camera.matrix.extractBasis(p, nah, new THREE.Vector3());
      orb.cil.addScaledVector(p, -dx * k).addScaledVector(nah, dy * k);
    } else { orb.az -= dx * 0.008; orb.el = Math.max(-1.5, Math.min(1.5, orb.el + dy * 0.008)); }
    vykresli3dSnimek();
  });
  const konec = e => { ukaz.delete(e.pointerId); if (!ukaz.size) t = null; };
  renderer.domElement.addEventListener('pointerup', konec);
  renderer.domElement.addEventListener('pointercancel', konec);
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
  renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); orb.r *= Math.exp(e.deltaY * 0.0012); vykresli3dSnimek(); }, { passive: false });
  new ResizeObserver(() => vykresli3dSnimek()).observe(el);
}
function vykresli3dSnimek() {
  if (!r3) return;
  const el = $('scena3d'), w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  r3.renderer.setSize(w, h, false);
  r3.camera.aspect = w / h; r3.camera.updateProjectionMatrix();
  const o = r3.orb;
  r3.camera.position.set(o.cil.x + o.r * Math.cos(o.el) * Math.sin(o.az), o.cil.y - o.r * Math.cos(o.el) * Math.cos(o.az), o.cil.z + o.r * Math.sin(o.el));
  r3.camera.lookAt(o.cil);
  r3.renderer.render(r3.scene, r3.camera);
}
/* narovnaná fotka plochy (u perspektivy přepočtem každého texelu přes homografii) + rozsah v mm */
function texturaPlochy(pl) {
  const f = fotky[pl.id];
  if (!f) return null;
  if (f.textura) return f.textura;
  const kal = pl.kal, W = f.obr.width, H = f.obr.height;
  const rohy = [[0, 0], [W, 0], [W, H], [0, H]].map(p => J.zObrazu(kal, ...p));
  let x0 = Math.min(...rohy.map(p => p[0])), x1 = Math.max(...rohy.map(p => p[0])), y0 = Math.min(...rohy.map(p => p[1])), y1 = Math.max(...rohy.map(p => p[1]));
  if (kal.H && kal.rozmer) { // u horizontu by rozsah utekl do nekonečna
    const [rw, rh] = kal.rozmer, r0 = J.zObrazu(kal, ...kal.rohy[0]);
    x0 = Math.max(x0, r0[0] - 4 * rw); x1 = Math.min(x1, r0[0] + 5 * rw); y0 = Math.max(y0, r0[1] - 4 * rh); y1 = Math.min(y1, r0[1] + 5 * rh);
  }
  const k = 1024 / Math.max(x1 - x0, y1 - y0), tw = Math.max(2, Math.round((x1 - x0) * k)), th = Math.max(2, Math.round((y1 - y0) * k));
  const c = document.createElement('canvas'); c.width = tw; c.height = th;
  const x = c.getContext('2d');
  if (!kal.H) x.drawImage(f.obr, 0, 0, tw, th);
  else {
    const zdroj = f.obr.getContext('2d').getImageData(0, 0, W, H).data, cil = x.createImageData(tw, th);
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      const [px, py] = J.doObrazu(kal, x0 + (i + 0.5) / k, y1 - (j + 0.5) / k), ix = Math.floor(px), iy = Math.floor(py);
      if (!(ix >= 0 && iy >= 0 && ix < W && iy < H)) continue;
      const a = (iy * W + ix) * 4, b = (j * tw + i) * 4;
      cil.data[b] = zdroj[a]; cil.data[b + 1] = zdroj[a + 1]; cil.data[b + 2] = zdroj[a + 2]; cil.data[b + 3] = 255;
    }
    x.putImageData(cil, 0, 0);
  }
  f.textura = { canvas: c, x0, x1, y0, y1, tex: null };
  return f.textura;
}
let posledniCil = '';
function kresli3d() {
  if (!r3) return;
  const T = THREE, g = r3.skupina, u = jednotka(), styl = getComputedStyle(document.documentElement);
  const textBarva = styl.getPropertyValue('--text').trim() || '#ddd';
  r3.scene.background = new T.Color(styl.getPropertyValue('--bg-panel').trim() || '#222');
  while (g.children.length) { const c = g.children.pop(); c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }
  const V = p => new T.Vector3(p[0], p[1], p[2]);
  const cara = (body, barva, carky) => {
    const geo = new T.BufferGeometry().setFromPoints(body.map(V));
    const m = carky ? new T.LineDashedMaterial({ color: barva, dashSize: carky, gapSize: carky * 0.7 }) : new T.LineBasicMaterial({ color: barva });
    const l = new T.Line(geo, m); if (carky) l.computeLineDistances(); g.add(l);
  };
  // plochy s fotkami a rozsah scény
  const rozsah = new T.Box3();
  for (const pl of data.plochy) {
    const B = J.bazePlochy(pl), t = texturaPlochy(pl);
    const [x0, x1, y0, y1] = t ? [t.x0, t.x1, t.y0, t.y1] : [0, 1000, 0, 700];
    if (t) {
      if (!t.tex) t.tex = new T.CanvasTexture(t.canvas);
      const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, y1 - y0), new T.MeshBasicMaterial({ map: t.tex, side: T.DoubleSide, transparent: !!pl.kal.H }));
      m.matrixAutoUpdate = false;
      m.matrix.makeBasis(V(B.eu), V(B.ev), V(B.n)).setPosition(V(J.doMistnosti(B, (x0 + x1) / 2, (y0 + y1) / 2, 0)));
      g.add(m);
    }
    for (const p of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) rozsah.expandByPoint(V(J.doMistnosti(B, p[0], p[1], 0)));
  }
  const vel = Math.max(1, ...rozsah.getSize(new T.Vector3()).toArray());
  const koule = (p, r, barva, pruhl) => {
    const m = new T.Mesh(new T.SphereGeometry(r, 20, 14), new T.MeshLambertMaterial({ color: barva, transparent: !!pruhl, opacity: pruhl || 1 }));
    m.position.copy(V(p)); g.add(m);
  };
  cara([[0, 0, 0], [vel * 0.15, 0, 0]], 0xd04040); cara([[0, 0, 0], [0, vel * 0.15, 0]], 0x40a040); cara([[0, 0, 0], [0, 0, vel * 0.15]], 0x4070d0);
  if (A) {
    for (const r of A.rovina) {
      const B = A.baze[r.plocha], s = stopa(r.id);
      koule(J.doMistnosti(B, r.x, r.y, 0), vel * 0.004, s ? barvaStopy(s) : SEDA);
    }
    for (const p of A.paprsky) if (A.odlehle.includes(p.id)) cara([p.P, [0, 1, 2].map(i => p.P[i] + p.d[i] * vel * 0.25)], SEDA, vel * 0.008);
    const N = data.nastaveni, vStred = (N.vMin + N.vMax) / 2 * 1000;
    A.zdroje.forEach((z, i) => {
      const barva = barvaZdroje(i), c = [z.bod.x, z.bod.y, z.bod.z], cl = A.paprsky.filter(p => z.ids.includes(p.id));
      for (const p of cl) {
        const t = Math.max(0, (c[0] - p.P[0]) * p.d[0] + (c[1] - p.P[1]) * p.d[1] + (c[2] - p.P[2]) * p.d[2]);
        cara([p.P, [0, 1, 2].map(k => p.P[k] + p.d[k] * t)], barva);
      }
      if (z.gravitace) {
        const kg = J.korekceGravitace(cl, vStred);
        if (kg) for (const b of kg.body) cara(J.drahaZpet(cl.find(p => p.id === b.id), vStred, b.t, 24), barva, vel * 0.01);
      }
      koule(c, vel * 0.009, barva);
      for (const rv of z.roviny) if (rv.tangentaMistnost) koule(rv.tangentaMistnost, vel * 0.006, barva, 0.45);
      const o = mc && mc[i];
      if (o) {
        g.add(new T.Points(new T.BufferGeometry().setFromPoints(o.body.map(V)), new T.PointsMaterial({ color: barva, size: vel * 0.004, transparent: true, opacity: 0.45 })));
        const [a, b, cc] = o.smery.map(V);
        if (new T.Vector3().crossVectors(a, b).dot(cc) < 0) cc.negate();
        const m = new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshBasicMaterial({ color: barva, wireframe: true, transparent: true, opacity: 0.3 }));
        m.matrixAutoUpdate = false;
        m.matrix.makeBasis(a, b, cc).multiply(new T.Matrix4().makeScale(...o.osy.map(v => Math.max(v, vel * 0.002)))).setPosition(V(o.stred));
        g.add(m);
      }
      const v = J.zMistnosti(J.bazePlochy({ typ: 'podlaha' }), c);
      cara([[v[0], v[1], 0], c], textBarva, vel * 0.01);
    });
  }
  const cil = `${data.plochy.map(p => p.id + p.typ + p.O + p.natoceni).join()}|${Math.round(vel)}`;
  if (cil !== posledniCil) {
    posledniCil = cil;
    r3.orb.cil.copy(rozsah.isEmpty() ? new T.Vector3() : rozsah.getCenter(new T.Vector3()));
    r3.orb.cil.z += vel * 0.08;
    r3.orb.r = vel * 2.3;
  }
  $('legenda3d').innerHTML = `${A && A.zdroje.length ? A.zdroje.map((z, i) => `<div><i style="background:${barvaZdroje(i)}"></i>${z.id}: přímky, zdroj, 90% elipsoid${z.gravitace ? ', čárkovaně dráhy s gravitací' : ''}</div>`).join('') : ''}<div><i style="background:${SEDA}"></i>odlehlé stopy</div><div><i style="background:${textBarva}"></i>svislice ze zdroje</div><div>osy: <b style="color:#d04040">X</b> <b style="color:#40a040">Y</b> <b style="color:#4070d0">Z</b> (${u})</div>`;
  $('panel3d').innerHTML = `<div><h2>Výsledek</h2>${htmlUkazka(true)}${htmlVysledky(false)}</div><p class="tip">Tažením otáčení, s Shiftem nebo pravým tlačítkem posun, kolečkem zoom. Průhledné koule = tangentová metoda na jednotlivých plochách.</p><div class="radek-tl"><button class="btn mini" data-prikaz="pohled3d" data-p="cela">⤢ Výchozí</button><button class="btn mini" data-prikaz="pohled3d" data-p="shora">⊙ Shora</button><button class="btn mini" data-prikaz="pohled3d" data-p="x">⟂ Z boku (X)</button><button class="btn mini" data-prikaz="pohled3d" data-p="y">⟂ Z boku (Y)</button></div>`;
  vykresli3dSnimek();
}

/* ---------- vykreslení ---------- */
function vykresliPlochy() {
  $('vyberPlochy').innerHTML = data.plochy.map(p => `<option value="${esc(p.id)}"${p.id === plocha().id ? ' selected' : ''}>${esc(p.nazev)}${fotky[p.id] ? '' : ' (bez fotky)'}</option>`).join('');
}
function vykresli() {
  document.querySelectorAll('[data-pohled]').forEach(b => b.setAttribute('aria-pressed', b.dataset.pohled === pohled));
  document.querySelectorAll('.lista [data-nastroj]').forEach(b => b.setAttribute('aria-pressed', b.dataset.nastroj === nastroj));
  $('tlLupa').setAttribute('aria-pressed', lupa);
  $('pFoto').hidden = pohled !== 'foto'; $('pTabulka').hidden = pohled !== 'tabulka'; $('p3d').hidden = pohled !== '3d';
  platno.style.cursor = nastroj === 'posun' ? 'grab' : 'crosshair';
  vykresliPlochy(); obnovUvod();
  if (pohled === 'foto') { vykresliPanel(); kresliPlatno(); }
  else if (pohled === 'tabulka') vykresliTabulku();
  else init3d().then(kresli3d);
}
function nastavNastroj(n) {
  if (n !== 'body') rozpracovane = [];
  if (n !== 'meritko') meritkoBody = [];
  if (n !== 'perspektiva') rohyBody = [];
  if (n !== 'posun' && n !== 'ocasek' && !obrazek()) { Dialog.info('Nejdřív otevřete fotku plochy.'); n = 'posun'; }
  nastroj = n;
  if (!KLADENI.has(n)) mys = null;
  if (pohled !== 'foto') pohled = 'foto';
  vykresli();
}
function prepniPlochu(id) {
  if (!data.plochy.some(p => p.id === id)) return;
  data.aktivni = id; vybrana = null; rozpracovane = []; meritkoBody = []; rohyBody = [];
  if (fotka()) prah = fotka().prahOtsu;
  uloz(); vykresli(); vejdiSe();
}

/* ---------- galerie ukázek ---------- */
function vykresliGalerii() {
  const karta = u => `<button class="karta" data-prikaz="ukazka" data-id="${u.id}"><span class="ik" aria-hidden="true">${u.ikona}</span><b>${esc(u.nazev)}</b><span>${esc(u.popis)}</span></button>`;
  $('galerieUvod').innerHTML = $('galerieDlg').innerHTML = J.UKAZKY.map(karta).join('');
  $('nabUkazky').innerHTML = '<button class="tl" data-prikaz="galerie">🗂️ Galerie ukázek…<small>G</small></button><hr>' + J.UKAZKY.map(u => `<button class="tl" data-prikaz="ukazka" data-id="${u.id}">${u.ikona} ${esc(u.nazev)}</button>`).join('');
}
/* vygenerovaná fotka ukázky: podklad, pravítko / A4, stopy s ocásky; u perspektivy pak zkosení přes homografii */
function vykresliUkazku(o, typ) {
  const nah = J.rng(99), W = o.W, H = o.H, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = typ === 'podlaha' ? '#e6e0d2' : '#ece9e2'; x.fillRect(0, 0, W, H);
  if (typ === 'podlaha') { // spáry dlažby po 300 mm
    x.strokeStyle = '#d3ccbc'; x.lineWidth = 2;
    for (let p = 0; p < W; p += 300 / o.mmNaPx) { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, H); x.stroke(); }
    for (let p = H; p > 0; p -= 300 / o.mmNaPx) { x.beginPath(); x.moveTo(0, p); x.lineTo(W, p); x.stroke(); }
  }
  for (let i = 0; i < W * H / 300; i++) { x.fillStyle = `rgba(${nah() < 0.5 ? '255,255,255' : '120,110,95'},0.07)`; x.fillRect(nah() * W, nah() * H, 2, 2); }
  if (o.pravitko) {
    const p = o.pravitko, d = p.mm / o.mmNaPx;
    x.fillStyle = '#f7f3e3'; x.fillRect(p.x - 10, p.y - 34, d + 20, 44); x.strokeStyle = '#6b6b6b'; x.lineWidth = 1; x.strokeRect(p.x - 10, p.y - 34, d + 20, 44);
    x.fillStyle = '#222'; x.font = '16px sans-serif'; x.textAlign = 'center';
    for (let mm = 0; mm <= p.mm; mm += 5) {
      const px = p.x + mm / o.mmNaPx, dl = mm % 50 === 0 ? 22 : mm % 10 === 0 ? 14 : 8;
      x.fillRect(px - 0.5, p.y - 34, 1, dl);
      if (mm % 50 === 0) x.fillText(mm / 10 + ' cm', px, p.y + 4);
    }
  }
  if (o.a4) {
    const a = o.a4;
    x.fillStyle = '#fbfbf8'; x.fillRect(a.x, a.y, a.w, a.h); x.strokeStyle = '#a0a0a0'; x.lineWidth = 2; x.strokeRect(a.x, a.y, a.w, a.h);
    x.fillStyle = '#b8b8b8'; x.font = '48px sans-serif'; x.textAlign = 'center'; x.fillText('A4', a.x + a.w / 2, a.y + a.h / 2 + 16);
  }
  x.fillStyle = '#5b1f1c';
  for (const s of o.stopy) {
    if (s.sum) {
      x.beginPath();
      for (let i = 0; i < 40; i++) {
        const t = i / 40 * 2 * Math.PI, f = 1 + (nah() - 0.5) * s.sum, ex = s.a * Math.cos(t) * f, ey = s.b * Math.sin(t) * f;
        const px = s.cx + ex * Math.cos(s.theta) - ey * Math.sin(s.theta), py = s.cy + ex * Math.sin(s.theta) + ey * Math.cos(s.theta);
        if (i) x.lineTo(px, py); else x.moveTo(px, py);
      }
      x.closePath(); x.fill();
    } else { x.beginPath(); x.ellipse(s.cx, s.cy, s.a, s.b, s.theta, 0, 2 * Math.PI); x.fill(); }
    const dx = s.tx, dy = -s.ty, o1 = s.a + 4 + s.b * 0.6;
    x.beginPath(); x.ellipse(s.cx + dx * o1, s.cy + dy * o1, s.b * 0.55, s.b * 0.22, s.theta, 0, 2 * Math.PI); x.fill();
    if (s.sum) { const o2 = o1 + s.b * 1.4 + 6; x.beginPath(); x.arc(s.cx + dx * o2, s.cy + dy * o2, Math.max(1.5, s.b * 0.15), 0, 2 * Math.PI); x.fill(); }
  }
  if (o.satelity) for (let i = 0; i < 60; i++) {
    const px = 40 + nah() * (W - 80), py = 40 + nah() * (H - 160);
    if (o.stopy.some(s => Math.hypot(px - s.cx, py - s.cy) < s.a * 2 + 20)) continue;
    x.beginPath(); x.arc(px, py, 1.5 + nah() * 2, 0, 2 * Math.PI); x.fill();
  }
  if (!o.Hfoto) return c;
  // šikmý pohled: každý pixel fotky ← bilineárně z narovnaného obrázku
  const zdroj = x.getImageData(0, 0, W, H).data, f = document.createElement('canvas');
  f.width = W; f.height = H;
  const fx = f.getContext('2d'), cil = fx.createImageData(W, H), Hi = J.inverzeH(o.Hfoto);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const [u, v] = J.aplikujH(Hi, i + 0.5, j + 0.5), b = (j * W + i) * 4, u0 = Math.floor(u - 0.5), v0 = Math.floor(v - 0.5);
    if (!(u0 >= 0 && v0 >= 0 && u0 < W - 1 && v0 < H - 1)) { cil.data[b] = 125; cil.data[b + 1] = 119; cil.data[b + 2] = 108; cil.data[b + 3] = 255; continue; }
    const au = u - 0.5 - u0, av = v - 0.5 - v0;
    for (let k = 0; k < 3; k++) {
      const p = q => zdroj[q * 4 + k], i00 = v0 * W + u0;
      cil.data[b + k] = (p(i00) * (1 - au) + p(i00 + 1) * au) * (1 - av) + (p(i00 + W) * (1 - au) + p(i00 + W + 1) * au) * av;
    }
    cil.data[b + 3] = 255;
  }
  fx.putImageData(cil, 0, 0);
  return f;
}
async function nactiUkazku(id) {
  if (!data.ukazka && (data.stopy.length || Object.keys(fotky).length) && !await Dialog.potvrd('Nahradit současný projekt ukázkou?')) return;
  if ($('dlgUkazky').open) $('dlgUkazky').close();
  const u = J.ukazka(id);
  if (!u) return;
  data = u.data;
  data.ukazka = { id, zdroje: u.zdroje };
  for (const k of Object.keys(fotky)) delete fotky[k];
  for (const pl of data.plochy) {
    const o = u.obrazy[pl.id], c = vykresliUkazku(o, pl.typ);
    await nastavObrazek(pl.id, await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.92)), false);
    if (!o.detekce) continue;
    const f = fotky[pl.id];
    for (const s of o.stopy) { // stopy se najdou prahováním jako při ruční práci
      const H = o.Hfoto, [cx, cy] = H ? J.aplikujH(H, s.cx, s.cy) : [s.cx, s.cy];
      const z = J.zaplav(f.jasy, f.obr.width, f.obr.height, cx, cy, 140);
      const e = z && !z.okraj && !z.preteklo && z.body.length > 30 ? J.elipsaZMomentu(z.body) : null;
      const st = J.stopaZUkazky(s, o);
      if (e) {
        const tip = H ? J.aplikujH(H, s.cx + s.tx * s.a * 2, s.cy - s.ty * s.a * 2) : [s.cx + s.tx * s.a * 2, s.cy - s.ty * s.a * 2];
        Object.assign(st, { cx: e.cx, cy: e.cy, a: e.a, b: e.b, theta: e.theta });
        st.smer = J.smerZOcasku(st, tip[0], tip[1]);
      }
      data.stopy.push(st);
    }
  }
  vybrana = null; rozpracovane = []; meritkoBody = []; rohyBody = []; nastroj = 'posun'; pohled = 'foto';
  if (fotka()) prah = fotka().prahOtsu;
  zmena(); vejdiSe();
  Dialog.info(`Ukázka „${u.nazev}“ – co si tu vyzkoušet, je v panelu vpravo.`);
}

/* ---------- soubory a export ---------- */
function stahni(obsah, jmeno, typ) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(obsah instanceof Blob ? obsah : new Blob([obsah], { type: typ }));
  a.download = jmeno; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const blobNaDataUrl = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
const datumSoubor = () => new Date().toISOString().slice(0, 10);
const jmenoSouboru = () => 'krevni-stopy-' + (plocha().nazev || 'plocha').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() + '-' + datumSoubor();
/* nákres plochy v „obrazovkových“ souřadnicích šířky sirka (čáry a písmo jako na monitoru), fotka v plném rozlišení */
function nakresPlatno(idPl, sirka, kvalitaFoto) {
  const f = fotky[idPl], W = f.obr.width, H = f.obr.height, m = Math.max(1, W / sirka);
  const c = document.createElement('canvas'), k = kvalitaFoto ? 1 : Math.min(1, sirka / W);
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  const x = c.getContext('2d'), sk = k * m;
  x.setTransform(sk, 0, 0, sk, 0, 0);
  x.drawImage(f.obr, 0, 0, W / m, H / m);
  kresliScenu(peroPlatno(x), { s: 1 / m, tx: 0, ty: 0 }, idPl);
  return c;
}
async function svgNakres(idPl) {
  const f = fotky[idPl], W = f.obr.width, H = f.obr.height, m = Math.max(1, W / 1600), casti = [];
  kresliScenu(peroSvg(casti), { s: 1 / m, tx: 0, ty: 0 }, idPl);
  const foto = await blobNaDataUrl(await new Promise(ok => f.obr.toBlob(ok, 'image/jpeg', 0.9)));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(W / m).toFixed(0)}" height="${(H / m).toFixed(0)}" viewBox="0 0 ${(W / m).toFixed(2)} ${(H / m).toFixed(2)}">\n<title>${esc(nazevPlochy(idPl))} – úhel dopadu krevních stop</title>\n<g id="fotka"><image width="${(W / m).toFixed(2)}" height="${(H / m).toFixed(2)}" href="${foto}" xlink:href="${foto}"/></g>\n<g id="nakres">${casti.join('\n')}</g>\n</svg>\n`;
}

/* ---------- protokol ---------- */
/* schéma místnosti v průmětu os (0 = X, 1 = Y, 2 = Z) – pevné barvy, jde jen do tisku */
function schema(osa1, osa2, titul) {
  const c = document.createElement('canvas'); c.width = 760; c.height = 520;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  const pts = [], plochy = [];
  for (const pl of data.plochy) {
    const t = texturaPlochy(pl), B = J.bazePlochy(pl);
    if (!t) continue;
    const r = [[t.x0, t.y0], [t.x1, t.y0], [t.x1, t.y1], [t.x0, t.y1]].map(p => J.doMistnosti(B, p[0], p[1], 0));
    plochy.push(r); pts.push(...r);
  }
  if (A) { for (const p of A.paprsky) pts.push(p.P); for (const z of A.zdroje) pts.push([z.bod.x, z.bod.y, z.bod.z]); }
  if (!pts.length) return null;
  const a0 = Math.min(...pts.map(p => p[osa1])), a1 = Math.max(...pts.map(p => p[osa1])), b0 = Math.min(...pts.map(p => p[osa2])), b1 = Math.max(...pts.map(p => p[osa2]));
  const k = Math.min((c.width - 80) / ((a1 - a0) || 1), (c.height - 80) / ((b1 - b0) || 1));
  const S2 = (a, b) => [50 + (a - a0) * k, c.height - 40 - (b - b0) * k], S = p => S2(p[osa1], p[osa2]);
  const pero = peroPlatno(x);
  for (const r of plochy) pero.plocha(r.map(S), '#999', 0.15, '#777');
  if (A) {
    for (const p of A.paprsky) if (A.odlehle.includes(p.id)) pero.cara([S(p.P), S([0, 1, 2].map(i => p.P[i] + p.d[i] * 0.25 * (a1 - a0 + b1 - b0)))], SEDA, 1, [3, 4]);
    A.zdroje.forEach((z, i) => {
      const barva = barvaZdroje(i), cc = [z.bod.x, z.bod.y, z.bod.z];
      for (const p of A.paprsky.filter(q => z.ids.includes(q.id))) {
        const t = Math.max(0, (cc[0] - p.P[0]) * p.d[0] + (cc[1] - p.P[1]) * p.d[1] + (cc[2] - p.P[2]) * p.d[2]);
        pero.cara([S(p.P), S([0, 1, 2].map(j => p.P[j] + p.d[j] * t))], barva, 1);
        pero.kruh(...S(p.P), 2.5, barva);
      }
      const o = mc && mc[i];
      if (o) { const e = J.elipsa2D(o.body.map(b => [b[osa1], b[osa2]])); if (e) { const b = J.bodyElipsy(e, 48); b.push(b[0]); pero.cara(b.map(p => S2(...p)), barva, 1.2, [3, 3]); } }
      const [sx, sy] = S(cc); pero.kruh(sx, sy, 5, barva, '#000', 1); pero.text(z.id, sx + 8, sy - 8, barva);
    });
  }
  const jm = ['X', 'Y', 'Z'];
  x.fillStyle = '#000'; x.font = '13px sans-serif';
  x.fillText(`${titul} – vodorovně ${jm[osa1]}, svisle ${jm[osa2]} (${jednotka()})`, 10, 18);
  x.strokeStyle = '#000'; x.beginPath(); x.moveTo(20, c.height - 20); x.lineTo(60, c.height - 20); x.moveTo(20, c.height - 20); x.lineTo(20, c.height - 60); x.stroke();
  x.fillText(jm[osa1], 64, c.height - 16); x.fillText(jm[osa2], 15, c.height - 64);
  return c.toDataURL('image/png');
}
function tiskniProtokol() {
  const p = data.pripad, u = jednotka(), N = data.nastaveni;
  let obr3d = '';
  if (r3) { try { kresli3d(); obr3d = r3.renderer.domElement.toDataURL('image/png'); } catch (e) { obr3d = ''; } }
  const radky = radkyTabulky().sort((a, b) => a.s.nazev.localeCompare(b.s.nazev, 'cs', { numeric: true }));
  const pudorys = schema(0, 1, 'Půdorys'), narys = schema(0, 2, 'Nárys');
  const planky = data.plochy.filter(pl => fotky[pl.id]).map(pl => `<figure><img src="${nakresPlatno(pl.id, 1400, false).toDataURL('image/jpeg', 0.88)}" alt="Nákres plochy"><figcaption data-i18n="ne">${esc(pl.nazev)}</figcaption></figure>`).join('');
  const kal = pl => pl.kal.H ? `perspektiva ze 4 rohů obdélníku ${fmt(pl.kal.rozmer[0], 0)} × ${fmt(pl.kal.rozmer[1], 0)} mm` : pl.kal.mmNaPx > 0 ? `měřítko ${fmt(pl.kal.mm, 1)} mm = ${fmt(pl.kal.mm / pl.kal.mmNaPx, 0)} px (${fmt(1 / pl.kal.mmNaPx, 2)} px/mm)` : 'bez měřítka – hodnoty v px';
  const zdrojeTab = A && A.zdroje.length ? `<table><thead><tr><th>Zdroj</th><th>Stop</th><th>X</th><th>Y</th><th>Z</th><th>RMS</th><th>90% interval Z</th><th>Poloosy 90% elipsoidu</th><th>S gravitací Z</th></tr></thead><tbody>${A.zdroje.map((z, i) => {
    const o = mc && mc[i], g = z.gravitace;
    return `<tr><td>${z.id}</td><td>${z.ids.length}</td><td>${fmt(z.bod.x, 0)}</td><td>${fmt(z.bod.y, 0)}</td><td>${fmt(z.bod.z, 0)}</td><td>${fmt(z.bod.rms, 1)}</td><td>${o ? fmt(o.statistika[2].p5, 0) + ' – ' + fmt(o.statistika[2].p95, 0) : '–'}</td><td>${o ? o.osy.map(v => fmt(v, 0)).join(' × ') : '–'}</td><td>${g && g[0] && g[1] ? fmt(g[0].z, 0) + ' – ' + fmt(g[1].z, 0) : '–'}</td></tr>`;
  }).join('')}</tbody></table><p>Souřadnice místnosti v ${u}: X, Y vodorovně, Z nahoru. Tangentová metoda po plochách:</p><table><thead><tr><th>Zdroj</th><th>Plocha</th><th>Stop</th><th>Konvergence x; y</th><th>Vzdálenost od plochy z (průměr ± SD)</th></tr></thead><tbody>${A.zdroje.map(z => z.roviny.map(rv => `<tr><td>${z.id}</td><td data-i18n="ne">${esc(nazevPlochy(rv.plocha))}</td><td>${rv.n}</td><td>${fmt(rv.konvergence.x, 0)}; ${fmt(rv.konvergence.y, 0)}</td><td>${fmt(rv.tangenta.z, 0)} ± ${fmt(rv.tangenta.sd, 0)}</td></tr>`).join('')).join('')}</tbody></table>` : '<p>Zdroj nebyl určen (málo stop se směrem).</p>';
  $('protokol').innerHTML = `
    <h1>Protokol – úhel dopadu krevních stop a oblast původu</h1>
    <p>Vytvořeno ${new Date().toLocaleString(document.documentElement.lang || 'cs')} nástrojem „Úhel dopadu krevních stop“ (vzdělávací pomůcka, nenahrazuje znalecký posudek).</p>
    <table><tbody>
      <tr><th>Případ</th><td data-i18n="ne">${esc(p.cislo)}</td><th>Zpracoval</th><td data-i18n="ne">${esc(p.zpracoval)}</td></tr>
      <tr><th>Místo</th><td colspan="3" data-i18n="ne">${esc(p.misto)}</td></tr>
      <tr><th>Plochy</th><td colspan="3" data-i18n="ne">${esc(p.plocha)}</td></tr>
      ${p.pozn ? `<tr><th>Poznámka</th><td colspan="3" data-i18n="ne">${esc(p.pozn)}</td></tr>` : ''}
    </tbody></table>
    <h2>1. Výsledek – oblast původu</h2>
    ${zdrojeTab}
    ${A && A.odlehle.length ? `<p>Odlehlé stopy vyřazené robustním hledáním (do výpočtu nevstupují): ${A.odlehle.map(id => esc((stopa(id) || {}).nazev || id)).join(', ')}.</p>` : ''}
    ${data.ukazka ? `<h3>Ukázka se známým zdrojem</h3>${htmlUkazka(true)}` : ''}
    <h2>2. Podklady</h2>
    <table><thead><tr><th>Plocha</th><th>Typ</th><th>Umístění O (X; Y; Z)</th><th>Natočení</th><th>Fotka</th><th>Kalibrace</th><th>Stop</th></tr></thead><tbody>
    ${data.plochy.map(pl => `<tr><td data-i18n="ne">${esc(pl.nazev)}</td><td>${J.TYPY_PLOCH[pl.typ]}</td><td>${pl.O.map(v => fmt(v, 0)).join('; ')}</td><td>${fmt(pl.natoceni, 0)}°</td><td>${fotky[pl.id] ? fotky[pl.id].obr.width + ' × ' + fotky[pl.id].obr.height + ' px' : '–'}</td><td>${kal(pl)}</td><td>${data.stopy.filter(s => s.plocha === pl.id).length}</td></tr>`).join('')}
    </tbody></table>
    <h2>3. Obrazová příloha</h2>
    ${planky}
    <div class="dvojobr">${pudorys ? `<figure><img src="${pudorys}" alt="Půdorys"><figcaption>Půdorys: stopy, zpětné přímky a zdroje s 90% elipsou nejistoty.</figcaption></figure>` : ''}${narys ? `<figure><img src="${narys}" alt="Nárys"><figcaption>Nárys (pohled z boku).</figcaption></figure>` : ''}</div>
    ${obr3d ? `<figure><img src="${obr3d}" alt="3D náhled"><figcaption>3D náhled místnosti.</figcaption></figure>` : ''}
    <h2>4. Tabulka stop</h2>
    <table><thead><tr><th>Stopa</th>${data.plochy.length > 1 ? '<th>Plocha</th>' : ''}<th>Zdroj</th><th>x</th><th>y</th><th>Šířka</th><th>Délka</th><th>š/d</th><th>α °</th><th>γ °</th><th>Odchylka</th><th>z (tg)</th><th>Metoda</th></tr></thead><tbody>
    ${radky.map(q => `<tr><td data-i18n="ne">${esc(q.s.nazev)}</td>${data.plochy.length > 1 ? `<td data-i18n="ne">${esc(nazevPlochy(q.s.plocha))}</td>` : ''}<td>${q.z ? q.z.id : odlehla(q.s.id) ? 'odlehlá' : q.s.pouzit ? '–' : 'vyřazena'}</td><td>${fmt(q.r.x, 0)}</td><td>${fmt(q.r.y, 0)}</td><td>${fmt(q.r.sirka, 2)}</td><td>${fmt(q.r.delka, 2)}</td><td>${fmt(q.r.pomer, 3)}</td><td>${fmt(q.r.alfa, 1)}</td><td>${q.r.gamma == null ? '–' : fmt(q.r.gamma, 1)}</td><td>${Number.isFinite(q.odch) ? fmt(q.odch, 1) : ''}</td><td>${Number.isFinite(q.ztg) ? fmt(q.ztg, 0) : ''}</td><td>${q.s.metoda === 'prah' ? 'práh' : 'body'}${q.s.upraveno ? ', doladěno' : ''}</td></tr>`).join('')}
    </tbody></table>
    <p>Délky v ${u}; x, y v rovině plochy od referenčního bodu.</p>
    <h2>5. Metodika</h2>
    <ol>
      <li>Kalibrace fotky: měřítko ze dvou bodů známé vzdálenosti, nebo homografie ze 4 rohů obdélníku známých rozměrů (korekce perspektivy).</li>
      <li>Proložení elipsy: přímá metoda nejmenších čtverců z bodů okraje (Fitzgibbon, Halíř & Flusser), nebo momenty 2. řádu prahované oblasti; případně ruční doladění.</li>
      <li>Úhel dopadu <span class="vzorec">α = arcsin(š / d)</span>; směr γ podle ocásku (0° nahoru, 90° doprava).</li>
      <li>Zpětné přímky převedené do společných souřadnic místnosti; zdroj = bod nejblíže přímkám (nejmenší čtverce).</li>
      <li>${N.shluky ? `Více zdrojů a odlehlé stopy: postupný RANSAC, práh ${fmt(N.prahShluku, 0)} mm, nejméně ${N.minShluk} stopy na zdroj.` : 'Hledání více zdrojů vypnuto – všechny použité stopy tvoří jeden zdroj.'}</li>
      <li>Tangentová metoda na každé ploše: z = D · tan α od bodu konvergence (nejmenší čtverce kolmých vzdáleností průmětů přímek).</li>
      <li>Nejistota Monte Carlo: σ rozměru ${fmt(N.sRozmer, 2)} mm, σ γ ${fmt(N.sGamma, 1)}°, 300 opakování; 90% elipsoid (χ², 3 stupně volnosti).</li>
      <li>Gravitace: vodorovný průsečík průmětů drah a zpětné vedení po parabole pro rychlosti dopadu ${fmt(N.vMin, 1)}–${fmt(N.vMax, 1)} m/s (bez odporu vzduchu).</li>
    </ol>
    <h2>6. Omezení</h2>
    <ul>
      <li>Přímky i tangentová metoda předpokládají přímou dráhu; skutečná dráha je zakřivená (gravitace, odpor vzduchu), proto výšku nadhodnocují – jde o horní odhad. Korekce gravitace je přibližná.</li>
      <li>Přesnost závisí na kalibraci fotky, rozlišení, kvalitě okraje stop a výběru stop z jednoho děje; stopy s α nad 70° mají nejistý směr. Automatické vyřazení odlehlých stop nenahrazuje úsudek.</li>
      <li>Výsledek je oblast, ne bod; interpretace náleží znalci s ohledem na celé místo činu.</li>
    </ul>
    <p>Zdroje: SWGSTAIN – Recommended Terminology a Guidelines; Bevel & Gardner (2008); James, Kish & Sutton (2005); Attinger a kol., FSI 231 (2013); Camana, FSI 231 (2013); Varney & Gittes, Am. J. Phys. 79 (2011); Fischler & Bolles (1981).</p>
    <div class="podpis"><span>Datum: ____________</span><span>Podpis: ______________________</span></div>`;
  setTimeout(() => window.print(), 100);
}

/* ---------- příkazy ---------- */
function vyberDalsi(krok) {
  const st = data.stopy.filter(s => s.plocha === plocha().id);
  if (!st.length) return;
  const i = st.findIndex(s => s.id === vybrana);
  vybrana = st[i < 0 ? (krok > 0 ? 0 : st.length - 1) : (i + krok + st.length) % st.length].id;
  vykresli();
}
function lupaNaStopu(s) {
  if (!s) return;
  if (s.plocha !== plocha().id) { data.aktivni = s.plocha; if (fotka()) prah = fotka().prahOtsu; }
  vybrana = s.id; pohled = 'foto'; vykresli();
  const { w, h } = velikostPlatna(), sc = Math.min(12, Math.max(pohledFoto.s, Math.min(w, h) / (s.a * 6)));
  pohledFoto = { s: sc, tx: w / 2 - s.cx * sc, ty: h / 2 - s.cy * sc }; celaFotka = false; kresliPlatno();
}
const PRIKAZY = {
  fotka: () => $('souborFotka').click(),
  galerie: () => $('dlgUkazky').showModal(),
  ukazka: el => nactiUkazku(el.dataset.id),
  ulozit: async () => {
    const obrazky = {};
    for (const pl of data.plochy) if (fotky[pl.id]) obrazky[pl.id] = await blobNaDataUrl(fotky[pl.id].blob);
    stahni(JSON.stringify({ aplikace: 'krevni_stopy', verze: J.VERZE, data, obrazky }), `krevni-stopy-${datumSoubor()}.json`, 'application/json');
  },
  otevrit: () => $('souborProjekt').click(),
  csv: () => { if (!data.stopy.length) return Dialog.info('Žádné stopy k exportu.'); stahni(J.csv(A, data), `krevni-stopy-${datumSoubor()}.csv`, 'text/csv;charset=utf-8'); },
  png: () => { if (!fotka()) return Dialog.info('Aktivní plocha nemá fotku.'); nakresPlatno(plocha().id, 1600, true).toBlob(b => stahni(b, jmenoSouboru() + '.png'), 'image/png'); },
  svg: async () => { if (!fotka()) return Dialog.info('Aktivní plocha nemá fotku.'); stahni(await svgNakres(plocha().id), jmenoSouboru() + '.svg', 'image/svg+xml'); },
  protokol: () => {
    if (!data.stopy.length) return Dialog.info('Žádné stopy – protokol by byl prázdný.');
    const f = $('dlgPripad').querySelector('form');
    for (const k of Object.keys(data.pripad)) f[k].value = data.pripad[k];
    $('dlgPripad').showModal();
  },
  smazStopy: async () => {
    const pl = plocha();
    if (await Dialog.potvrd(`Smazat všechny stopy plochy „${pl.nazev}“? Fotka a kalibrace zůstanou.`)) { data.stopy = data.stopy.filter(s => s.plocha !== pl.id); vybrana = null; zmena(); }
  },
  novy: async () => {
    if (!await Dialog.potvrd('Smazat všechny plochy, fotky, kalibrace i stopy?')) return;
    data = J.prazdna(); for (const k of Object.keys(fotky)) delete fotky[k];
    vybrana = null; rozpracovane = []; meritkoBody = []; rohyBody = []; nastroj = 'posun'; zmena();
  },
  plocha: () => {
    const pl = plocha(), f = $('dlgPlocha').querySelector('form');
    f.nazev.value = pl.nazev; f.typ.value = pl.typ; f.natoceni.value = pl.natoceni;
    f.ox.value = pl.O[0]; f.oy.value = pl.O[1]; f.oz.value = pl.O[2];
    $('tlSmazPlochu').hidden = data.plochy.length < 2;
    $('dlgPlocha').showModal();
  },
  novaPlocha: () => {
    const id = J.dalsiIdPlochy(data.plochy), pl = J.novaPlocha(data.plochy.some(p => p.typ === 'podlaha') ? 'stena' : 'podlaha', id);
    let n = 2, jm = pl.nazev;
    while (data.plochy.some(p => p.nazev === jm)) jm = pl.nazev + ' ' + n++;
    pl.nazev = jm;
    data.plochy.push(pl);
    prepocti();
    prepniPlochu(id);
    PRIKAZY.plocha();
  },
  nastaveni: () => {
    const f = $('dlgNastaveni').querySelector('form'), N = data.nastaveni;
    for (const k of ['sRozmer', 'sGamma', 'prahShluku', 'minShluk', 'vMin', 'vMax']) f[k].value = N[k];
    f.shluky.checked = N.shluky;
    $('dlgNastaveni').showModal();
  },
  zkratky: () => $('dlgZkratky').showModal(),
  napoveda: () => $('dlgNapoveda').showModal(),
  lupa: () => { lupa = !lupa; if (!lupa) mys = null; vykresli(); },
  zoomPlus: () => { const { w, h } = velikostPlatna(); zoomKolem(1.4, w / 2, h / 2); },
  zoomMinus: () => { const { w, h } = velikostPlatna(); zoomKolem(1 / 1.4, w / 2, h / 2); },
  zoomCela: () => vejdiSe(),
  proloz: () => prolozBody(),
  bodZpet: () => { rozpracovane.pop(); kresliPlatno(); vykresliPanel(); },
  bodyZrus: () => { rozpracovane = []; kresliPlatno(); vykresliPanel(); },
  rohyZrus: () => { rohyBody = []; kresliPlatno(); vykresliPanel(); },
  zrusPerspektivu: () => { const k = plocha().kal; k.H = null; k.rohy = null; k.rozmer = null; if (fotka()) fotka().textura = null; zmena(); },
  otsu: () => { prah = fotka() ? fotka().prahOtsu : 128; vykresliPanel(); },
  bezOcasku: () => nastavNastroj(predchozi),
  dalsiBezSmeru: () => {
    const s = data.stopy.find(q => q.plocha === plocha().id && !(rovinaStopy(q.id) && rovinaStopy(q.id).gamma != null));
    if (!s) return Dialog.info('Všechny stopy plochy mají směr.');
    vybrana = s.id; predchozi = nastroj === 'ocasek' ? predchozi : nastroj; nastavNastroj('ocasek');
  },
  ocasekVybrane: () => { predchozi = nastroj === 'ocasek' ? predchozi : nastroj; nastavNastroj('ocasek'); },
  dolad: el => dolad(el.dataset.co, +el.dataset.k),
  lupaStopy: () => lupaNaStopu(stopa(vybrana)),
  obratit: () => {
    const s = stopa(vybrana); if (!s) return;
    if (Number.isFinite(s.gammaRucne)) s.gammaRucne = (s.gammaRucne + 180) % 360; else s.smer = -s.smer || 1;
    zmena();
  },
  pouzit: () => { const s = stopa(vybrana); if (s) { s.pouzit = !s.pouzit; zmena(); } },
  smazStopu: async () => { const s = stopa(vybrana); if (s && await Dialog.potvrd(`Smazat stopu ${s.nazev}?`)) { data.stopy = data.stopy.filter(x => x !== s); vybrana = null; zmena(); } },
  smazRadek: async el => { const s = stopa(el.closest('tr').dataset.id); if (s && await Dialog.potvrd(`Smazat stopu ${s.nazev}?`)) { data.stopy = data.stopy.filter(x => x !== s); zmena(); } },
  ukazNaFotce: el => lupaNaStopu(stopa(el.closest('tr').dataset.id)),
  pohled3d: el => {
    if (!r3) return;
    const o = r3.orb, p = el.dataset.p;
    if (p === 'shora') { o.az = 0; o.el = 1.5; } else if (p === 'x') { o.az = 0; o.el = 0.02; } else if (p === 'y') { o.az = -Math.PI / 2; o.el = 0.02; }
    else { o.az = -0.6; o.el = 0.45; posledniCil = ''; return kresli3d(); }
    vykresli3dSnimek();
  }
};

/* ---------- události ---------- */
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
  const r = b.getBoundingClientRect();
  n.style.top = (r.bottom + 4) + 'px';
  n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
}));
document.addEventListener('click', e => {
  const p = e.target.closest('[data-prikaz]');
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](p); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
  const n = e.target.closest('[data-nastroj]');
  if (n) return nastavNastroj(n.dataset.nastroj);
  const pv = e.target.closest('[data-pohled]');
  if (pv) { pohled = pv.dataset.pohled; return vykresli(); }
  const v = e.target.closest('[data-vyber]');
  if (v) { vybrana = v.dataset.vyber; return vykresli(); }
  const rz = e.target.closest('[data-raz]');
  if (rz) { razeni = razeni.k === rz.dataset.raz ? { k: razeni.k, smer: -razeni.smer } : { k: rz.dataset.raz, smer: 1 }; vykresliTabulku(); const b = $('pTabulka').querySelector(`[data-raz="${rz.dataset.raz}"]`); if (b) b.focus(); }
});
$('vyberPlochy').addEventListener('change', e => prepniPlochu(e.target.value));
addEventListener('resize', () => { zavriNabidky(); if (pohled === 'foto') kresliPlatno(); });
new ResizeObserver(() => { if (pohled === 'foto') { if (celaFotka) vejdiSe(); else kresliPlatno(); } }).observe($('obalPlatna'));
const NASTROJ_KLAVESA = { v: 'posun', m: 'meritko', k: 'perspektiva', o: 'pocatek', b: 'body', p: 'prah', t: 'ocasek' };
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { zavriNabidky(); if (rozpracovane.length || meritkoBody.length || rohyBody.length) { rozpracovane = []; meritkoBody = []; rohyBody = []; vykresli(); } return; }
  if ((e.target.closest && e.target.closest('input,textarea,select,dialog')) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, x10 = e.shiftKey ? 10 : 1, s = stopa(vybrana);
  const hotovo = () => e.preventDefault();
  if (k === 'Enter' && nastroj === 'body') { hotovo(); prolozBody(); }
  else if (k === 'Backspace' && nastroj === 'body' && rozpracovane.length) { hotovo(); PRIKAZY.bodZpet(); }
  else if (k === 'Delete' && s) PRIKAZY.smazStopu();
  else if (NASTROJ_KLAVESA[k]) { hotovo(); nastavNastroj(NASTROJ_KLAVESA[k]); }
  else if (k === '1' || k === '2' || k === '3') { hotovo(); pohled = ['foto', 'tabulka', '3d'][+k - 1]; vykresli(); }
  else if (k === 'l') { hotovo(); PRIKAZY.lupa(); }
  else if (k === 'n') { hotovo(); vyberDalsi(e.shiftKey ? -1 : 1); }
  else if (k === 'g') { hotovo(); PRIKAZY.galerie(); }
  else if (k === '?') { hotovo(); PRIKAZY.zkratky(); }
  else if (pohled !== 'foto') return;
  else if (k === '0') { hotovo(); vejdiSe(); }
  else if (k === '+') { hotovo(); PRIKAZY.zoomPlus(); }
  else if (k === '-') { hotovo(); PRIKAZY.zoomMinus(); }
  else if (k.startsWith('Arrow')) {
    hotovo();
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (s) { if (d[0]) dolad('x', d[0] * x10); else dolad('y', d[1] * x10); }
    else { pohledFoto.tx -= d[0] * 40; pohledFoto.ty -= d[1] * 40; celaFotka = false; kresliPlatno(); }
  }
  else if (!s) return;
  else if (k === 'q' || k === 'e') { hotovo(); dolad('r', (k === 'e' ? 1 : -1) * x10); }
  else if (k === 'a' || k === 'd') { hotovo(); dolad('b', (k === 'd' ? 1 : -1) * x10); }
  else if (k === 'w' || k === 's') { hotovo(); dolad('a', (k === 'w' ? 1 : -1) * x10); }
  else if (k === 'r') { hotovo(); PRIKAZY.obratit(); }
  else if (k === 'u') { hotovo(); PRIKAZY.pouzit(); }
  else if (k === 'z') { hotovo(); lupaNaStopu(s); }
});
$('souborFotka').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const pl = plocha();
  if (data.stopy.some(s => s.plocha === pl.id) && !await Dialog.potvrd(`Nová fotka smaže stopy a kalibraci plochy „${pl.nazev}“. Pokračovat?`)) return;
  try {
    data.stopy = data.stopy.filter(s => s.plocha !== pl.id); vybrana = null;
    delete data.ukazka;
    await nastavObrazek(pl.id, f, true);
    nastavNastroj('meritko'); zmena(); vejdiSe();
  } catch (err) { Dialog.chyba('Fotku se nepodařilo otevřít.'); }
});
$('souborProjekt').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const o = JSON.parse(await f.text());
    if (!o || o.aplikace !== 'krevni_stopy') throw new Error();
    data = J.migruj(o.data);
    obnovUkazku(o.data);
    for (const k of Object.keys(fotky)) delete fotky[k];
    const obr = o.obrazky || (o.obrazek ? { [data.plochy[0].id]: o.obrazek } : {});
    for (const pl of data.plochy) if (typeof obr[pl.id] === 'string' && obr[pl.id].startsWith('data:image/')) await nastavObrazek(pl.id, await (await fetch(obr[pl.id])).blob(), false);
    vybrana = null;
    zmena(); vejdiSe();
  } catch (err) { Dialog.chyba('Soubor není projekt této stránky nebo je poškozený.'); }
});
$('dlgNastaveni').addEventListener('close', () => {
  if ($('dlgNastaveni').returnValue !== 'ok') return;
  const f = $('dlgNastaveni').querySelector('form'), N = data.nastaveni, c = (v, d) => Number.isFinite(+v) && v !== '' ? +v : d;
  N.sRozmer = Math.max(0, c(f.sRozmer.value, 0)); N.sGamma = Math.max(0, c(f.sGamma.value, 0));
  N.shluky = f.shluky.checked; N.prahShluku = Math.max(1, c(f.prahShluku.value, 60)); N.minShluk = Math.max(2, Math.round(c(f.minShluk.value, 3)));
  N.vMin = Math.max(0.1, c(f.vMin.value, 1.5)); N.vMax = Math.max(N.vMin, c(f.vMax.value, 7.5));
  zmena();
});
$('dlgPlocha').addEventListener('close', async () => {
  const dlg = $('dlgPlocha'), f = dlg.querySelector('form'), pl = plocha();
  if (dlg.returnValue === 'smazat') {
    if (data.plochy.length < 2 || !await Dialog.potvrd(`Smazat plochu „${pl.nazev}“ i s fotkou a stopami?`)) return;
    data.plochy = data.plochy.filter(p => p !== pl); data.stopy = data.stopy.filter(s => s.plocha !== pl.id); delete fotky[pl.id];
    data.aktivni = data.plochy[0].id; vybrana = null; zmena(); return vejdiSe();
  }
  if (dlg.returnValue !== 'ok') return;
  const c = v => Number.isFinite(+v) ? +v : 0;
  pl.nazev = f.nazev.value.trim().slice(0, 40) || pl.nazev; pl.typ = J.TYPY_PLOCH[f.typ.value] ? f.typ.value : 'podlaha';
  pl.natoceni = c(f.natoceni.value); pl.O = [c(f.ox.value), c(f.oy.value), c(f.oz.value)];
  zmena();
});
$('dlgPripad').addEventListener('close', () => {
  if ($('dlgPripad').returnValue !== 'ok') return;
  const f = $('dlgPripad').querySelector('form');
  for (const k of Object.keys(data.pripad)) data.pripad[k] = f[k].value.trim();
  uloz(); tiskniProtokol();
});
addEventListener('message', e => { if (e.data && e.data.tema) setTimeout(() => vykresli(), 50); });

vykresliGalerii();
nacti().then(() => { prepocti(); vykresli(); vejdiSe(); });
window.KREVNI_STOPY_APP = {
  data: () => data, A: () => A, mc: () => mc, fotky: () => fotky, nactiUkazku, nastavNastroj, prepniPlochu, PRIKAZY, prolozBody, klik, dolad,
  svgNakres, nakresPlatno, tiskniProtokol, pohledFoto: () => pohledFoto, set pohled(p) { pohled = p; vykresli(); }, get pohled() { return pohled; }
};
})();
