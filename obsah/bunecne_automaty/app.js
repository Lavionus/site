/* ============================================================
   bunecne_automaty/app.js – uživatelské rozhraní laboratoře.
   Výpočet: Web Worker (worker.js → jadro.js / Motor); když Worker
   nejde spustit (např. file://), běží týž Motor v hlavním vlákně.
   ============================================================ */
(function () {
'use strict';
const J = window.BunecneAutomaty, VZORY = window.BunecneVzory.VZORY, VY = window.BunecneVykres;
const KLIC = 'webapp_bunecne_automaty_';
const $ = id => document.getElementById(id);
const fmt = n => Number(n).toLocaleString('cs-CZ');
const fmtD = (n, d) => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
const RYCHLOSTI = [1, 2, 5, 10, 15, 30, 60, 120, 250, 500, 1000, 3000, 0];
const info = t => { if (typeof Dialog !== 'undefined') Dialog.info(t); };
const chyba = t => { if (typeof Dialog !== 'undefined') Dialog.chyba(t); else console.error(t); };
const potvrd = async t => (typeof Dialog !== 'undefined' ? Dialog.potvrd(t) : true);
const zeptej = async (t, v) => (typeof Dialog !== 'undefined' ? Dialog.zeptej(t, v) : v);
function nacti(k, def) { try { const v = localStorage.getItem(KLIC + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } }
function uloz(k, v) { try { localStorage.setItem(KLIC + k, JSON.stringify(v)); return true; } catch (e) { return false; } }

// ---------------------------------------------------------------- stav
const nast = Object.assign({
  pravidlo: 'B3/S23', okraj: 'torus', rychlostIdx: 5, mrizka: true, historieMB: 64, detekce: true, zastavit: false,
  jen2d: false, hustota: 30, seme: 1, oblast: 'cela', zalozka: 'pravidlo',
}, nacti('nastaveni', {}));
const st = {
  W: 0, H: 0, pravidlo: null, okraj: nast.okraj, bunky: null, gen: 0, radek: 1, bezi: false,
  nastroj: 'kreslit', kreslenyStav: 1, razitko: null, hover: null, posledni: null, cekaNaFit: true, zmeneno: false,
};
try { st.pravidlo = J.parsujPravidlo(nast.pravidlo); } catch (e) { st.pravidlo = J.parsujPravidlo('B3/S23'); }
if (!J.OKRAJE[st.okraj]) st.okraj = 'torus';

// ---------------------------------------------------------------- výpočetní vlákno
let worker = null, motor = null;
function posli(m, prenos) {
  if (worker) worker.postMessage(m, prenos || []);
  else setTimeout(() => motor.zprava(m), 0);
}
function zalozniMotor(duvod) {
  if (worker) { try { worker.terminate(); } catch (e) { /* nic */ } }
  worker = null;
  motor = new J.Motor(m => setTimeout(() => naZpravu(m), 0));
  st.vlakno = 'hlavní vlákno (' + duvod + ')';
}
try {
  worker = new Worker('bunecne_automaty/worker.js');
  worker.onmessage = e => naZpravu(e.data);
  worker.onerror = e => {
    if (e && e.preventDefault) e.preventDefault();
    if (st.workerOk) { chyba('Chyba výpočetního vlákna: ' + (e.message || '')); return; }
    zalozniMotor('Worker nelze spustit');
    posliInit();
  };
  st.vlakno = 'Web Worker';
} catch (e) { zalozniMotor('Worker nelze spustit'); }

// ---------------------------------------------------------------- vykreslování
const obal = $('obal'), vrstva = $('vrstva'), vctx = vrstva.getContext('2d');
let vyk = null;
function vytvorVykreslovac(jen2d) {
  const stare = $('platno'), nove = document.createElement('canvas');
  nove.id = 'platno'; nove.setAttribute('aria-hidden', 'true');
  stare.replaceWith(nove);
  const pohled = vyk ? vyk.pohled : { ox: 0, oy: 0, zoom: 4 };
  vyk = new VY.Vykreslovac(nove, { jen2d });
  vyk.pohled = pohled; vyk.mrizka = nast.mrizka;
  nastavPaletu();
  if (st.bunky) vyk.nastavData(st.bunky, st.W, st.H);
  $('infoVykres').textContent = 'Vykreslování: ' + (vyk.typ === 'webgl' ? 'WebGL (textura ' + vyk.maxTex + ' px max.)' : 'Canvas 2D' + (vyk.duvod ? ' – WebGL nedostupné: ' + vyk.duvod : '')) + ' · výpočet: ' + st.vlakno + '.';
  naplanuj();
}

const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const sondaCtx = document.createElement('canvas').getContext('2d');
function rgb(barva) {
  sondaCtx.fillStyle = '#000'; sondaCtx.fillStyle = barva || '#000';
  const v = sondaCtx.fillStyle;
  if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
  const m = v.match(/[\d.]+/g) || [0, 0, 0];
  return [+m[0], +m[1], +m[2]];
}
const smichej = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t));
function paletaPro(p) {
  const mrtva = rgb(css('--bg-deep')), ziva = rgb(css('--accent'));
  if (p.typ === 'wireworld') return [mrtva, ziva, rgb(css('--danger')), rgb(css('--warn'))];
  const C = J.pocetStavu(p);
  if (C === 2) return [mrtva, ziva];
  const out = [mrtva, ziva], w = rgb(css('--warn'));
  for (let k = 2; k < C; k++) out.push(smichej(w, mrtva, C === 3 ? 0.15 : 0.1 + 0.7 * (k - 2) / (C - 3)));
  return out;
}
function nastavPaletu() {
  if (!vyk) return;
  st.paleta = paletaPro(st.pravidlo);
  vyk.nastavPaletu(st.paleta, rgb(css('--bg')), rgb(css('--border-strong')));
  naplanuj();
}

let naplanovano = false, potvrdit = false;
function naplanuj(ack) {
  if (ack) potvrdit = true;
  if (naplanovano) return;
  naplanovano = true;
  requestAnimationFrame(() => {
    naplanovano = false;
    odesliDavku();
    if (vyk) vyk.kresli();
    kresliVrstvu();
    aktualizujUkazatele();
    if (potvrdit) { potvrdit = false; posli({ typ: 'potvrzeni' }); }
  });
}

function prizpusobVrstvu() {
  const dpr = window.devicePixelRatio || 1, r = vrstva.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (vrstva.width !== w || vrstva.height !== h) { vrstva.width = w; vrstva.height = h; }
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return r;
}
function kresliVrstvu() {
  const r = prizpusobVrstvu(); vctx.clearRect(0, 0, r.width, r.height);
  if (!vyk || !st.W) return;
  const p = vyk.pohled, z = p.zoom;
  const akc = css('--accent');
  // okraj mřížky
  vctx.strokeStyle = css('--border-strong'); vctx.lineWidth = 1;
  vctx.strokeRect(p.ox - 0.5, p.oy - 0.5, st.W * z + 1, st.H * z + 1);
  if (st.pravidlo.typ === 'wolfram') {
    const y = p.oy + st.radek * z;
    vctx.strokeStyle = akc; vctx.lineWidth = 2;
    vctx.beginPath(); vctx.moveTo(p.ox - 8, y); vctx.lineTo(p.ox + st.W * z + 8, y); vctx.stroke();
  }
  const h = st.hover;
  if (!h) return;
  if (st.nastroj === 'vlozit' && st.razitko) {
    const R = st.razitko, x0 = h.x - Math.floor(R.w / 2), y0 = h.y - Math.floor(R.h / 2);
    vctx.globalAlpha = 0.18; vctx.fillStyle = akc;
    vctx.fillRect(p.ox + x0 * z, p.oy + y0 * z, R.w * z, R.h * z);
    vctx.globalAlpha = 0.75;
    for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
      const s = R.data[y * R.w + x]; if (!s) continue;
      const b = st.paleta[Math.min(s, st.paleta.length - 1)];
      vctx.fillStyle = 'rgb(' + b.join(',') + ')';
      vctx.fillRect(p.ox + (x0 + x) * z, p.oy + (y0 + y) * z, Math.max(1, z), Math.max(1, z));
    }
    vctx.globalAlpha = 1;
    vctx.strokeStyle = akc; vctx.lineWidth = 1;
    vctx.strokeRect(p.ox + x0 * z - 0.5, p.oy + y0 * z - 0.5, R.w * z + 1, R.h * z + 1);
  } else if (z >= 3 && st.nastroj !== 'posun') {
    vctx.strokeStyle = akc; vctx.lineWidth = 1.5;
    vctx.strokeRect(p.ox + h.x * z, p.oy + h.y * z, z, z);
  }
}

