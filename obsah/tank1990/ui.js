/* Tank 1990 – obrazovky (titul, opona, hra, sčítání, konec, editor), ovládání a smyčka 60 Hz. */
var TANK = globalThis.TANK || (globalThis.TANK = {});
(function (T) {
'use strict';

const Gr = T.Gr, Z = T.Z, W = Gr.W, H = Gr.H;
const KLIC_HI = 'webapp_hra_tank1990', KLIC_MAPA = 'webapp_hra_tank1990_mapa';

const buf = Gr.platno(W, H), bx = buf.getContext('2d');
const cv = document.getElementById('cv'), cx = cv.getContext('2d');

function cti(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function zapis(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* nevadí */ } }

const UI = {
  obr: 'titul', t: 0, titY: H, volba: 0, posledni: 0,
  hi: Math.max(20000, Number(cti(KLIC_HI)) || 0),
  S: null, G: null, stage: 1, vyber: false, pauza: false, vlastni: false,
  tally: null, konecSt: null, ed: null,
};
let vlastniMapa = null;
try { const m = JSON.parse(cti(KLIC_MAPA)); if (Array.isArray(m) && m.length === 13) vlastniMapa = m; } catch (e) { /* žádná */ }

/* ---------- vstup ---------- */
const SMERY = { nahoru: 0, vpravo: 1, dolu: 2, vlevo: 3 };
const KLAVESY = [
  { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3, strel: ['Space', 'KeyF', 'KeyG'] },
  { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, strel: ['Enter', 'NumpadEnter', 'Numpad0', 'ControlRight', 'KeyL'] },
];
const START = ['KeyP', 'Escape'];
const drz = new Set(), stisk = new Set(), poradi = [];
const dotyk = { smer: -1, strel: false, stisk: false, start: false, predSmer: -1 };
const padPred = [{}, {}];

function nasKlavesa(code) {
  return START.includes(code) || code === 'KeyM' || KLAVESY.some(k => code in k || k.strel.includes(code));
}
addEventListener('keydown', e => {
  if (e.ctrlKey && e.code !== 'ControlRight') return;   // Ctrl+R apod. nechat prohlížeči
  if (nasKlavesa(e.code)) e.preventDefault();
  Z.init();
  if (e.code === 'KeyM' && !e.repeat) { Z.prepniTicho(); obnovTlacitkoZvuku(); return; }
  if (!e.repeat) stisk.add(e.code);
  if (!drz.has(e.code)) { drz.add(e.code); poradi.push(e.code); }
});
addEventListener('keyup', e => {
  drz.delete(e.code);
  const i = poradi.indexOf(e.code); if (i >= 0) poradi.splice(i, 1);
});
addEventListener('blur', () => { drz.clear(); poradi.length = 0; });

function smerKlaves(sady) {
  for (let i = poradi.length - 1; i >= 0; i--)
    for (const k of sady) if (poradi[i] in k && typeof k[poradi[i]] === 'number') return k[poradi[i]];
  return -1;
}

/* Gamepad: d-pad (12–15) nebo levá páčka, střelba 0–3, start 9. */
function ctiPad(i) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && pads[i];
  const r = { smer: -1, strel: false, stisk: false, start: false };
  if (!p) return r;
  const b = n => p.buttons[n] && p.buttons[n].pressed;
  const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
  if (b(12) || ay < -0.5) r.smer = 0; else if (b(13) || ay > 0.5) r.smer = 2;
  else if (b(14) || ax < -0.5) r.smer = 3; else if (b(15) || ax > 0.5) r.smer = 1;
  r.strel = b(0) || b(1) || b(2) || b(3);
  const pred = padPred[i];
  r.stisk = r.strel && !pred.strel;
  r.start = b(9) && !pred.start;
  r.smerZmena = r.smer >= 0 && r.smer !== pred.smer;
  padPred[i] = { strel: r.strel, start: b(9), smer: r.smer };
  return r;
}

function ctiOvladani() {
  const dva = UI.S && UI.S.hracu === 2 && UI.obr === 'hra';
  const o = { h: [], nahoru: false, dolu: false, potvrd: false, start: false };
  const pady = [ctiPad(0), ctiPad(1)];
  for (let i = 0; i < 2; i++) {
    const sady = dva ? [KLAVESY[i]] : (i === 0 ? KLAVESY : []);
    const strCodes = sady.flatMap(k => k.strel);
    const v = { smer: smerKlaves(sady), strel: strCodes.some(c => drz.has(c)), stisk: strCodes.some(c => stisk.has(c)) };
    const pad = dva ? pady[i] : (i === 0 ? (pady[0].smer >= 0 || pady[0].strel ? pady[0] : pady[1]) : null);
    if (pad) {
      if (v.smer < 0) v.smer = pad.smer;
      v.strel = v.strel || pad.strel; v.stisk = v.stisk || pad.stisk;
    }
    if (i === 0) {
      if (v.smer < 0) v.smer = dotyk.smer;
      v.strel = v.strel || dotyk.strel; v.stisk = v.stisk || dotyk.stisk;
    }
    o.h.push(v);
  }
  const zmenaDotyk = dotyk.smer >= 0 && dotyk.smer !== dotyk.predSmer;
  dotyk.predSmer = dotyk.smer;
  o.nahoru = stisk.has('KeyW') || stisk.has('ArrowUp') || pady.some(p => p.smerZmena && p.smer === 0) || (zmenaDotyk && dotyk.smer === 0);
  o.dolu = stisk.has('KeyS') || stisk.has('ArrowDown') || pady.some(p => p.smerZmena && p.smer === 2) || (zmenaDotyk && dotyk.smer === 2);
  o.potvrd = ['Enter', 'NumpadEnter', 'Space', 'KeyF'].some(c => stisk.has(c)) || pady.some(p => p.stisk || p.start) || dotyk.stisk || dotyk.start;
  o.start = START.some(c => stisk.has(c)) || pady.some(p => p.start) || dotyk.start;
  return o;
}

/* ---------- přechody ---------- */
function novaHra(hracu) {
  UI.S = { hracu, hraci: [0, 1].map(i => ({ zivoty: i < hracu ? 3 : 0, skore: 0, uroven: 0, lod: false, stromy: false })) };
  UI.stage = 1; UI.vyber = true;
  naOponu();
}
function naOponu() { UI.obr = 'opona'; UI.t = 0; Z.motor(0); }
function spustKolo() {
  const mapa = (UI.stage === 1 && UI.vlastni && vlastniMapa) ? vlastniMapa : T.MAPY[(UI.stage - 1) % T.MAPY.length];
  UI.G = T.novyStage({ mapa, stage: UI.stage, sezeni: UI.S, seed: (Date.now() & 0xffffff) + UI.stage });
  UI.obr = 'hra'; UI.pauza = false; UI.t = 0;
  Z.hraj('start');
}
function aktualizujHi() {
  const nej = Math.max(...UI.S.hraci.map(h => h.skore));
  if (nej > UI.hi) { UI.hi = nej; zapis(KLIC_HI, String(nej)); return true; }
  return false;
}

/* ---------- kroky obrazovek ---------- */
function krokTitul(o) {
  if (UI.titY > 0) { UI.titY = Math.max(0, UI.titY - 1.6); if (o.potvrd || o.start) UI.titY = 0; return; }
  if (o.nahoru) { UI.volba = (UI.volba + 2) % 3; Z.hraj('volba'); }
  if (o.dolu || stisk.has('Tab')) { UI.volba = (UI.volba + 1) % 3; Z.hraj('volba'); }
  if (o.potvrd || o.start) {
    if (UI.volba < 2) novaHra(UI.volba + 1);
    else otevriEditor();
  }
}

function krokOpona(o) {
  if (UI.t < 30) return;
  if (UI.vyber) {
    if (o.nahoru) { UI.stage = UI.stage % T.MAPY.length + 1; Z.hraj('volba'); }
    if (o.dolu) { UI.stage = (UI.stage + T.MAPY.length - 2) % T.MAPY.length + 1; Z.hraj('volba'); }
    if (o.potvrd || o.start) { UI.vyber = false; spustKolo(); }
  } else if (UI.t > 110) spustKolo();
}

function krokHra(o) {
  const G = UI.G;
  if (o.start && G.gameOverT < 0) { UI.pauza = !UI.pauza; Z.hraj('pauza'); }
  if (UI.pauza) { Z.motor(0); return; }
  T.krok(G, o.h);
  for (const z of G.zvuky) Z.hraj(z);
  G.zvuky.length = 0;
  const hraci = G.tanky.filter(t => t.hrac >= 0);
  Z.motor(!hraci.length || G.gameOverT >= 0 ? 0 : hraci.some(t => t.jede) ? 2 : 1);
  if (!G.konec) return;
  Z.motor(0);
  aktualizujHi();
  const zab = G.zabito.map(z => z.reduce((a, b) => a + b));
  let bonus = -1;
  // ve dvou hráčích dostane bonus 1000, kdo zničil víc tanků (jen po vyhraném kole)
  if (UI.S.hracu === 2 && G.konec === 'vyhra' && zab[0] !== zab[1]) {
    bonus = zab[0] > zab[1] ? 0 : 1;
    UI.S.hraci[bonus].skore += 1000;
  }
  UI.tally = { stage: G.stage, hracu: UI.S.hracu, zabito: G.zabito, skore: UI.S.hraci.map(h => h.skore),
    hi: UI.hi, radek: 0, pocet: 0, t: 0, bonus: -2, bonusPlati: bonus, vyhra: G.konec === 'vyhra' };
  UI.obr = 'skore'; UI.t = 0;
}

function krokSkore(o) {
  const st = UI.tally;
  st.t++;
  if (o.potvrd && st.radek < 4) { st.radek = 4; st.t = 0; }
  if (st.radek < 4) {
    if (st.t % 8) return;
    const max = Math.max(st.zabito[0][st.radek], st.zabito[1][st.radek]);
    if (st.pocet < max) { st.pocet++; Z.hraj('tik'); }
    else { st.radek++; st.pocet = 0; st.t = 0; }
    return;
  }
  if (st.bonus === -2 && st.t > 30) { st.bonus = st.bonusPlati; if (st.bonus >= 0) Z.hraj('zivot'); aktualizujHi(); st.hi = UI.hi; }
  if (st.t > 150 || (o.potvrd && st.t > 20)) {
    if (st.vyhra) { UI.stage++; naOponu(); }
    else {
      const novy = aktualizujHi();
      UI.konecSt = { t: 0, hi: UI.hi, novyRekord: novy || UI.S.hraci.some(h => h.skore >= UI.hi && h.skore > 0) };
      UI.posledni = UI.S.hraci[0].skore;
      UI.obr = 'konec'; UI.t = 0;
    }
  }
}

function krokKonec(o) {
  UI.konecSt.t++;
  if (UI.konecSt.t > 240 || (o.potvrd && UI.konecSt.t > 60)) { UI.obr = 'titul'; UI.titY = 0; UI.t = 0; }
}

/* ---------- editor (Construction) ---------- */
function otevriEditor() {
  const radky = vlastniMapa ? vlastniMapa.slice() : Array(13).fill('.............');
  UI.ed = { radky: radky.map(r => r.split('')), x: 0, y: 0, typ: -1, posl: null, drzSmer: -1, rep: 0, verze: 1, m: null };
  prepocitejEditor();
  UI.obr = 'editor'; UI.t = 0;
}
function prepocitejEditor() {
  const ed = UI.ed;
  ed.m = T.nactiMapu(ed.radky.map(r => r.join('')));
  ed.verze++;
  ed.nahled = ed.typ >= 0 ? Gr.nahledDlazdice(T.EDITOR_TYPY[ed.typ]) : null;
}
function chranena(x, y) { return T.CHRANENE.some(([a, b]) => a === x && b === y); }
function polozDlazdici(dalsi) {
  const ed = UI.ed, poz = ed.x + ',' + ed.y;
  if (dalsi && ed.posl === poz) ed.typ = (ed.typ + 1) % T.EDITOR_TYPY.length;
  else if (ed.typ < 0) ed.typ = 0;
  ed.posl = poz;
  if (!chranena(ed.x, ed.y)) ed.radky[ed.y][ed.x] = T.EDITOR_TYPY[ed.typ];
  prepocitejEditor();
  Z.hraj('editor');
}
function zavriEditor() {
  vlastniMapa = T.vycistiMapu(UI.ed.radky.map(r => r.join('')));
  zapis(KLIC_MAPA, JSON.stringify(vlastniMapa));
  UI.vlastni = true;
  UI.obr = 'titul'; UI.titY = 0; UI.volba = 0;
}
function krokEditor(o) {
  const ed = UI.ed, v = o.h[0];
  if (o.start) { zavriEditor(); return; }
  let pohyb = false;
  if (v.smer >= 0) {
    if (ed.drzSmer !== v.smer) { pohyb = true; ed.rep = 16; }
    else if (--ed.rep <= 0) { pohyb = true; ed.rep = 6; }
  }
  ed.drzSmer = v.smer;
  if (pohyb) {
    ed.x = Math.max(0, Math.min(12, ed.x + T.K.DX[v.smer]));
    ed.y = Math.max(0, Math.min(12, ed.y + T.K.DY[v.smer]));
    if (v.strel && ed.typ >= 0) polozDlazdici(false);     // držená střelba = malování
  }
  if (v.stisk) polozDlazdici(true);
}
// editor myší / prstem: klepnutí na dlaždici = kurzor tam + položit (opakované klepnutí přepíná typ)
cv.addEventListener('pointerdown', e => {
  Z.init();
  if (UI.obr !== 'editor') return;
  const r = cv.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width * W - Gr.OX, py = (e.clientY - r.top) / r.height * H - Gr.OY;
  if (px < 0 || py < 0 || px >= 208 || py >= 208) return;
  UI.ed.x = Math.floor(px / 16); UI.ed.y = Math.floor(py / 16);
  polozDlazdici(true);
});

/* ---------- smyčka ---------- */
function krok() {
  const o = ctiOvladani();
  UI.t++;
  switch (UI.obr) {
    case 'titul': krokTitul(o); break;
    case 'opona': krokOpona(o); break;
    case 'hra': krokHra(o); break;
    case 'skore': krokSkore(o); break;
    case 'konec': krokKonec(o); break;
    case 'editor': krokEditor(o); break;
  }
  stisk.clear();
  dotyk.stisk = false; dotyk.start = false;
}

function vykresli() {
  Gr.nastavHladkost(bx);
  switch (UI.obr) {
    case 'titul': Gr.titul(bx, { titY: UI.titY, volba: UI.volba, t: UI.t, hi: UI.hi, posledni: UI.posledni }); break;
    case 'opona': Gr.opona(bx, { t: UI.t, stage: UI.stage, vyber: UI.vyber, vlastni: UI.vlastni && !!vlastniMapa }); break;
    case 'hra': Gr.hra(bx, UI.G, { pauza: UI.pauza, t: UI.t }); break;
    case 'skore': Gr.skore(bx, UI.tally); break;
    case 'konec': Gr.konec(bx, UI.konecSt); break;
    case 'editor': Gr.editor(bx, Object.assign({ t: UI.t }, UI.ed)); break;
  }
  cx.imageSmoothingEnabled = false;
  cx.drawImage(buf, 0, 0, cv.width, cv.height);
}

const DT = 1000 / 60;
let posl = performance.now(), akum = 0;
function smycka(t) {
  akum += Math.min(200, t - posl); posl = t;
  let n = 0;
  while (akum >= DT && n < 4) { krok(); akum -= DT; n++; }
  if (n) vykresli();
  requestAnimationFrame(smycka);
}

/* ---------- rozměr: celé násobky, když se vejdou; ostré pixely i na HiDPI ---------- */
const obal = document.getElementById('obal'), ovl = document.getElementById('dotyk'), info = document.getElementById('info');
function rozmer() {
  const dpr = window.devicePixelRatio || 1;
  const sirka = obal.clientWidth - 16;
  const vyska = obal.clientHeight - (ovl.offsetParent ? ovl.offsetHeight + 8 : 0) - (info.offsetHeight + 8);
  let m = Math.min(sirka / W, vyska / H);
  if (m >= 2) m = Math.floor(m);
  m = Math.max(0.5, m);
  const cssW = Math.floor(W * m), cssH = Math.floor(H * m);
  cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  vykresli();
}
addEventListener('resize', rozmer);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && UI.obr === 'hra' && UI.G && UI.G.gameOverT < 0) { UI.pauza = true; Z.motor(0); }
});

