/* Bomberman – menu, průběh kampaně a souboje, ovládání (klávesnice, dotyk, gamepad),
   smyčka s pevným krokem 60 Hz a vykreslení. */
var BOMB = globalThis.BOMB || (globalThis.BOMB = {});
(function (B) {
'use strict';

const Gr = B.Gr, Z = B.Z, DT = B.DT;
const $ = id => document.getElementById(id);
const cv = $('cv'), cx = cv.getContext('2d');
const buf = Gr.platno(Gr.SW, Gr.SH), bx = buf.getContext('2d');
const KLIC_UROVEN = 'webapp_bomberman_uroven', KLIC_VOLBY = 'webapp_bomberman_volby', KLIC_SERIE = 'webapp_bomberman_serie';

function cti(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function zapis(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* nevadí */ } }

const BARVY = ['bila', 'cerna', 'cervena', 'modra'];
const NAZVY_BAREV = { bila: 'Bílý', cerna: 'Černý', cervena: 'Červený', modra: 'Modrý' };

const UI = {
  stav: 'menu',          // menu | uvod | hra | mezi | pauza | konec
  rezim: 'kampan', S: null, demo: true, banner: null,
  kamp: null, souboj: null, plovouci: [], hodiny: 0, predPauzou: 'hra',
};

/* ---------- rekordy ---------- */
let rekKamp = null, rekSouboj = null;
if (typeof Rekord !== 'undefined') {
  rekKamp = Rekord.sleduj('webapp_hra_bomberman_kampan', { vyssiLepsi: true, popisek: 'Kampaň – nejvíc bodů', format: v => v.toLocaleString('cs-CZ') });
  rekSouboj = Rekord.sleduj('webapp_hra_bomberman_serie', { vyssiLepsi: true, popisek: 'Souboj s boty – výhry v řadě', format: v => v + '×' });
  rekKamp.prvek($('rekordKampan')); rekSouboj.prvek($('rekordSouboj'));
}

/* ---------- vstup ---------- */
const SADY = [
  { smery: { KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 }, bomba: ['Space', 'KeyF'], rozbuska: ['KeyE', 'KeyQ', 'ShiftLeft'] },
  { smery: { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }, bomba: ['Enter', 'NumpadEnter', 'Numpad0', 'ControlRight'], rozbuska: ['ShiftRight', 'NumpadDecimal', 'Numpad1'] },
];
const drz = new Set(), poradi = [];
const zachyt = [{ bomba: false, rozbuska: false }, { bomba: false, rozbuska: false }];
const dotyk = { smer: -1, bomba: false, rozbuska: false };
const padPred = [{}, {}];

function vHre() { return UI.stav === 'hra' || UI.stav === 'uvod' || UI.stav === 'mezi' || UI.stav === 'pauza'; }
function dvaLide() { return !!(UI.souboj && UI.souboj.dvaHraci && UI.rezim === 'souboj'); }
function sadyHrace(i) { return dvaLide() ? [SADY[i]] : (i === 0 ? SADY : []); }
function nasKlavesa(code) {
  return code === 'KeyP' || code === 'Escape' || SADY.some(s => code in s.smery || s.bomba.includes(code) || s.rozbuska.includes(code));
}

addEventListener('keydown', e => {
  const cil = e.target && e.target.tagName;
  if (cil === 'SELECT' || cil === 'INPUT') return;
  if (e.code === 'KeyM' && !e.repeat) { Z.init(); Z.prepniTicho(); obnovZvuk(); return; }
  if (!vHre()) return;
  if (e.ctrlKey && e.code !== 'ControlRight') return;
  if (nasKlavesa(e.code)) e.preventDefault();
  Z.init();
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) { prepniPauzu(); return; }
  if (!drz.has(e.code)) { drz.add(e.code); poradi.push(e.code); }
  if (!e.repeat) for (let i = 0; i < 2; i++) for (const s of sadyHrace(i)) {
    if (s.bomba.includes(e.code)) zachyt[i].bomba = true;
    if (s.rozbuska.includes(e.code)) zachyt[i].rozbuska = true;
  }
});
addEventListener('keyup', e => {
  drz.delete(e.code);
  const i = poradi.indexOf(e.code); if (i >= 0) poradi.splice(i, 1);
});
addEventListener('blur', () => { drz.clear(); poradi.length = 0; if (UI.stav === 'hra') pauza(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && UI.stav === 'hra') pauza(true); });

function ctiPad(i) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const p = pads && pads[i];
  if (!p) return null;
  const b = k => p.buttons[k] && p.buttons[k].pressed;
  let smer = -1;
  if (b(12)) smer = 0; else if (b(15)) smer = 1; else if (b(13)) smer = 2; else if (b(14)) smer = 3;
  else if (p.axes && p.axes.length >= 2) {
    const ax = p.axes[0], ay = p.axes[1];
    if (Math.max(Math.abs(ax), Math.abs(ay)) > 0.5) smer = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 1 : 3) : (ay > 0 ? 2 : 0);
  }
  const start = b(9), pred = padPred[i];
  const startStisk = start && !pred.start;
  pred.start = start;
  return { smer, bomba: b(0) || b(3), rozbuska: b(1) || b(2), start: startStisk };
}