// ---------------------------------------------------------------- pohled
function rozmerObalu() { const r = obal.getBoundingClientRect(); return { w: r.width, h: r.height }; }
function prizpusob() {
  if (!vyk || !st.W) return;
  const o = rozmerObalu(), z = Math.min(o.w / st.W, o.h / st.H) * 0.96;
  vyk.pohled.zoom = z; vyk.pohled.ox = (o.w - st.W * z) / 2; vyk.pohled.oy = (o.h - st.H * z) / 2;
  naplanuj();
}
function priblizNa(x, y, w, h) {
  const o = rozmerObalu(), z = Math.min(48, Math.min(o.w / w, o.h / h) * 0.9);
  vyk.pohled.zoom = z; vyk.pohled.ox = o.w / 2 - (x + w / 2) * z; vyk.pohled.oy = o.h / 2 - (y + h / 2) * z;
  naplanuj();
}
function zoomKolem(sx, sy, f) {
  const p = vyk.pohled, o = rozmerObalu();
  const zmin = Math.min(1, Math.min(o.w / st.W, o.h / st.H)) * 0.4, zmax = 64;
  const nz = Math.max(zmin, Math.min(zmax, p.zoom * f));
  const cx = (sx - p.ox) / p.zoom, cy = (sy - p.oy) / p.zoom;
  p.zoom = nz; p.ox = sx - cx * nz; p.oy = sy - cy * nz;
  naplanuj();
}
function bunkaZ(e) {
  const r = vrstva.getBoundingClientRect(), p = vyk.pohled;
  const sx = e.clientX - r.left, sy = e.clientY - r.top;
  return { x: Math.floor((sx - p.ox) / p.zoom), y: Math.floor((sy - p.oy) / p.zoom), sx, sy };
}

// ---------------------------------------------------------------- úpravy buněk
let davka = [];
function ziskej(x, y) { return st.bunky && x >= 0 && y >= 0 && x < st.W && y < st.H ? st.bunky[y * st.W + x] : 0; }
function nastavBunku(x, y, s) {
  if (!st.bunky || x < 0 || y < 0 || x >= st.W || y >= st.H) return;
  const i = y * st.W + x; if (st.bunky[i] === s) return;
  st.bunky[i] = s; davka.push(x, y, s); st.zmeneno = true;
  vyk.nastavData(st.bunky, st.W, st.H);
}
function odesliDavku() {
  if (!davka.length) return;
  posli({ typ: 'kresli', body: davka }); davka = [];
}
function cara(x0, y0, x1, y1, s) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, n = 0;
  for (;;) {
    nastavBunku(x0, y0, s);
    if ((x0 === x1 && y0 === y1) || ++n > 20000) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

// ---------------------------------------------------------------- myš a dotyk
const prsty = new Map(); let gesto = null;
vrstva.addEventListener('contextmenu', e => e.preventDefault());
vrstva.addEventListener('pointerdown', e => {
  if (!vyk || !st.W) return;
  if (demo) { ukonciDemo(); e.preventDefault(); return; }
  vrstva.focus({ preventScroll: true });
  try { vrstva.setPointerCapture(e.pointerId); } catch (er) { /* nic */ }
  const r = vrstva.getBoundingClientRect();
  prsty.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
  if (prsty.size === 2) {
    const [a, b] = [...prsty.values()];
    gesto = { typ: 'stisk', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ...vyk.pohled };
    odesliDavku(); return;
  }
  if (prsty.size > 2) return;
  const c = bunkaZ(e);
  if (e.button === 1 || st.nastroj === 'posun' || e.altKey) {
    gesto = { typ: 'posun', sx: e.clientX, sy: e.clientY, ox: vyk.pohled.ox, oy: vyk.pohled.oy };
    obal.classList.add('tahne'); e.preventDefault(); return;
  }
  if (st.nastroj === 'vlozit') {
    if (e.button === 2) { zrusRazitko(); return; }
    if (st.razitko) vlozRazitko(c.x, c.y);
    else info('Nejprve vyberte vzor v záložce Vzory (tlačítko Razítko).');
    return;
  }
  let s;
  if (e.button === 2 || st.nastroj === 'guma') s = 0;
  else { s = st.kreslenyStav; if (ziskej(c.x, c.y) === s) s = 0; }
  gesto = { typ: 'kresli', s, px: c.x, py: c.y };
  nastavBunku(c.x, c.y, s); naplanuj();
});
vrstva.addEventListener('pointermove', e => {
  if (!vyk || !st.W) return;
  const r = vrstva.getBoundingClientRect();
  if (prsty.has(e.pointerId)) prsty.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
  const c = bunkaZ(e);
  st.hover = { x: c.x, y: c.y };
  const s = ziskej(c.x, c.y);
  $('souradnice').textContent = (c.x >= 0 && c.y >= 0 && c.x < st.W && c.y < st.H ? 'x ' + c.x + ', y ' + c.y + ' · stav ' + s : 'mimo mřížku') + ' · ' + fmtD(vyk.pohled.zoom, vyk.pohled.zoom < 1 ? 2 : 1) + ' px/buňka';
  if (gesto && gesto.typ === 'stisk' && prsty.size >= 2) {
    const [a, b] = [...prsty.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const o = rozmerObalu(), zmin = Math.min(1, Math.min(o.w / st.W, o.h / st.H)) * 0.4;
    const z = Math.max(zmin, Math.min(64, gesto.zoom * d / gesto.d0));
    const cx = (gesto.mx - gesto.ox) / gesto.zoom, cy = (gesto.my - gesto.oy) / gesto.zoom;
    vyk.pohled.zoom = z; vyk.pohled.ox = mx - cx * z; vyk.pohled.oy = my - cy * z;
  } else if (gesto && gesto.typ === 'posun') {
    vyk.pohled.ox = gesto.ox + e.clientX - gesto.sx; vyk.pohled.oy = gesto.oy + e.clientY - gesto.sy;
  } else if (gesto && gesto.typ === 'kresli') {
    if (c.x !== gesto.px || c.y !== gesto.py) { cara(gesto.px, gesto.py, c.x, c.y, gesto.s); gesto.px = c.x; gesto.py = c.y; }
  }
  naplanuj();
});
function konecUkazatele(e) {
  prsty.delete(e.pointerId);
  if (gesto && gesto.typ === 'stisk') { if (prsty.size === 0) gesto = null; return; }
  if (gesto && gesto.typ === 'kresli') odesliDavku();
  gesto = null; obal.classList.remove('tahne');
}
vrstva.addEventListener('pointerup', konecUkazatele);
vrstva.addEventListener('pointercancel', konecUkazatele);
vrstva.addEventListener('pointerleave', () => { st.hover = null; $('souradnice').textContent = ''; naplanuj(); });
vrstva.addEventListener('wheel', e => {
  if (!vyk || !st.W) return;
  e.preventDefault();
  const r = vrstva.getBoundingClientRect();
  const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  zoomKolem(e.clientX - r.left, e.clientY - r.top, Math.exp(-d * 0.0018));
}, { passive: false });
$('btnPlus').onclick = () => { const o = rozmerObalu(); zoomKolem(o.w / 2, o.h / 2, 1.5); };
$('btnMinus').onclick = () => { const o = rozmerObalu(); zoomKolem(o.w / 2, o.h / 2, 1 / 1.5); };
$('btnFit').onclick = prizpusob;
if (window.ResizeObserver) new ResizeObserver(() => naplanuj()).observe(obal);

// přetažení souboru na plátno
obal.addEventListener('dragover', e => { e.preventDefault(); });
obal.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) nactiSoubor(f, 'otevrit');
});

// ---------------------------------------------------------------- nástroje
function nastavNastroj(n) {
  st.nastroj = n;
  document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === n)));
  obal.className = 'obal-platna nastroj-' + n;
  aktualizujRazitkoInfo(); naplanuj();
}
document.querySelectorAll('[data-nastroj]').forEach(b => { b.onclick = () => nastavNastroj(b.dataset.nastroj); });
function aktualizujRazitkoInfo() {
  const R = st.razitko;
  $('razitkoInfo').textContent = R ? 'Razítko: ' + R.nazev + ' (' + R.w + ' × ' + R.h + ')' + (st.nastroj === 'vlozit' ? ' – klikněte do mřížky, R otočí, F převrátí' : '') : '';
}
function zrusRazitko() { st.razitko = null; if (st.nastroj === 'vlozit') nastavNastroj('kreslit'); aktualizujRazitkoInfo(); naplanuj(); }
function otocRazitko() {
  const R = st.razitko; if (!R) return;
  const d = new Uint8Array(R.w * R.h);
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) d[x * R.h + (R.h - 1 - y)] = R.data[y * R.w + x];
  st.razitko = { nazev: R.nazev, w: R.h, h: R.w, data: d }; aktualizujRazitkoInfo(); naplanuj();
}
function prevratRazitko() {
  const R = st.razitko; if (!R) return;
  const d = new Uint8Array(R.w * R.h);
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) d[y * R.w + (R.w - 1 - x)] = R.data[y * R.w + x];
  st.razitko = { ...R, data: d }; naplanuj();
}
function vlozRazitko(cx, cy) {
  const R = st.razitko, x0 = cx - Math.floor(R.w / 2), y0 = cy - Math.floor(R.h / 2);
  odesliDavku();
  const C = J.pocetStavu(st.pravidlo);
  for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
    let s = R.data[y * R.w + x]; if (!s) continue;
    if (s >= C) s = C === 2 ? 1 : 0;
    const xx = x0 + x, yy = y0 + y;
    if (xx >= 0 && yy >= 0 && xx < st.W && yy < st.H) st.bunky[yy * st.W + xx] = s;
  }
  vyk.nastavData(st.bunky, st.W, st.H);
  posli({ typ: 'vloz', bunky: R.data, w: R.w, h: R.h, x: x0, y: y0, rezim: 'pridej' });
  st.zmeneno = true; naplanuj();
}