/* ---------- dotykové ovládání ---------- */
function nastavDotyk() {
  const kriz = document.getElementById('kriz'), palba = document.getElementById('palba'), start = document.getElementById('startBtn');
  const smerZ = e => {
    const r = kriz.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return -1;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  };
  let kId = null;
  kriz.addEventListener('pointerdown', e => { Z.init(); kId = e.pointerId; try { kriz.setPointerCapture(e.pointerId); } catch (_) {} dotyk.smer = smerZ(e); e.preventDefault(); });
  kriz.addEventListener('pointermove', e => { if (e.pointerId === kId) dotyk.smer = smerZ(e); });
  const pust = e => { if (e.pointerId === kId) { kId = null; dotyk.smer = -1; } };
  kriz.addEventListener('pointerup', pust); kriz.addEventListener('pointercancel', pust);
  palba.addEventListener('pointerdown', e => { Z.init(); dotyk.strel = true; dotyk.stisk = true; e.preventDefault(); });
  const pustP = () => { dotyk.strel = false; };
  palba.addEventListener('pointerup', pustP); palba.addEventListener('pointercancel', pustP); palba.addEventListener('pointerleave', pustP);
  start.addEventListener('pointerdown', e => { Z.init(); dotyk.start = true; e.preventDefault(); });
}
function obnovTlacitkoZvuku() {
  const b = document.getElementById('zvukBtn');
  if (b) { b.textContent = Z.ticho() ? '🔇' : '🔊'; b.title = Z.ticho() ? 'Zapnout zvuk (M)' : 'Vypnout zvuk (M)'; }
}

function start() {
  const hrubeUkazovadlo = matchMedia('(pointer: coarse)').matches;
  if (hrubeUkazovadlo) document.body.classList.add('dotykove');
  addEventListener('touchstart', () => {
    if (!document.body.classList.contains('dotykove')) { document.body.classList.add('dotykove'); rozmer(); }
  }, { once: true, passive: true });
  nastavDotyk();
  document.getElementById('zvukBtn').addEventListener('click', () => { Z.init(); Z.prepniTicho(); obnovTlacitkoZvuku(); });
  obnovTlacitkoZvuku();
  rozmer();
  setTimeout(rozmer, 300);          // podpis.js mění výšku stránky až po načtení
  requestAnimationFrame(t => { posl = t; smycka(t); });
}

T.UI = UI;          // pro testy
T.ui = { start, krok, vykresli, novaHra, spustKolo, otevriEditor, rozmer, dotyk };

})(TANK);