function vstupHrace(i) {
  let smer = -1;
  const sady = sadyHrace(i);
  for (let k = poradi.length - 1; k >= 0 && smer < 0; k--)
    for (const s of sady) if (poradi[k] in s.smery) { smer = s.smery[poradi[k]]; break; }
  let bomba = zachyt[i].bomba || sady.some(s => s.bomba.some(c => drz.has(c)));
  let rozbuska = zachyt[i].rozbuska || sady.some(s => s.rozbuska.some(c => drz.has(c)));
  if (i === 0) {
    if (dotyk.smer >= 0) smer = dotyk.smer;
    bomba = bomba || dotyk.bomba; rozbuska = rozbuska || dotyk.rozbuska;
  }
  const p = ctiPad(i);
  if (p) {
    if (smer < 0) smer = p.smer;
    bomba = bomba || p.bomba; rozbuska = rozbuska || p.rozbuska;
    if (p.start) prepniPauzu();
  }
  return { smer, bomba, rozbuska };
}

/* ---------- průběh ---------- */
function banner(nadpis, text, trvani, pak) {
  UI.banner = { nadpis, text, do: UI.hodiny + trvani, pak };
}

function predmetyDo(n) {
  const h = { maxBomb: 1, plamen: 1, rychlostLvl: 0, kopani: false, dalkova: false };
  for (let j = 0; j < n; j++) B.seber(h, B.UROVNE[j].predmet);
  return h;
}

function startKampan(od) {
  UI.rezim = 'kampan'; UI.demo = false;
  UI.kamp = { uroven: od, zivoty: 3, skore: 0, nes: predmetyDo(od) };
  spustUroven();
}
function spustUroven() {
  const k = UI.kamp;
  UI.S = B.novaUroven(k.uroven, k.nes, { nahoda: 1 + Math.floor(Math.random() * 1e9) });
  UI.plovouci = [];
  UI.stav = 'uvod';
  ukazPrekryv(null);
  banner('ÚROVEŇ ' + (k.uroven + 1), 'Najdi dveře a znič všechny potvory', 2, () => { UI.stav = 'hra'; UI.banner = null; });
}

function startSouboj(v) {
  UI.rezim = 'souboj'; UI.demo = false;
  const hraci = [{ bot: false }];
  if (v.dvaHraci) hraci.push({ bot: false });
  for (let k = 0; k < v.boti && hraci.length < 4; k++) hraci.push({ bot: true, obtiznost: v.obtiznost });
  if (hraci.length < 2) hraci.push({ bot: true, obtiznost: v.obtiznost });
  UI.souboj = Object.assign({}, v, { hraci, vyhry: hraci.map(() => 0), kolo: 0 });
  spustKolo();
}
function spustKolo() {
  const so = UI.souboj;
  so.kolo++;
  UI.S = B.novySouboj({ seed: 1 + Math.floor(Math.random() * 1e9), hraci: so.hraci.map((h, i) => Object.assign({ barva: BARVY[i] }, h)), limit: so.limit, dalkova: so.dalkova });
  UI.plovouci = [];
  UI.stav = 'uvod';
  ukazPrekryv(null);
  banner('KOLO ' + so.kolo, 'Hraje se na ' + so.naVyhry + ' ' + (so.naVyhry === 1 ? 'výhru' : so.naVyhry < 5 ? 'výhry' : 'výher'), 1.8, () => { UI.stav = 'hra'; UI.banner = null; });
}
function jmeno(h) {
  const so = UI.souboj;
  if (!h.bot) return so && so.dvaHraci ? 'Hráč ' + (h.id + 1) : 'Ty';
  return 'Bot ' + NAZVY_BAREV[h.barva];
}