function obnovStavyKresleni() {
  const p = st.pravidlo, C = J.pocetStavu(p), el = $('stavyKresleni');
  el.innerHTML = '';
  if (C === 2) { st.kreslenyStav = 1; return; }
  const jmena = p.typ === 'wireworld' ? ['', 'Hlava', 'Ocas', 'Vodič'] : null;
  if (st.kreslenyStav >= C || st.kreslenyStav < 1) st.kreslenyStav = p.typ === 'wireworld' ? 3 : 1;
  for (let s = 1; s < Math.min(C, 10); s++) {
    const b = document.createElement('button'); b.className = 'male';
    const pal = st.paleta || paletaPro(p);
    b.innerHTML = '<i style="background:rgb(' + pal[s].join(',') + ')"></i>' + (jmena ? jmena[s] : s === 1 ? 'Živá' : 'Stav ' + s);
    b.title = 'Kreslit stav ' + s + ' (klávesa ' + s + ')';
    b.setAttribute('aria-pressed', String(s === st.kreslenyStav));
    b.onclick = () => { st.kreslenyStav = s; obnovStavyKresleni(); if (st.nastroj !== 'kreslit') nastavNastroj('kreslit'); };
    el.appendChild(b);
  }
}

// ---------------------------------------------------------------- zprávy z motoru
function naZpravu(m) {
  if (m.typ === 'chyba') { chyba(m.zprava); return; }
  if (m.typ !== 'snimek') return;
  st.workerOk = true;
  const novaVel = m.sirka !== st.W || m.vyska !== st.H || !st.bunky;
  st.W = m.sirka; st.H = m.vyska; st.bunky = m.bunky; st.gen = m.gen; st.radek = m.radek; st.posledni = m;
  if (st.bezi !== m.bezi) { st.bezi = m.bezi; aktualizujBeh(); }
  if (davka.length) { // neodeslané tahy ještě nejsou ve snímku – dokreslit lokálně
    for (let i = 0; i < davka.length; i += 3) st.bunky[davka[i + 1] * st.W + davka[i]] = davka[i + 2];
  }
  if (vyk && !vyk.podporuje(st.W, st.H)) { info('Mřížka je větší než největší textura WebGL – přepínám na Canvas 2D.'); vytvorVykreslovac(true); }
  if (vyk) vyk.nastavData(st.bunky, st.W, st.H);
  if (novaVel || st.cekaNaFit) {
    st.cekaNaFit = false;
    if (st.cilPohled) { const c = st.cilPohled; st.cilPohled = null; priblizNa(c.x, c.y, c.w, c.h); } else prizpusob();
  }
  naplanuj(true);
}

// ---------------------------------------------------------------- ukazatele a statistiky
let posledniUI = 0, posledniGraf = 0;
function aktualizujUkazatele(vynutit) {
  const m = st.posledni; if (!m) return;
  const t = performance.now();
  $('genText').textContent = fmt(m.gen);
  $('popText').textContent = fmt(m.stat.pop);
  if (!vynutit && st.bezi && t - posledniUI < 120) return;
  posledniUI = t;
  const p = st.pravidlo;
  $('sGen').textContent = fmt(m.gen);
  $('sPop').textContent = fmt(m.stat.pop);
  $('sPopPopis').textContent = p.typ === 'wireworld' ? 'Elektrony (hlavy)' : p.typ === 'wolfram' ? 'Živé v řádku' : J.pocetStavu(p) > 2 ? 'Živé (stav 1)' : 'Živé buňky';
  const plocha = p.typ === 'wolfram' ? m.sirka : m.sirka * m.vyska;
  $('sHust').textContent = fmtD(100 * m.stat.pop / plocha, 2) + ' %';
  $('sNar').textContent = fmt(m.stat.narozene);
  $('sZem').textContent = fmt(m.stat.zemrele);
  $('sRych').textContent = st.bezi && m.rychlost ? fmt(Math.round(m.rychlost)) + ' gen/s' + (m.msNaGen ? ' · ' + fmtD(m.msNaGen, m.msNaGen < 1 ? 3 : 1) + ' ms' : '') : '–';
  $('sPerioda').textContent = textPeriody(m);
  const h = m.historie;
  $('sHist').textContent = h.n ? fmt(h.n) + ' snímků (gen. ' + fmt(h.od) + '–' + fmt(h.do) + '), ' + fmtD(h.bajtu / 1048576, 1) + ' z ' + fmt(Math.round(h.limit / 1048576)) + ' MB' + (h.interval > 1 ? ', ukládá se každá ' + h.interval + '. generace' : '') : '–';
  if (m.stat.pocty) {
    $('boxPocty').hidden = false;
    const jm = p.typ === 'wireworld' ? ['prázdno', 'hlavy', 'ocasy', 'vodiče'] : null;
    $('sPocty').textContent = m.stat.pocty.map((n, s) => (jm ? jm[s] : 'stav ' + s) + ': ' + fmt(n)).slice(jm ? 1 : 0, 12).join(' · ');
  } else $('boxPocty').hidden = true;
  // historie
  const sl = $('historie');
  if (h.n && !st.tahneHistorii) {
    sl.min = h.od; sl.max = Math.max(h.do, m.gen); sl.value = m.gen; sl.disabled = h.do === h.od && m.gen === h.od;
  }
  $('historieText').textContent = h.n ? 'gen. ' + fmt(m.gen) + ' (zpět až ' + fmt(h.od) + ')' : '–';
  $('btnZpet').disabled = !(h.n && m.gen > h.od);
  if (!$('zal-statistiky').hidden && (vynutit || !st.bezi || t - posledniGraf > 250)) { posledniGraf = t; kresliGraf(m.graf); }
}
function textPeriody(m) {
  const p = st.pravidlo;
  if (p.typ === 'wolfram') return 'U jednorozměrných automatů se nesleduje.';
  if (!nast.detekce) return 'Rozpoznávání je vypnuté.';
  if (m.sirka * m.vyska > 1048576) return 'Rozpoznává se jen u mřížek do 1 048 576 buněk.';
  const q = m.perioda;
  if (!q) return 'Zatím se neopakuje.';
  if (q.prazdno) return 'Vše vymřelo (od generace ' + fmt(q.odGen) + ').';
  if (q.dx || q.dy) return 'Posun o (' + q.dx + ', ' + q.dy + ') za ' + q.p + ' gen. – vesmírná loď (od gen. ' + fmt(q.odGen) + ').';
  if (q.p === 1) return 'Zátiší – nic se nemění (od generace ' + fmt(q.odGen) + ').';
  return 'Oscilátor s periodou ' + q.p + ' (od generace ' + fmt(q.odGen) + ').';
}
function kresliGraf(g) {
  const c = $('graf'), dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
  if (!r.width) return;
  c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, l = 46, pr = 8, t = 10, b = 22;
  ctx.clearRect(0, 0, W, H);
  if (!g || !g.max.length) return;
  let mx = 0; for (const v of g.max) if (v > mx) mx = v;
  mx = Math.max(1, mx);
  ctx.font = '11px ' + (css('--font') || 'sans-serif');
  ctx.fillStyle = css('--text-muted'); ctx.strokeStyle = css('--border');
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = t + (H - t - b) * i / 4;
    ctx.beginPath(); ctx.moveTo(l, Math.round(y) + 0.5); ctx.lineTo(W - pr, Math.round(y) + 0.5); ctx.stroke();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmt(Math.round(mx * (1 - i / 4))), l - 5, y);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('gen. ' + fmt(g.od), l, H - 6);
  ctx.textAlign = 'right'; ctx.fillText(fmt(g.do), W - pr, H - 6);
  const n = g.max.length, sx = i => l + (W - l - pr) * (n === 1 ? 1 : i / (n - 1)), sy = v => t + (H - t - b) * (1 - v / mx);
  ctx.fillStyle = css('--accent-soft');
  ctx.beginPath(); let zac = true;
  for (let i = 0; i < n; i++) { if (isNaN(g.max[i])) continue; if (zac) { ctx.moveTo(sx(i), sy(g.max[i])); zac = false; } else ctx.lineTo(sx(i), sy(g.max[i])); }
  for (let i = n - 1; i >= 0; i--) { if (!isNaN(g.min[i])) ctx.lineTo(sx(i), sy(g.min[i])); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = css('--accent'); ctx.lineWidth = 1.5; ctx.beginPath(); zac = true;
  for (let i = 0; i < n; i++) { if (isNaN(g.max[i])) continue; const v = (g.max[i] + g.min[i]) / 2; if (zac) { ctx.moveTo(sx(i), sy(v)); zac = false; } else ctx.lineTo(sx(i), sy(v)); }
  ctx.stroke();
}