function konecKola() {
  const S = UI.S, V = S.vysledek;
  UI.stav = 'mezi';
  if (UI.rezim === 'kampan') {
    const k = UI.kamp;
    k.skore += S.skore;
    if (V.typ === 'uroven') {
      const h = S.hraci[0];
      k.nes = { maxBomb: h.maxBomb, plamen: h.plamen, rychlostLvl: h.rychlostLvl, kopani: h.kopani, dalkova: h.dalkova };
      k.uroven++;
      const odemceno = Math.max(Number(cti(KLIC_UROVEN)) || 0, Math.min(k.uroven, B.UROVNE.length - 1));
      zapis(KLIC_UROVEN, String(odemceno));
      if (k.uroven >= B.UROVNE.length) {
        Z.hraj('vyhra');
        banner('KAMPAŇ DOKONČENA!', 'Bonus za čas +' + V.bonus, 3, () => konecHry(true));
      } else banner('ÚROVEŇ HOTOVÁ', 'Bonus za čas +' + V.bonus.toLocaleString('cs-CZ'), 2.5, spustUroven);
    } else {
      k.zivoty--;
      if (k.zivoty <= 0) { Z.hraj('prohra'); banner('KONEC HRY', 'Došly životy', 2.2, () => konecHry(false)); }
      else banner('AU!', 'Zbývá životů: ' + k.zivoty, 2, spustUroven);
    }
    return;
  }
  const so = UI.souboj;
  if (V.typ === 'vyhra') {
    so.vyhry[V.hrac]++;
    const h = S.hraci[V.hrac];
    Z.hraj(h.bot && !dvaLide() ? 'prohra' : 'vyhra');
    const stav = so.vyhry.map((v, i) => NAZVY_BAREV[BARVY[i]][0] + ' ' + v).join(' · ');
    const pak = so.vyhry[V.hrac] >= so.naVyhry ? () => konecHry(!h.bot, h) : spustKolo;
    banner(jmeno(h).toUpperCase() + (h.bot || dvaLide() ? ' VYHRÁL KOLO' : ' VYHRÁVÁŠ KOLO'), stav, 2.5, pak);
  } else banner('REMÍZA', 'Kolo se nepočítá', 2.2, spustKolo);
}

function konecHry(vyhra, vitez) {
  UI.banner = null;
  UI.stav = 'konec';
  let nadpis, text;
  if (UI.rezim === 'kampan') {
    const k = UI.kamp;
    const novy = rekKamp ? rekKamp.zapis(k.skore) : false;
    nadpis = vyhra ? '🏆 Kampaň dokončena!' : '💀 Konec hry';
    text = 'Body: ' + k.skore.toLocaleString('cs-CZ') + (vyhra ? '' : '\nDošel jsi do úrovně ' + (k.uroven + 1) + ' z ' + B.UROVNE.length) + (novy ? '\nNový osobní rekord!' : '');
  } else {
    const so = UI.souboj;
    const jedenClovek = !so.dvaHraci;
    nadpis = vitez ? (vitez.bot ? '🤖 ' + jmeno(vitez) + ' vyhrál zápas' : (jedenClovek ? '🏆 Vyhrál jsi zápas!' : '🏆 ' + jmeno(vitez) + ' vyhrál zápas!')) : 'Konec zápasu';
    text = 'Skóre: ' + so.hraci.map((h, i) => jmeno(Object.assign({ id: i, barva: BARVY[i] }, h)) + ' ' + so.vyhry[i]).join(' · ');
    if (jedenClovek) {
      let serie = Number(cti(KLIC_SERIE)) || 0;
      serie = vitez && !vitez.bot ? serie + 1 : 0;
      zapis(KLIC_SERIE, String(serie));
      const novy = serie > 0 && rekSouboj ? rekSouboj.zapis(serie) : false;
      text += '\nVýhry v řadě: ' + serie + (novy ? ' – nový rekord!' : '');
    }
  }
  $('konecNadpis').textContent = nadpis;
  $('konecText').textContent = text;
  ukazPrekryv('konec');
}