// ---------------------------------------------------------------- běh
function aktualizujBeh() {
  const b = $('btnBeh');
  b.textContent = st.bezi ? '⏸ Pauza' : '▶ Spustit';
  b.setAttribute('aria-pressed', String(st.bezi));
  if (!st.bezi) ulozStav();
}
function spust() { st.bezi = true; aktualizujBeh(); posli({ typ: 'start', rychlost: RYCHLOSTI[nast.rychlostIdx] }); }
function zastav() { if (st.bezi) { st.bezi = false; aktualizujBeh(); } posli({ typ: 'stop' }); }
$('btnBeh').onclick = () => (st.bezi ? zastav() : spust());
$('btnKrok').onclick = () => { st.bezi = false; aktualizujBeh(); posli({ typ: 'krok', n: 1 }); };
$('btnKrok10').onclick = () => { st.bezi = false; aktualizujBeh(); posli({ typ: 'krok', n: 10 }); };
$('btnZpet').onclick = () => { st.bezi = false; aktualizujBeh(); posli({ typ: 'zpet', n: 1 }); };
function textRychlosti() { const r = RYCHLOSTI[nast.rychlostIdx]; return r ? fmt(r) + ' gen/s' : 'maximum'; }
$('rychlost').value = nast.rychlostIdx; $('rychlostText').textContent = textRychlosti();
$('rychlost').oninput = () => {
  nast.rychlostIdx = +$('rychlost').value; $('rychlostText').textContent = textRychlosti();
  posli({ typ: 'rychlost', rychlost: RYCHLOSTI[nast.rychlostIdx] }); ulozNastaveni();
};
let skokCekajici = null;
$('historie').addEventListener('input', () => {
  st.tahneHistorii = true;
  const g = +$('historie').value;
  if (st.bezi) { st.bezi = false; aktualizujBeh(); }
  if (skokCekajici === null) requestAnimationFrame(() => { posli({ typ: 'skoc', gen: skokCekajici }); skokCekajici = null; });
  skokCekajici = g;
});
$('historie').addEventListener('change', () => { st.tahneHistorii = false; });

// ---------------------------------------------------------------- pravidla
const selPr = $('selPravidlo');
J.ZNAMA_PRAVIDLA.forEach((r, i) => { const o = document.createElement('option'); o.value = r.zapis; o.textContent = r.nazev + ' – ' + r.zapis; selPr.appendChild(o); });
{ const o = document.createElement('option'); o.value = ''; o.textContent = 'Vlastní pravidlo…'; selPr.appendChild(o); }
selPr.onchange = () => { if (selPr.value) pouzijPravidlo(selPr.value); else $('txtPravidlo').focus(); };
$('btnPravidlo').onclick = () => pouzijPravidlo($('txtPravidlo').value);
$('txtPravidlo').addEventListener('keydown', e => { if (e.key === 'Enter') pouzijPravidlo($('txtPravidlo').value); });

for (const [id, pis] of [['bsB', 'B'], ['bsS', 'S']]) {
  for (let n = 0; n <= 8; n++) {
    const b = document.createElement('button'); b.textContent = n; b.dataset.n = n; b.dataset.co = pis;
    b.title = (pis === 'B' ? 'Zrod při ' : 'Přežití při ') + n + ' sousedech';
    b.onclick = () => {
      const p = st.pravidlo; if (p.typ !== 'life') return;
      const q = { ...p, narozeni: p.narozeni.slice(), preziti: p.preziti.slice() };
      const pole = pis === 'B' ? q.narozeni : q.preziti; pole[n] = !pole[n];
      pouzijPravidlo(J.formatujPravidlo(q));
    };
    $(id).appendChild(b);
  }
}
$('selOkoli').onchange = () => {
  const p = st.pravidlo; if (p.typ !== 'life') return;
  const q = { ...p, okoli: $('selOkoli').value };
  if (q.okoli === 'V') { q.narozeni = p.narozeni.map((v, i) => v && i <= 4); q.preziti = p.preziti.map((v, i) => v && i <= 4); }
  pouzijPravidlo(J.formatujPravidlo(q));
};
$('numStavy').onchange = () => {
  const p = st.pravidlo; if (p.typ !== 'life') return;
  const c = Math.round(+$('numStavy').value);
  if (!(c >= 2 && c <= 256)) { $('numStavy').classList.add('chyba'); return; }
  $('numStavy').classList.remove('chyba');
  pouzijPravidlo(J.formatujPravidlo({ ...p, stavy: c }));
};
// Wolfram
const wolfTab = $('wolfTab');
for (let k = 7; k >= 0; k--) {
  const b = document.createElement('button'); b.dataset.bit = k;
  b.innerHTML = '<span class="vzor3">' + [4, 2, 1].map(m => '<i class="' + (k & m ? 'z' : '') + '"></i>').join('') + '</span><span class="vysl"></span>';
  b.title = 'Kombinace ' + k.toString(2).padStart(3, '0') + ' – kliknutím přepnout výsledek';
  b.onclick = () => { const p = st.pravidlo; if (p.typ === 'wolfram') pouzijPravidlo('W' + (p.cislo ^ (1 << k))); };
  wolfTab.appendChild(b);
}
$('numWolfram').onchange = () => {
  const n = Math.round(+$('numWolfram').value);
  if (!(n >= 0 && n <= 255)) { $('numWolfram').classList.add('chyba'); return; }
  $('numWolfram').classList.remove('chyba'); pouzijPravidlo('W' + n);
};
document.querySelectorAll('[data-wolf]').forEach(b => { b.onclick = () => pouzijPravidlo('W' + b.dataset.wolf); });

function vyjmenuj(pole) {
  const c = []; pole.forEach((v, i) => { if (v) c.push(i); });
  if (!c.length) return null;
  return c.length === 1 ? String(c[0]) : c.slice(0, -1).join(', ') + ' nebo ' + c[c.length - 1];
}
function obnovPravidloUI() {
  const p = st.pravidlo, z = J.formatujPravidlo(p);
  $('txtPravidlo').value = z; $('pravidloChyba').textContent = '';
  $('pravidloStitek').textContent = z;
  selPr.value = J.ZNAMA_PRAVIDLA.some(r => r.zapis === z) ? z : '';
  $('lifeEditor').hidden = p.typ !== 'life';
  $('wolfEditor').hidden = p.typ !== 'wolfram';
  $('btnJedna').hidden = p.typ !== 'wolfram';
  const znamy = J.ZNAMA_PRAVIDLA.find(r => r.zapis === z);
  let html = '<b>' + J.nazevPravidla(p) + '</b> · <code>' + z + '</code>';
  if (znamy) html += '<br>' + znamy.popis;
  if (p.typ === 'life') {
    document.querySelectorAll('#bsB button').forEach(b => { b.setAttribute('aria-pressed', String(p.narozeni[+b.dataset.n])); b.disabled = p.okoli === 'V' && +b.dataset.n > 4; });
    document.querySelectorAll('#bsS button').forEach(b => { b.setAttribute('aria-pressed', String(p.preziti[+b.dataset.n])); b.disabled = p.okoli === 'V' && +b.dataset.n > 4; });
    $('selOkoli').value = p.okoli; $('numStavy').value = p.stavy;
    const b = vyjmenuj(p.narozeni), s = vyjmenuj(p.preziti);
    html += '<br>Mrtvá buňka ožije ' + (b ? 'při ' + b + ' živých sousedech' : 'nikdy') + '; živá přežije ' + (s ? 'při ' + s : 'nikdy') + '.';
    if (p.stavy > 2) html += ' Nepřeživší buňka umírá přes ' + (p.stavy - 2) + ' mezistav' + (p.stavy - 2 === 1 ? '' : p.stavy - 2 < 5 ? 'y' : 'ů') + '.';
    if (p.narozeni[0]) html += '<br><span style="color:var(--warn)">Pravidlo B0: prázdné okolí rodí buňky – celá plocha bliká.</span>';
  } else if (p.typ === 'wolfram') {
    $('numWolfram').value = p.cislo;
    wolfTab.querySelectorAll('button').forEach(b => b.querySelector('.vysl').className = 'vysl' + ((p.cislo >> +b.dataset.bit) & 1 ? ' z' : ''));
    html += '<br>' + p.cislo + ' = ' + p.cislo.toString(2).padStart(8, '0') + '₂ (bity pro sousedství 111 … 000).';
  } else {
    html += '<br>Stavy: prázdno · hlava elektronu → ocas → vodič; vodič se stane hlavou, sousedí-li s 1 nebo 2 hlavami.';
  }
  $('pravidloPopis').innerHTML = html;
  $('rleInfo').textContent = J.jeDvoustavove(p)
    ? 'RLE v zápisu b/o kompatibilní s Golly, LifeWiki i dalšími programy (ořezané na živé buňky).'
    : 'Vícestavové pravidlo: RLE se zapíše v rozšířeném formátu Golly (. a A–X); jiné programy jej nemusí načíst.';
  obnovStavyKresleni();
  if ($('chkJenPravidlo').checked) vykresliVzory();
}
/** Nastaví pravidlo. Vrací true, když se podařilo. */
function pouzijPravidlo(text, tise) {
  let p;
  try { p = J.parsujPravidlo(String(text)); }
  catch (e) { $('pravidloChyba').textContent = e.message; $('txtPravidlo').classList.add('chyba'); if (tise) chyba(e.message); return false; }
  $('txtPravidlo').classList.remove('chyba');
  const bylW = st.pravidlo.typ === 'wolfram', jeW = p.typ === 'wolfram';
  st.pravidlo = p; nast.pravidlo = J.formatujPravidlo(p);
  posli({ typ: 'pravidlo', pravidlo: p });
  if (jeW && !bylW && !tise) { posli({ typ: 'jednaBunka' }); info('Elementární automat: jedna živá buňka uprostřed prvního řádku.'); }
  else if (!jeW && bylW && !tise) info('Mřížka byla vyčištěna – nakreslete buňky nebo zvolte Náhodně vyplnit.');
  nastavPaletu(); obnovPravidloUI(); ulozNastaveni();
  return true;
}