function prepniPauzu() {
  if (UI.stav === 'pauza') { UI.stav = UI.predPauzou; Z.hraj('pauza'); }
  else if (UI.stav === 'hra' || UI.stav === 'uvod' || UI.stav === 'mezi') pauza(true);
}
function pauza(ano) {
  if (ano && UI.stav !== 'pauza') { UI.predPauzou = UI.stav; UI.stav = 'pauza'; drz.clear(); poradi.length = 0; Z.hraj('pauza'); }
}

/* ---------- demo za menu ---------- */
function spustDemo() {
  UI.demo = true;
  UI.rezim = 'demo';
  UI.S = B.novySouboj({ seed: 1 + Math.floor(Math.random() * 1e9), hraci: [0, 1, 2, 3].map(() => ({ bot: true, obtiznost: 'tezka' })), limit: 75 });
  UI.demoKonec = -1;
}

/* ---------- krok ---------- */
const ZVUK_UDALOSTI = { poloz: 'poloz', vybuch: 'vybuch', predmet: 'predmet', kop: 'kop', smrt: 'smrt', nepritel: 'nepritel', cas: 'cas', posily: 'posily' };
let zedZvuk = 0;
function zpracujUdalosti(S) {
  for (const u of S.udalosti) {
    if (!UI.demo) {
      if (ZVUK_UDALOSTI[u.typ]) Z.hraj(ZVUK_UDALOSTI[u.typ]);
      else if (u.typ === 'zed' && (zedZvuk++ % 3 === 0)) Z.hraj('zed');
    }
    if (u.typ === 'nepritel') UI.plovouci.push({ x: u.x, y: u.y, text: String(u.body), t: 0 });
  }
  S.udalosti.length = 0;
}

function krokHry() {
  const S = UI.S;
  if (!UI.demo) {
    S.hraci.forEach((h, i) => {
      if (h.bot) return;
      const v = S.vysledek ? { smer: -1, bomba: false, rozbuska: false } : vstupHrace(i);
      h.vstup.smer = v.smer; h.vstup.bomba = v.bomba; h.vstup.rozbuska = v.rozbuska; h.vstup.krokMax = Infinity;
    });
    zachyt.forEach(z => { z.bomba = false; z.rozbuska = false; });
    dotyk.bomba = dotyk.bombaDrz; dotyk.rozbuska = false;
  }
  B.ai.ovladej(S);
  B.krok(S);
  zpracujUdalosti(S);
  for (const p of UI.plovouci) p.t += DT;
  UI.plovouci = UI.plovouci.filter(p => p.t < 1.2);
  if (UI.demo) {
    if (S.vysledek && UI.demoKonec < 0) UI.demoKonec = UI.hodiny + 2;
  } else if (S.vysledek && UI.stav === 'hra') konecKola();
}

/* ---------- vykreslení ---------- */
function text(t, x, y, vel, barva, zarovnani, tucne) {
  const s = cv.width / Gr.SW;
  cx.font = (tucne === false ? '' : 'bold ') + Math.round(vel * s) + 'px "Courier New", monospace';
  cx.textAlign = zarovnani || 'left'; cx.textBaseline = 'middle';
  cx.fillStyle = '#000';
  cx.fillText(t, x * s + Math.max(1, s * 0.5), y * s + Math.max(1, s * 0.5));
  cx.fillStyle = barva || '#fff';
  cx.fillText(t, x * s, y * s);
}
function casText(sek) {
  sek = Math.max(0, Math.ceil(sek));
  return Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0');
}