// ---------------------------------------------------------------- mřížka
const selOkraj = $('selOkraj');
for (const [k, v] of Object.entries(J.OKRAJE)) { const o = document.createElement('option'); o.value = k; o.textContent = v; selOkraj.appendChild(o); }
selOkraj.value = st.okraj;
selOkraj.onchange = () => { st.okraj = nast.okraj = selOkraj.value; posli({ typ: 'okraj', okraj: st.okraj }); ulozNastaveni(); };
$('selVelikost').onchange = () => {
  const v = $('selVelikost').value; if (!v) return;
  const [w, h] = v.split('×').map(Number); $('numSirka').value = w; $('numVyska').value = h; $('selVelikost').value = '';
};
$('btnVelikost').onclick = async () => {
  const w = Math.round(+$('numSirka').value), h = Math.round(+$('numVyska').value);
  if (!(w >= 3 && h >= 3 && w <= J.MAX_STRANA && h <= J.MAX_STRANA) || w * h > J.MAX_BUNEK) {
    chyba('Rozměr musí být 3–' + J.MAX_STRANA + ' buněk na stranu a nejvýše ' + fmt(J.MAX_BUNEK) + ' buněk celkem.'); return;
  }
  if (w * h > 4194304 && !(await potvrd('Mřížka ' + fmt(w) + ' × ' + fmt(h) + ' zabere asi ' + fmt(Math.round(w * h * 4 / 1048576)) + ' MB paměti a výpočet bude pomalejší. Pokračovat?'))) return;
  posli({ typ: 'velikost', sirka: w, vyska: h }); st.cekaNaFit = true;
};
$('numHustota').value = nast.hustota; $('numSeme').value = nast.seme; $('selOblast').value = nast.oblast;
function oblastNahody() {
  if ($('selOblast').value !== 'stred') return null;
  const w = Math.max(1, Math.round(st.W / 3)), h = Math.max(1, Math.round(st.H / 3));
  return { x: Math.floor((st.W - w) / 2), y: Math.floor((st.H - h) / 2), w, h };
}
$('btnNahodne').onclick = () => {
  const hu = Math.min(100, Math.max(1, +$('numHustota').value || 30)), se = Math.max(0, Math.floor(+$('numSeme').value || 0)) >>> 0;
  nast.hustota = hu; nast.seme = se; nast.oblast = $('selOblast').value; ulozNastaveni();
  posli({ typ: 'nahodne', hustota: hu / 100, seme: se, oblast: oblastNahody() });
};
$('btnNoveSeme').onclick = () => { $('numSeme').value = Math.floor(Math.random() * 4294967295); $('btnNahodne').click(); };
$('btnJedna').onclick = () => posli({ typ: 'jednaBunka' });
$('btnVycistit').onclick = () => posli({ typ: 'vycisti' });
$('selHistorie').value = String(nast.historieMB);
$('selHistorie').onchange = () => { nast.historieMB = +$('selHistorie').value; posli({ typ: 'historie', mb: nast.historieMB }); ulozNastaveni(); };
$('chkDetekce').checked = nast.detekce; $('chkZastavit').checked = nast.zastavit;
function posliDetekci() { posli({ typ: 'detekce', zap: nast.detekce, zastavit: nast.zastavit }); }
$('chkDetekce').onchange = () => { nast.detekce = $('chkDetekce').checked; posliDetekci(); ulozNastaveni(); aktualizujUkazatele(true); };
$('chkZastavit').onchange = () => { nast.zastavit = $('chkZastavit').checked; posliDetekci(); ulozNastaveni(); };
$('chk2d').checked = nast.jen2d;
$('chk2d').onchange = () => { nast.jen2d = $('chk2d').checked; vytvorVykreslovac(nast.jen2d); ulozNastaveni(); };
$('chkMrizka').checked = nast.mrizka;
$('chkMrizka').onchange = () => { nast.mrizka = $('chkMrizka').checked; vyk.mrizka = nast.mrizka; naplanuj(); ulozNastaveni(); };

// ---------------------------------------------------------------- otevírání vzorů
/** Otevře obraz w×h: nastaví pravidlo, případně zvětší mřížku a vzor umístí doprostřed. */
function otevriObraz(o) {
  if (o.pravidlo) {
    let p = null;
    try { p = J.parsujPravidlo(o.pravidlo); } catch (e) { info('Pravidlo „' + o.pravidlo + '“ neznám – ponechávám ' + J.formatujPravidlo(st.pravidlo) + '.'); }
    if (p && J.formatujPravidlo(p) !== J.formatujPravidlo(st.pravidlo)) pouzijPravidlo(J.formatujPravidlo(p), true);
  }
  if (o.okraj && J.OKRAJE[o.okraj]) { st.okraj = nast.okraj = o.okraj; selOkraj.value = o.okraj; }
  let W = st.W, H = st.H;
  if (o.cela) { W = o.sirka; H = o.vyska; }
  else {
    const okrajB = Math.max(8, Math.round(Math.max(o.sirka, o.vyska) * 0.25));
    if (o.sirka + 2 * okrajB > W || o.vyska + 2 * okrajB > H) {
      W = Math.min(J.MAX_STRANA, Math.max(W, o.sirka + 2 * okrajB)); H = Math.min(J.MAX_STRANA, Math.max(H, o.vyska + 2 * okrajB));
      if (W * H > J.MAX_BUNEK) { chyba('Vzor je pro laboratoř příliš velký.'); return; }
      info('Mřížka zvětšena na ' + W + ' × ' + H + ', aby se vzor vešel.');
    }
  }
  const data = new Uint8Array(W * H), x0 = o.cela ? 0 : Math.floor((W - o.sirka) / 2), y0 = o.cela ? 0 : Math.floor((H - o.vyska) / 2);
  const C = J.pocetStavu(st.pravidlo);
  for (let y = 0; y < o.vyska; y++) for (let x = 0; x < o.sirka; x++) {
    let s = o.bunky[y * o.sirka + x]; if (s >= C) s = C === 2 ? 1 : 0;
    if (x0 + x < W && y0 + y < H) data[(y0 + y) * W + x0 + x] = s;
  }
  posli({ typ: 'nahraj', bunky: data, sirka: W, vyska: H, pravidlo: st.pravidlo, okraj: st.okraj, gen: o.gen || 0, radek: o.radek || (st.pravidlo.typ === 'wolfram' ? y0 + o.vyska : 0) }, [data.buffer]);
  st.cekaNaFit = true;
  st.cilPohled = o.cela ? null : (() => { const m = Math.max(o.sirka, o.vyska, 24) * 0.6; return { x: x0 - m, y: y0 - m, w: o.sirka + 2 * m, h: o.vyska + 2 * m }; })();
  if (o.cela || (st.cilPohled.w >= W && st.cilPohled.h >= H)) st.cilPohled = null;
  if (st.bezi) zastav();
  ulozNastaveni();
}
async function vzorJakoRazitko(o, nazev) {
  if (o.pravidlo) {
    try {
      const p = J.parsujPravidlo(o.pravidlo);
      if (J.formatujPravidlo(p) !== J.formatujPravidlo(st.pravidlo) && await potvrd('Vzor „' + nazev + '“ je pro pravidlo ' + J.formatujPravidlo(p) + ' (' + J.nazevPravidla(p) + '). Přepnout pravidlo?'))
        pouzijPravidlo(J.formatujPravidlo(p), true);
    } catch (e) { /* neznámé pravidlo – razítko i tak */ }
  }
  st.razitko = { nazev, w: o.sirka, h: o.vyska, data: o.bunky };
  nastavNastroj('vlozit');
  info('Razítko připraveno – klikněte do mřížky. R otočí, F převrátí, Esc zruší.');
}

// ---------------------------------------------------------------- knihovna vzorů
const kategorie = [...new Set(VZORY.map(v => v.kat))];
kategorie.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; $('selKat').appendChild(o); });
const vzorCache = new Map();
function rozparsuj(v) { if (!vzorCache.has(v.rle)) vzorCache.set(v.rle, J.parsujRLE(v.rle)); return vzorCache.get(v.rle); }
function nahledVzoru(o, pravidlo) {
  const c = document.createElement('canvas'), dpr = window.devicePixelRatio || 1;
  c.width = Math.round(64 * dpr); c.height = Math.round(64 * dpr);
  let p; try { p = J.parsujPravidlo(pravidlo || 'B3/S23'); } catch (e) { p = st.pravidlo; }
  const m = Math.max(1, Math.floor(c.width / Math.max(o.sirka, o.vyska, 1)));
  const src = VY.obrazNaPlatno(o.bunky, o.sirka, o.vyska, paletaPro(p), Math.min(m, 12 * dpr | 0), false);
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = m < 1;
  const k = Math.min(c.width / src.width, c.height / src.height, 1);
  ctx.fillStyle = 'rgb(' + rgb(css('--bg-deep')).join(',') + ')'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, (c.width - src.width * k) / 2, (c.height - src.height * k) / 2, src.width * k, src.height * k);
  return c;
}
function polozkaVzoru(nazev, meta, o, pravidlo, akce) {
  const d = document.createElement('div'); d.className = 'vzor';
  d.appendChild(nahledVzoru(o, pravidlo));
  const t = document.createElement('div'); t.style.minWidth = '0';
  t.innerHTML = '<div class="jm"></div><div class="meta"></div><div class="tlacitka"></div>';
  t.querySelector('.jm').textContent = nazev;
  t.querySelector('.meta').innerHTML = meta;
  for (const [txt, fn, cls] of akce) { const b = document.createElement('button'); b.className = 'male' + (cls ? ' ' + cls : ''); b.textContent = txt; b.onclick = fn; t.querySelector('.tlacitka').appendChild(b); }
  d.appendChild(t);
  return d;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function vykresliVzory() {
  const el = $('vzorySeznam'); el.innerHTML = '';
  const q = $('hledatVzor').value.trim().toLowerCase(), kat = $('selKat').value, jen = $('chkJenPravidlo').checked;
  const akt = J.formatujPravidlo(st.pravidlo);
  let posledniKat = null, n = 0;
  for (const v of VZORY) {
    if (kat && v.kat !== kat) continue;
    if (jen && J.formatujPravidlo(J.parsujPravidlo(v.pravidlo)) !== akt) continue;
    if (q && !(v.nazev + ' ' + v.popis + ' ' + v.puvod + ' ' + v.kat).toLowerCase().includes(q)) continue;
    if (v.kat !== posledniKat) { const h = document.createElement('div'); h.className = 'kat-nadpis'; h.textContent = v.kat; el.appendChild(h); posledniKat = v.kat; }
    const o = rozparsuj(v);
    el.appendChild(polozkaVzoru(v.nazev,
      esc(v.popis) + '<br>' + esc(v.puvod) + ' · <code>' + esc(v.pravidlo) + '</code> · ' + o.sirka + ' × ' + o.vyska,
      o, v.pravidlo, [
        ['Otevřít', () => otevriObraz({ ...o, pravidlo: v.pravidlo }), 'hlavni'],
        ['Razítko', () => vzorJakoRazitko({ ...o, pravidlo: v.pravidlo }, v.nazev)],
      ]));
    n++;
  }
  if (!n) el.innerHTML = '<p class="napoveda">Žádný vzor neodpovídá filtru.</p>';
}
$('hledatVzor').oninput = vykresliVzory; $('selKat').onchange = vykresliVzory; $('chkJenPravidlo').onchange = vykresliVzory;

function mojeVzory() { const v = nacti('moje', []); return Array.isArray(v) ? v : []; }
function vykresliMoje() {
  const el = $('mojeVzory'); el.innerHTML = '';
  const seznam = mojeVzory();
  if (!seznam.length) { el.innerHTML = '<p class="napoveda">Zatím nic. Uložené vzory zůstanou v tomto prohlížeči.</p>'; return; }
  seznam.forEach((v, i) => {
    let o; try { o = J.parsujRLE(v.rle); } catch (e) { return; }
    el.appendChild(polozkaVzoru(v.nazev, '<code>' + esc(v.pravidlo || '') + '</code> · ' + o.sirka + ' × ' + o.vyska + (v.datum ? ' · ' + esc(v.datum) : ''), o, v.pravidlo, [
      ['Otevřít', () => otevriObraz({ ...o, pravidlo: v.pravidlo }), 'hlavni'],
      ['Razítko', () => vzorJakoRazitko({ ...o, pravidlo: v.pravidlo }, v.nazev)],
      ['Smazat', async () => { if (await potvrd('Smazat vzor „' + v.nazev + '“?')) { const s = mojeVzory(); s.splice(i, 1); uloz('moje', s); vykresliMoje(); } }],
    ]));
  });
}
$('btnUlozVzor').onclick = async () => {
  if (!st.bunky) return;
  const r = J.zapisRLE(st.bunky, st.W, st.H, { pravidlo: J.formatujPravidlo(st.pravidlo), stavy: J.pocetStavu(st.pravidlo) });
  if (!r.sirka) { info('Mřížka je prázdná.'); return; }
  if (r.text.length > 400000) { chyba('Obsah je na uložení do prohlížeče příliš velký – použijte export RLE.'); return; }
  const nazev = await zeptej('Název vzoru', 'Můj vzor ' + (mojeVzory().length + 1));
  if (!nazev) return;
  const s = mojeVzory(); s.unshift({ nazev: nazev.slice(0, 80), pravidlo: J.formatujPravidlo(st.pravidlo), rle: r.text, datum: new Date().toLocaleDateString('cs-CZ') });
  if (!uloz('moje', s.slice(0, 200))) { chyba('Uložení selhalo – úložiště prohlížeče je plné nebo zakázané.'); return; }
  vykresliMoje(); info('Vzor uložen.');
};

// ---------------------------------------------------------------- import / export
function zpracujText(text, rezim, jmeno) {
  $('importChyba').textContent = '';
  let o;
  try { o = J.parsujVzor(text); } catch (e) { $('importChyba').textContent = e.message; chyba(e.message); return; }
  if (!o.sirka || !o.vyska) { $('importChyba').textContent = 'Vzor neobsahuje žádné buňky.'; return; }
  for (const v of o.varovani || []) info(v);
  const nazev = o.nazev || jmeno || 'importovaný vzor';
  if (rezim === 'razitko') { vzorJakoRazitko(o, nazev); return; }
  if (o.json) {
    pouzijPravidlo(o.pravidlo, true);
    otevriObraz({ ...o, cela: true });
    info('Načten stav „' + nazev + '“ (generace ' + fmt(o.gen) + ').');
  } else {
    otevriObraz(o);
    info('Načten vzor „' + nazev + '“ (' + o.sirka + ' × ' + o.vyska + (o.autor ? ', ' + o.autor : '') + ').');
  }
}
function nactiSoubor(f, rezim) {
  if (f.size > 64 * 1048576) { chyba('Soubor je příliš velký (max. 64 MB).'); return; }
  const r = new FileReader();
  r.onload = () => zpracujText(String(r.result), rezim, f.name.replace(/\.[^.]+$/, ''));
  r.onerror = () => chyba('Soubor se nepodařilo přečíst.');
  r.readAsText(f);
}
$('souborVstup').onchange = () => { const f = $('souborVstup').files[0]; if (f) nactiSoubor(f, 'otevrit'); $('souborVstup').value = ''; };
$('btnImportOtevrit').onclick = () => zpracujText($('txtImport').value, 'otevrit');
$('btnImportRazitko').onclick = () => zpracujText($('txtImport').value, 'razitko');

function stahni(blob, jmeno) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function rleText() {
  const zakl = { pravidlo: J.formatujPravidlo(st.pravidlo), stavy: J.pocetStavu(st.pravidlo) };
  const r0 = J.zapisRLE(st.bunky, st.W, st.H, zakl);
  return J.zapisRLE(st.bunky, st.W, st.H, Object.assign(zakl, {
    komentare: ['Laboratoř buněčných automatů – generace ' + st.gen + ', mřížka ' + st.W + ' × ' + st.H + ', okraj: ' + J.OKRAJE[st.okraj],
      'Levý horní roh výřezu v mřížce: x = ' + r0.x0 + ', y = ' + r0.y0],
  }));
}
const nazevSouboru = pr => 'automat_' + J.formatujPravidlo(st.pravidlo).replace(/[^A-Za-z0-9]+/g, '') + '_gen' + st.gen + pr;
$('btnExpRLE').onclick = () => {
  if (!st.bunky) return;
  const r = rleText(); $('txtExport').value = r.text;
  if (!r.sirka) { info('Mřížka je prázdná – RLE obsahuje jen hlavičku.'); }
  stahni(new Blob([r.text], { type: 'text/plain' }), nazevSouboru('.rle'));
};
$('btnKopRLE').onclick = async () => {
  if (!st.bunky) return;
  const r = rleText(); $('txtExport').value = r.text;
  try { await navigator.clipboard.writeText(r.text); info('RLE zkopírováno do schránky.'); }
  catch (e) { $('txtExport').select(); info('Schránka není dostupná – RLE je označené v poli Náhled, zkopírujte ho ručně.'); }
};
$('btnExpJSON').onclick = () => {
  if (!st.bunky) return;
  const t = J.zapisJSON({ sirka: st.W, vyska: st.H, bunky: st.bunky, pravidlo: st.pravidlo, okraj: st.okraj, gen: st.gen, radek: st.radek });
  stahni(new Blob([t], { type: 'application/json' }), nazevSouboru('.json'));
};
$('btnExpPNG').onclick = () => {
  if (!st.bunky) return;
  let m = +$('selPngMeritko').value;
  while (m > 1 && (st.W * m > 16384 || st.H * m > 16384 || st.W * st.H * m * m > 120e6)) m = Math.floor(m / 2);
  if (m !== +$('selPngMeritko').value) info('Měřítko PNG sníženo na ' + m + ' px/buňku (omezení velikosti obrázku).');
  const c = VY.obrazNaPlatno(st.bunky, st.W, st.H, st.paleta, m, $('chkPngMrizka').checked, rgb(css('--border-strong')));
  c.toBlob(b => { if (b) stahni(b, nazevSouboru('.png')); else chyba('PNG se nepodařilo vytvořit.'); }, 'image/png');
};

// ---------------------------------------------------------------- záložky
function prepniZalozku(z) {
  document.querySelectorAll('.zalozky button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.zal === z)));
  document.querySelectorAll('.zalozka').forEach(p => { p.hidden = p.id !== 'zal-' + z; });
  nast.zalozka = z; ulozNastaveni();
  if (z === 'statistiky') aktualizujUkazatele(true);
  if (z === 'soubor' && st.bunky && st.W * st.H <= 1048576) $('txtExport').value = rleText().text;
}
document.querySelectorAll('.zalozky button').forEach(b => { b.onclick = () => prepniZalozku(b.dataset.zal); });

// ---------------------------------------------------------------- klávesnice
document.addEventListener('keydown', e => {
  const t = e.target, vPoli = t && (t.tagName === 'INPUT' && !['range', 'checkbox', 'button'].includes(t.type) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
  if (e.code === 'Escape') { if (demo) ukonciDemo(); else if (st.razitko) zrusRazitko(); return; }
  if (vPoli || e.ctrlKey || e.metaKey || e.altKey) return;
  if (t && t.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) return;
  const c = e.code;
  if (c === 'Space') { e.preventDefault(); st.bezi ? zastav() : spust(); }
  else if (c === 'KeyN' || c === 'ArrowRight') { e.preventDefault(); $('btnKrok').click(); }
  else if (c === 'ArrowLeft') { e.preventDefault(); $('btnZpet').click(); }
  else if (c === 'KeyR') otocRazitko();
  else if (c === 'KeyF') prevratRazitko();
  else if (c === 'KeyH') prizpusob();
  else if (c === 'KeyG') { $('chkMrizka').click(); }
  else if (c === 'KeyB') nastavNastroj('kreslit');
  else if (c === 'KeyE') nastavNastroj('guma');
  else if (c === 'KeyM') nastavNastroj('posun');
  else if (c === 'KeyV') nastavNastroj('vlozit');
  else if (/^(Digit|Numpad)\d$/.test(c)) {
    const s = +c.slice(-1), C = J.pocetStavu(st.pravidlo);
    if (s === 0) nastavNastroj('guma');
    else if (s < C) { st.kreslenyStav = s; obnovStavyKresleni(); nastavNastroj('kreslit'); }
  }
});

// ---------------------------------------------------------------- ukázky
function obrazZVzoru(W, H, polozky) {
  const d = new Uint8Array(W * H);
  for (const [id, x, y, rot] of polozky) {
    const v = VZORY.find(q => q.id === id); let o = rozparsuj(v);
    let w = o.sirka, h = o.vyska, b = o.bunky;
    if (rot === 'zrcadlo') { const n = new Uint8Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) n[j * w + w - 1 - i] = b[j * w + i]; b = n; }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (b[j * w + i] && x + i < W && y + j < H) d[(y + j) * W + x + i] = b[j * w + i];
  }
  return d;
}
function scena(pravidlo, W, H, okraj, data, extra) {
  pouzijPravidlo(pravidlo, true);
  st.okraj = okraj; selOkraj.value = okraj;
  posli({ typ: 'nahraj', bunky: data, sirka: W, vyska: H, pravidlo: st.pravidlo, okraj, gen: 0, radek: extra && extra.radek }, [data.buffer]);
  st.cekaNaFit = true; st.cilPohled = null;
}
function wolframRadek(W, H, xs) { const d = new Uint8Array(W * H); for (const x of xs) d[x] = 1; return d; }
const SCENY = [
  { nazev: 'Zátiší a oscilátory', rychlost: 4, delka: 16000,
    text: '<b>Zátiší a oscilátory.</b> Nahoře zátiší (blok, úl, bochník, loďka, požírač) – každá buňka má přesně tolik sousedů, aby se nic neměnilo. Dole oscilátory s periodou 2 (blinkr, ropucha, maják), 3 (pulsar), 8 (osmička, Kokova galaxie) a 15 (pentadekatlon).',
    priprav: () => scena('B3/S23', 112, 56, 'torus', obrazZVzoru(112, 56, [['blok', 8, 6], ['ul', 20, 5], ['bochnik', 34, 5], ['lodka', 48, 5], ['pozirac', 60, 4],
      ['blinkr', 6, 30], ['ropucha', 16, 30], ['majak', 28, 29], ['pulsar', 40, 24], ['osmicka', 60, 27], ['pentadekatlon', 74, 29], ['kok', 92, 26]])) },
  { nazev: 'Vesmírné lodě', rychlost: 15, delka: 16000,
    text: '<b>Vesmírné lodě.</b> Kluzák (R. K. Guy, 1970) se každé 4 generace posune o jednu buňku úhlopříčně; lehká, střední a těžká loď letí vodorovně rychlostí c/2. Na toroidu vyletí jedním okrajem a vrátí se druhým.',
    priprav: () => scena('B3/S23', 160, 90, 'torus', obrazZVzoru(160, 90, [['lwss', 120, 10], ['mwss', 130, 24], ['hwss', 140, 40], ['kluzak', 10, 56], ['kluzak', 20, 62], ['kluzak', 30, 68], ['kluzak', 14, 76]])) },
  { nazev: 'Gosperovo kluzákové dělo', rychlost: 30, delka: 20000,
    text: '<b>Gosperovo dělo</b> (1970) – první známý vzor, který roste donekonečna: každých 30 generací vystřelí kluzák. Tím vyhrál Bill Gosper Conwayovu cenu 50 dolarů. Sledujte rovnoměrný růst počtu buněk ve Statistikách.',
    priprav: () => scena('B3/S23', 200, 130, 'mrtvy', obrazZVzoru(200, 130, [['gosper', 8, 8]])) },
  { nazev: 'Metuzalém R-pentomino', rychlost: 120, delka: 14000, cil: 1103,
    text: '<b>R-pentomino</b>: pouhých 5 buněk, a přece se chaoticky vyvíjí 1103 generací. Pak zbude 116 buněk – zátiší, oscilátory a 6 kluzáků. Běh se v generaci 1103 sám zastaví.',
    priprav: () => scena('B3/S23', 360, 240, 'torus', obrazZVzoru(360, 240, [['rpent', 200, 120]])) },
  { nazev: 'Polévka: složitost z jednoduchých pravidel', rychlost: 30, delka: 18000,
    text: '<b>Náhodná polévka.</b> Třetina buněk náhodně živá. Po chaotickém úvodu se objeví známé tvary – bloky, úly, blinkry a kluzáky – které nikdo nenakreslil. Vznikají jen z pravidla B3/S23.',
    priprav: () => { scena('B3/S23', 240, 150, 'torus', new Uint8Array(240 * 150)); posli({ typ: 'nahodne', hustota: 0.33, seme: 2026 }); } },
  { nazev: 'Replikátor v HighLife', rychlost: 8, delka: 15000,
    text: '<b>HighLife (B36/S23)</b> se od Života liší jen zrodem při 6 sousedech. Díky tomu existuje <b>replikátor</b> (N. Thompson, 1994): každých 12 generací vytvoří svou kopii a kopie se dál množí.',
    priprav: () => scena('B36/S23', 160, 110, 'mrtvy', obrazZVzoru(160, 110, [['replikator', 78, 53]])) },
  { nazev: 'Seeds – exploze', rychlost: 12, delka: 10000,
    text: '<b>Seeds (B2/S)</b>: žádná buňka nepřežije do další generace, a přece čtyři buňky během chvíle zaplní celou plochu chaotickým růstem.',
    priprav: () => scena('B2/S', 220, 140, 'torus', obrazZVzoru(220, 140, [['seeds_semeno', 109, 69]])) },
  { nazev: 'Brianův mozek', rychlost: 20, delka: 12000,
    text: '<b>Brianův mozek (B2/S/C3)</b> má tři stavy: živá (modrá), umírající a mrtvá. Živá buňka vždy přejde do umírání, takže vznikají téměř jen pohyblivé útvary.',
    priprav: () => { scena('B2/S/C3', 200, 130, 'torus', new Uint8Array(200 * 130)); posli({ typ: 'nahodne', hustota: 0.2, seme: 7, oblast: { x: 70, y: 40, w: 60, h: 50 } }); } },
  { nazev: 'Wolfram 30 – chaos', rychlost: 60, delka: 9000,
    text: '<b>Pravidlo 30</b>: jednorozměrný automat, čas běží dolů. Z jediné buňky vznikne vzor, jehož středový sloupec je tak nepravidelný, že sloužil jako generátor náhodných čísel.',
    priprav: () => scena('W30', 321, 180, 'torus', wolframRadek(321, 180, [160]), { radek: 1 }) },
  { nazev: 'Wolfram 90 – Sierpińského trojúhelník', rychlost: 60, delka: 8000,
    text: '<b>Pravidlo 90</b> je XOR dvou sousedů. Z jediné buňky vyroste fraktál – Sierpińského trojúhelník (Pascalův trojúhelník modulo 2).',
    priprav: () => scena('W90', 321, 180, 'torus', wolframRadek(321, 180, [160]), { radek: 1 }) },
  { nazev: 'Wolfram 110 – univerzální výpočet', rychlost: 60, delka: 10000,
    text: '<b>Pravidlo 110</b> roste jen doleva a vytváří pohyblivé struktury, které se srážejí. Matthew Cook dokázal, že je Turingovsky úplné – umí spočítat cokoli, co počítač.',
    priprav: () => scena('W110', 321, 180, 'mrtvy', wolframRadek(321, 180, [300]), { radek: 1 }) },
  { nazev: 'Wireworld – hodiny a diody', rychlost: 6, delka: 16000,
    text: '<b>Wireworld</b>: elektrony (hlava modře, ocas červeně) běží po vodičích. Hodiny vlevo vysílají puls každých 8 generací. Horní dioda elektrony propouští, dolní – tatáž, obrácená – je zastaví.',
    priprav: () => scena('WireWorld', 44, 14, 'mrtvy', obrazZVzoru(44, 14, [['ww_diody', 4, 3]])) },
];
let demo = null;
function vykresliDemo() {
  const el = $('demoSeznam'); el.innerHTML = '';
  SCENY.forEach((s, i) => {
    const b = document.createElement('button');
    b.innerHTML = (i + 1) + '. ' + esc(s.nazev) + '<small>' + s.text.replace(/<[^>]+>/g, '').slice(0, 110) + '…</small>';
    b.setAttribute('aria-pressed', String(!!demo && demo.i === i));
    b.onclick = () => spustScenu(i, false);
    el.appendChild(b);
  });
}
function spustScenu(i, auto) {
  if (demo && demo.casovac) clearTimeout(demo.casovac);
  if (i < 0 || i >= SCENY.length) { ukonciDemo(); return; }
  const s = SCENY[i];
  demo = { i, auto, casovac: null };
  zastav();
  s.priprav();
  $('demoText').innerHTML = '<span style="color:var(--text-muted)">' + (i + 1) + '/' + SCENY.length + '</span> ' + s.text;
  $('demoTitulek').hidden = false;
  $('demoPred').disabled = i === 0; $('demoDalsi').textContent = i === SCENY.length - 1 ? 'Konec' : 'Další ▶';
  let idx = 0; RYCHLOSTI.forEach((r, k) => { if (r && Math.abs(Math.log(r / s.rychlost)) < Math.abs(Math.log(RYCHLOSTI[idx] / s.rychlost))) idx = k; });
  nast.rychlostIdx = idx; $('rychlost').value = idx; $('rychlostText').textContent = textRychlosti();
  st.bezi = true; aktualizujBeh();
  posli({ typ: 'start', rychlost: RYCHLOSTI[idx], cil: s.cil || 0 });
  if (auto) demo.casovac = setTimeout(() => spustScenu(i + 1, true), s.delka);
  vykresliDemo();
}
function ukonciDemo() {
  if (!demo) return;
  if (demo.casovac) clearTimeout(demo.casovac);
  demo = null; $('demoTitulek').hidden = true; vykresliDemo();
}
$('btnProhlidka').onclick = () => { spustScenu(0, true); obal.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
$('demoPred').onclick = () => demo && spustScenu(demo.i - 1, demo.auto);
$('demoDalsi').onclick = () => demo && spustScenu(demo.i + 1, demo.auto);
$('demoKonec').onclick = () => { ukonciDemo(); };
// tlačítka v titulku nesmí ukončit ukázku přes pointerdown na plátně
$('demoTitulek').addEventListener('pointerdown', e => e.stopPropagation());

// ---------------------------------------------------------------- ukládání
function ulozNastaveni() { uloz('nastaveni', nast); }
function ulozStav() {
  if (!st.bunky || !st.zmeneno && !st.gen) return;
  if (st.W * st.H > 1048576) { try { localStorage.removeItem(KLIC + 'stav'); } catch (e) { /* nic */ } return; }
  const t = J.zapisJSON({ sirka: st.W, vyska: st.H, bunky: st.bunky, pravidlo: st.pravidlo, okraj: st.okraj, gen: st.gen, radek: st.radek });
  if (t.length < 600000) uloz('stav', t);
}
window.addEventListener('pagehide', () => { ulozNastaveni(); ulozStav(); });
setInterval(() => { if (st.bezi || st.zmeneno) { ulozStav(); st.zmeneno = false; } }, 8000);

// ---------------------------------------------------------------- téma
new MutationObserver(() => { nastavPaletu(); obnovStavyKresleni(); vykresliVzory(); vykresliMoje(); aktualizujUkazatele(true); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ---------------------------------------------------------------- start
function posliInit() {
  let ulozeny = null;
  try { const t = nacti('stav', null); if (t) ulozeny = J.parsujJSON(t); } catch (e) { ulozeny = null; }
  if (ulozeny) {
    try { st.pravidlo = J.parsujPravidlo(ulozeny.pravidlo); } catch (e) { /* ponechat */ }
    st.okraj = ulozeny.okraj; selOkraj.value = st.okraj;
    posli({ typ: 'init', sirka: ulozeny.sirka, vyska: ulozeny.vyska, pravidlo: st.pravidlo, okraj: st.okraj, historieMB: nast.historieMB, bunky: ulozeny.bunky, gen: ulozeny.gen });
    if (st.pravidlo.typ === 'wolfram' && ulozeny.radek) posli({ typ: 'nahraj', bunky: ulozeny.bunky, sirka: ulozeny.sirka, vyska: ulozeny.vyska, radek: ulozeny.radek, gen: ulozeny.gen });
  } else {
    // první návštěva: Gosperovo dělo
    st.pravidlo = J.parsujPravidlo('B3/S23'); st.okraj = nast.okraj = 'mrtvy'; selOkraj.value = 'mrtvy';
    const W = 160, H = 100;
    posli({ typ: 'init', sirka: W, vyska: H, pravidlo: st.pravidlo, okraj: st.okraj, historieMB: nast.historieMB, bunky: obrazZVzoru(W, H, [['gosper', 10, 10]]) });
  }
  posliDetekci();
  st.cekaNaFit = true;
}
vytvorVykreslovac(nast.jen2d);
obnovPravidloUI();
vykresliVzory(); vykresliMoje(); vykresliDemo();
nastavNastroj('kreslit');
posliInit();
nastavPaletu(); obnovPravidloUI();
prepniZalozku(['pravidlo', 'mrizka', 'vzory', 'soubor', 'statistiky', 'ukazky'].includes(nast.zalozka) ? nast.zalozka : 'pravidlo');
aktualizujBeh();
// ladění a testy v prohlížeči
window.__automat = { st, posli, pouzijPravidlo, otevriObraz, spustScenu, ukonciDemo, prepniZalozku, zpracujText, rleText, vyk: () => vyk, nastavNastroj, vlozRazitko, vzorJakoRazitko };
})();