function vykresli() {
  const S = UI.S;
  if (!S) return;
  Gr.scena(bx, S);
  const S2 = UI.rezim === 'souboj' || UI.demo;
  // ikonky na liště (pixelově v bufferu)
  if (S2) S.hraci.forEach((h, i) => {
    bx.globalAlpha = h.ziv ? 1 : 0.3;
    bx.drawImage(Gr.hlavicka(h.barva), 4 + i * 44, 2);
    bx.globalAlpha = 1;
  });
  else if (UI.kamp) bx.drawImage(Gr.hlavicka('bila'), 150, 2);
  cx.imageSmoothingEnabled = false;
  cx.drawImage(buf, 0, 0, cv.width, cv.height);

  // texty lišty
  if (S2) {
    S.hraci.forEach((h, i) => {
      const v = UI.souboj && !UI.demo ? UI.souboj.vyhry[i] : '';
      text(String(v), 19 + i * 44, 8.5, 9, h.ziv ? '#fff' : '#888');
      if (!h.bot && !UI.demo) text(dvaLide() ? 'H' + (i + 1) : 'TY', 28 + i * 44, 8.5, 7, '#ffd84a');
    });
    const zbyva = S.casLimit - S.cas;
    text(zbyva > 0 ? casText(zbyva) : 'NÁHLÁ SMRT', 236, 8.5, 9, zbyva > 0 ? (zbyva < 15 ? '#ffb040' : '#fff') : '#ff5050', 'right');
    if (UI.demo) text('UKÁZKA', 196, 8.5, 7, '#9aa', 'right', false);
  } else if (UI.kamp) {
    const k = UI.kamp;
    text('Ú' + (k.uroven + 1), 4, 8.5, 9, '#ffd84a');
    text(String(k.skore + S.skore).padStart(6, '0'), 30, 8.5, 9, '#fff');
    text('×' + k.zivoty, 163, 8.5, 9, '#fff');
    const zbyva = S.casLimit - S.cas;
    text(casText(zbyva), 236, 8.5, 9, zbyva < 30 ? '#ff6040' : '#fff', 'right');
    const zivi = S.nepratele.filter(n => n.ziv).length;
    text('👾' + zivi, 112, 8.5, 8, '#fff', 'center', false);
  }
  // body za nepřátele
  for (const p of UI.plovouci) {
    cx.globalAlpha = Math.max(0, 1 - p.t / 1.2);
    text(p.text, p.x * 16 + 8, p.y * 16 + Gr.LISTA + 4 - p.t * 14, 7, '#fff', 'center');
    cx.globalAlpha = 1;
  }
  // nápis přes hru
  let nad = null, pod = null;
  if (UI.stav === 'pauza') { nad = 'PAUZA'; pod = 'P / Esc – pokračovat'; }
  else if (UI.banner) { nad = UI.banner.nadpis; pod = UI.banner.text; }
  if (nad && !(UI.stav === 'menu' || UI.stav === 'konec')) {
    const s = cv.width / Gr.SW;
    cx.fillStyle = 'rgba(10,10,20,0.72)';
    cx.fillRect(0, 88 * s, cv.width, 60 * s);
    cx.fillStyle = 'rgba(255,216,74,0.8)';
    cx.fillRect(0, 88 * s, cv.width, Math.max(1, s));
    cx.fillRect(0, 148 * s - Math.max(1, s), cv.width, Math.max(1, s));
    text(nad, 120, 110, nad.length > 18 ? 11 : 15, '#ffd84a', 'center');
    if (pod) text(pod, 120, 131, 8, '#e8e8f0', 'center', false);
  }
  const rb = $('rozbuskaBtn');
  if (rb) rb.disabled = !(UI.S && !UI.demo && UI.S.hraci[0] && UI.S.hraci[0].dalkova);
}

/* ---------- smyčka ---------- */
let posl = 0, akum = 0;
function smycka(t) {
  const dt = Math.min(0.1, Math.max(0, (t - posl) / 1000));
  posl = t;
  if (UI.stav !== 'pauza') UI.hodiny += dt;
  const bezi = UI.demo ? (UI.stav === 'menu' || UI.stav === 'konec') : (UI.stav === 'hra' || UI.stav === 'mezi');
  if (bezi && UI.S) {
    akum += dt;
    let n = 0;
    while (akum >= DT && n < 6) { krokHry(); akum -= DT; n++; }
    if (n === 6) akum = 0;
  } else akum = 0;
  if (UI.demo && UI.demoKonec >= 0 && UI.hodiny >= UI.demoKonec) spustDemo();
  if (UI.stav === 'uvod' || UI.stav === 'pauza') {
    // ve stavu úvodu/pauzy čteme gamepad kvůli startu
    const p = ctiPad(0); if (p && p.start) prepniPauzu();
  }
  if (UI.banner && UI.stav !== 'pauza' && UI.hodiny >= UI.banner.do) { const f = UI.banner.pak; UI.banner = null; if (f) f(); }
  vykresli();
  requestAnimationFrame(smycka);
}

/* ---------- rozměr: celé násobky v pixelech zařízení ---------- */
function rozmer() {
  const dpr = window.devicePixelRatio || 1;
  const sirka = Math.max(200, $('obal').clientWidth);
  const dotykH = document.body.classList.contains('dotykove') ? $('dotyk').offsetHeight + 8 : 0;
  const hlavaH = document.querySelector('.hlava').offsetHeight + 24;
  const vyska = window.innerHeight - hlavaH - dotykH;
  let m = Math.min(sirka / Gr.SW, vyska / Gr.SH);
  m = Math.max(m, Math.min(sirka / Gr.SW, 1.25));        // v nízkém okně raději posouvat stránku než mít mrňavou hru
  let d = m * dpr;
  if (d >= 2) d = Math.floor(d);
  cv.style.width = (Gr.SW * d / dpr) + 'px';
  cv.style.height = (Gr.SH * d / dpr) + 'px';
  cv.width = Math.round(Gr.SW * d); cv.height = Math.round(Gr.SH * d);
  vykresli();
}
addEventListener('resize', rozmer);

/* ---------- menu ---------- */
function ukazPrekryv(ktery) {
  $('menu').hidden = ktery !== 'menu';
  $('konec').hidden = ktery !== 'konec';
}
function nastavRezim(r) {
  UI.vybranyRezim = r;
  document.querySelectorAll('.karta').forEach(k => k.setAttribute('aria-pressed', String(k.dataset.rezim === r)));
  const kamp = r === 'kampan';
  $('volbyKampan').hidden = !kamp; $('popisKampan').hidden = !kamp; $('neprateleUrovne').hidden = !kamp;
  $('volbySouboj').hidden = kamp; $('popisSouboj').hidden = kamp;
  ulozVolby();
}
function naplnUrovne() {
  const odemceno = Math.min(B.UROVNE.length - 1, Number(cti(KLIC_UROVEN)) || 0);
  const sel = $('odUrovne'), puvodni = Number(sel.value) || 0;
  sel.innerHTML = '';
  for (let i = 0; i <= odemceno; i++) {
    const o = document.createElement('option');
    o.value = i; o.textContent = 'Úroveň ' + (i + 1);
    sel.appendChild(o);
  }
  sel.value = String(Math.min(puvodni, odemceno));
  ukazNepratele();
}
function ukazNepratele() {
  const n = Number($('odUrovne').value) || 0, box = $('neprateleUrovne');
  box.innerHTML = '';
  const U = B.UROVNE[n];
  for (const typ in U.nepratele) {
    const s = document.createElement('span');
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    c.getContext('2d').drawImage(Gr.nepritel(typ, 0), 0, 0);
    s.appendChild(c);
    s.appendChild(document.createTextNode(B.NEPRATELE[typ].nazev + ' ×' + U.nepratele[typ]));
    box.appendChild(s);
  }
}
function volbySouboje() {
  return {
    boti: Number($('pocetBotu').value), obtiznost: $('obtiznost').value, naVyhry: Number($('naVyhry').value),
    limit: Number($('limitKola').value), dvaHraci: $('dvaHraci').checked, dalkova: $('sDalkovou').checked,
  };
}
function ulozVolby() {
  zapis(KLIC_VOLBY, JSON.stringify(Object.assign({ rezim: UI.vybranyRezim }, volbySouboje())));
}
function nactiVolby() {
  try {
    const v = JSON.parse(cti(KLIC_VOLBY));
    if (!v) return null;
    if (v.boti) $('pocetBotu').value = String(v.boti);
    if (v.obtiznost) $('obtiznost').value = v.obtiznost;
    if (v.naVyhry) $('naVyhry').value = String(v.naVyhry);
    if (v.limit) $('limitKola').value = String(v.limit);
    $('dvaHraci').checked = !!v.dvaHraci;
    $('sDalkovou').checked = v.dalkova !== false;
    return v.rezim;
  } catch (e) { return null; }
}
function start() {
  Z.init();
  // ať mezerník/Enter ve hře znovu nestiskne tlačítko, které zůstalo zaměřené
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (UI.vybranyRezim === 'souboj') startSouboj(volbySouboje());
  else startKampan(Number($('odUrovne').value) || 0);
}
function doMenu() {
  UI.banner = null;
  UI.stav = 'menu';
  naplnUrovne();
  ukazPrekryv('menu');
  spustDemo();
}
function znovu() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  if (UI.rezim === 'kampan' || !UI.souboj) startKampan(Number($('odUrovne').value) || 0);
  else startSouboj(volbySouboje());
}
async function menuTlacitko() {
  if (UI.stav === 'menu') return;
  if (UI.stav === 'konec') { doMenu(); return; }
  const predtim = UI.stav;
  pauza(true);
  const ok = typeof Dialog !== 'undefined' ? await Dialog.potvrd('Ukončit rozehranou hru a vrátit se do menu?') : true;
  if (ok) doMenu();
  else if (predtim !== 'pauza' && UI.stav === 'pauza') UI.stav = UI.predPauzou;
}

/* ---------- dotyk ---------- */
function nastavDotyk() {
  const kriz = $('kriz'), bombaBtn = $('bombaBtn'), rozBtn = $('rozbuskaBtn');
  const smerZ = e => {
    const r = kriz.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.1) return -1;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  };
  let kId = null;
  kriz.addEventListener('pointerdown', e => { Z.init(); kId = e.pointerId; try { kriz.setPointerCapture(e.pointerId); } catch (_) { /* nevadí */ } dotyk.smer = smerZ(e); e.preventDefault(); });
  kriz.addEventListener('pointermove', e => { if (e.pointerId === kId) dotyk.smer = smerZ(e); });
  const pust = e => { if (e.pointerId === kId) { kId = null; dotyk.smer = -1; } };
  kriz.addEventListener('pointerup', pust); kriz.addEventListener('pointercancel', pust);
  bombaBtn.addEventListener('pointerdown', e => { Z.init(); dotyk.bomba = true; dotyk.bombaDrz = true; e.preventDefault(); });
  const pustB = () => { dotyk.bombaDrz = false; };
  bombaBtn.addEventListener('pointerup', pustB); bombaBtn.addEventListener('pointercancel', pustB); bombaBtn.addEventListener('pointerleave', pustB);
  rozBtn.addEventListener('pointerdown', e => { dotyk.rozbuska = true; e.preventDefault(); });
  // dlouhé podržení nesmí otevírat kontextové menu
  for (const el of [kriz, bombaBtn, rozBtn]) el.addEventListener('contextmenu', e => e.preventDefault());
}
function obnovZvuk() {
  const b = $('zvukBtn');
  b.textContent = Z.ticho() ? '🔇' : '🔊';
  b.title = Z.ticho() ? 'Zapnout zvuk (M)' : 'Vypnout zvuk (M)';
}

function init() {
  document.querySelectorAll('.karta').forEach(k => k.addEventListener('click', () => nastavRezim(k.dataset.rezim)));
  $('odUrovne').addEventListener('change', ukazNepratele);
  for (const id of ['pocetBotu', 'obtiznost', 'naVyhry', 'limitKola', 'dvaHraci', 'sDalkovou']) $(id).addEventListener('change', ulozVolby);
  $('startBtn').addEventListener('click', start);
  $('znovuBtn').addEventListener('click', znovu);
  $('doMenuBtn').addEventListener('click', doMenu);
  $('menuBtn').addEventListener('click', menuTlacitko);
  $('pauzaBtn').addEventListener('click', () => { Z.init(); prepniPauzu(); });
  $('zvukBtn').addEventListener('click', () => { Z.init(); Z.prepniTicho(); obnovZvuk(); });
  obnovZvuk();
  nastavRezim(nactiVolby() === 'souboj' ? 'souboj' : 'kampan');
  naplnUrovne();
  nastavDotyk();
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('dotykove');
  addEventListener('touchstart', () => {
    if (!document.body.classList.contains('dotykove')) { document.body.classList.add('dotykove'); rozmer(); }
  }, { once: true, passive: true });
  spustDemo();
  rozmer();
  setTimeout(rozmer, 300);          // podpis.js mění výšku stránky až po načtení
  requestAnimationFrame(t => { posl = t; smycka(t); });
}

B.UI = UI;
B.ui = { init, rozmer, vykresli, startKampan, startSouboj, doMenu, dotyk };
init();

})(BOMB);
