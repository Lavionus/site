/* ============================================================
   GENERÁTOR TISKU KARTIČEK – sdílený pro Tabu a Pantomimu
   Stránka zavolá KartickyTisk.pripoj({...}) a dostane panel
   s nastavením, náhledem listů a tiskem (window.print → i PDF).
   Rozměry se drží v milimetrech, velikost písma se dopočítá
   z šířky textu změřené na plátně (bez přeskládávání DOM),
   takže se dlouhá hesla zmenší a nepřetečou kartičku.
   Nastavení se ukládá do localStorage: webapp_karticky_<druh>.
   ============================================================ */
(function () {
'use strict';

const PAPIRY = {
  a4: { n: 'A4', w: 210, h: 297 },
  a3: { n: 'A3', w: 297, h: 420 },
  a5: { n: 'A5', w: 148, h: 210 },
  letter: { n: 'Letter', w: 215.9, h: 279.4 }
};
const FORMATY = {
  poker:   { w: 63, h: 88 },
  bridz:   { w: 57, h: 89 },
  a7:      { w: 74, h: 105 },
  tarot:   { w: 70, h: 120 },
  vizitka: { w: 85, h: 55 },
  mini:    { w: 44, h: 63 },
  vlastni: null
};
/* tmavší odstíny, aby na nich bílé písmo mělo dost kontrastu i po tisku */
const BARVY_KAT = ['#1f5fa8', '#b23a48', '#2e7d4f', '#7a4fb0', '#b8681b', '#127a7a', '#a33b8a',
  '#4f6b1f', '#8a5a2b', '#3a4fb8', '#a8321f', '#22704f', '#6b3fa0', '#8f6a00', '#2d6e9e', '#9c2f5e'];
const BARVY_OBT = { 1: '#2e7d4f', 2: '#c08a1e', 3: '#b1083a' };
const JAZYKY = { cs: '🇨🇿 Čeština', en: '🇬🇧 English' };
const NAHLED_LISTU = 8;   // víc listů se v náhledu nekreslí, tiskne se ale vše
const MM_PX = 96 / 25.4;

const TEXTY = {
  cs: {
    titul: '🖨️ Tisk kartiček', tisk: '🖨️ Tisknout / PDF', zavrit: '✕ Zavřít',
    obsah: 'Obsah', jazyk: 'Jazyk kartiček', kat: 'Kategorie', vse: 'vše', nic: 'nic', obt: 'Obtížnost',
    obtN: { 1: '● Lehká', 2: '●● Střední', 3: '●●● Těžká' },
    poradi: 'Pořadí', poradiM: { nahodne: 'Zamíchat', kategorie: 'Podle kategorií', abeceda: 'Abecedně' },
    znovu: '🔀 Zamíchat znovu', pocet: 'Počet kartiček (0 = všechny)', prazdne: 'Prázdné k dopsání',
    karta: 'Kartička', format: 'Formát', formatM: { poker: 'Hrací karta 63 × 88', bridz: 'Bridžová 57 × 89',
      a7: 'A7 74 × 105', tarot: 'Tarot 70 × 120', vizitka: 'Vizitka 85 × 55', mini: 'Mini 44 × 63', vlastni: 'Vlastní…' },
    sirka: 'Šířka mm', vyska: 'Výška mm', otocit: 'Otočit kartičku o 90°',
    dvojita: 'Dvě hesla na kartičku (horní vzhůru nohama)',
    pismo: 'Velikost písma', ukazKat: 'Kategorie na kartičce', ukazObt: 'Tečky obtížnosti',
    ukazNap: 'Nápověda k předvádění', barvy: 'Barvy', barvyM: { barva: 'Barevné', cb: 'Černobílé (úsporné)' },
    papir: 'Papír', papirF: 'Formát papíru', naSirku: 'Papír na šířku', okraj: 'Okraj mm', mezera: 'Mezera mm',
    rez: 'Ořez', rezM: { ramecek: 'Rámečky', znacky: 'Ořezové značky', obe: 'Rámečky i značky', nic: 'Nic' },
    rub: 'Rub (oboustranný tisk)', rubM: { ne: 'Bez rubu', dlouha: 'Překlápět podél dlouhé hrany', kratka: 'Překlápět podél krátké hrany' },
    rubNadpis: 'Nápis na rubu',
    info: (k, l, n, w, h) => `${k} kartiček · ${l} ${l === 1 ? 'list' : l < 5 ? 'listy' : 'listů'} · ${n} na list · ${w} × ${h} mm`,
    nahledJen: (a, b) => `Náhled ukazuje ${a} z ${b} listů, tisk obsahuje všechny.`,
    nevejde: 'Kartička se s tímto okrajem na papír nevejde.',
    prazdno: 'Výběr neobsahuje žádné heslo.',
    rada: 'V dialogu tisku nech měřítko 100 % (ne „Přizpůsobit“). PDF uložíš volbou „Uložit jako PDF“.',
    rubRada: 'Rub je vždy na sudé stránce – tiskni oboustranně se stejným překlápěním, jaké je zvolené tady.',
    tabuNazev: 'TABU', pantoNazev: 'PANTOMIMA'
  },
  en: {
    titul: '🖨️ Print cards', tisk: '🖨️ Print / PDF', zavrit: '✕ Close',
    obsah: 'Content', jazyk: 'Card language', kat: 'Categories', vse: 'all', nic: 'none', obt: 'Difficulty',
    obtN: { 1: '● Easy', 2: '●● Medium', 3: '●●● Hard' },
    poradi: 'Order', poradiM: { nahodne: 'Shuffled', kategorie: 'By category', abeceda: 'Alphabetical' },
    znovu: '🔀 Shuffle again', pocet: 'Number of cards (0 = all)', prazdne: 'Blank cards',
    karta: 'Card', format: 'Size', formatM: { poker: 'Poker 63 × 88', bridz: 'Bridge 57 × 89',
      a7: 'A7 74 × 105', tarot: 'Tarot 70 × 120', vizitka: 'Business card 85 × 55', mini: 'Mini 44 × 63', vlastni: 'Custom…' },
    sirka: 'Width mm', vyska: 'Height mm', otocit: 'Rotate card 90°',
    dvojita: 'Two words per card (top one upside down)',
    pismo: 'Font size', ukazKat: 'Category on card', ukazObt: 'Difficulty dots',
    ukazNap: 'Acting hint', barvy: 'Colours', barvyM: { barva: 'Colour', cb: 'Black & white (ink saver)' },
    papir: 'Paper', papirF: 'Paper size', naSirku: 'Landscape paper', okraj: 'Margin mm', mezera: 'Gap mm',
    rez: 'Cutting', rezM: { ramecek: 'Frames', znacky: 'Crop marks', obe: 'Frames and marks', nic: 'None' },
    rub: 'Back side (duplex)', rubM: { ne: 'No back', dlouha: 'Flip on long edge', kratka: 'Flip on short edge' },
    rubNadpis: 'Back text',
    info: (k, l, n, w, h) => `${k} cards · ${l} ${l === 1 ? 'sheet' : 'sheets'} · ${n} per sheet · ${w} × ${h} mm`,
    nahledJen: (a, b) => `Preview shows ${a} of ${b} sheets, printing includes all.`,
    nevejde: 'The card does not fit on the paper with this margin.',
    prazdno: 'The selection contains no words.',
    rada: 'Keep scale at 100 % in the print dialog (not “Fit”). Choose “Save as PDF” for a PDF file.',
    rubRada: 'Backs are on even pages – print duplex with the same flip edge as chosen here.',
    tabuNazev: 'TABOO', pantoNazev: 'CHARADES'
  }
};

const ZAKLAD = {
  tabu:      { format: 'poker',   w: 63, h: 88, otocit: false, dvojita: false },
  pantomima: { format: 'vizitka', w: 85, h: 55, otocit: false, dvojita: false }
};
function vychozi(druh) {
  return Object.assign({
    poradi: 'nahodne', pocet: 0, prazdne: 0, pismo: 100,
    ukazKat: true, ukazObt: true, ukazNap: true, barvy: 'barva',
    papir: 'a4', naSirku: false, okraj: 8, mezera: 0, rez: 'ramecek', rub: 'ne', rubText: ''
  }, ZAKLAD[druh]);
}

/* ---------- měření textu na plátně ---------- */
const platno = document.createElement('canvas').getContext('2d');
const mira = new Map();
let pismoRodina = 'sans-serif';
function sirka(text, styl) {          // šířka textu při písmu 100 jednotek
  const k = styl + '|' + text;
  let v = mira.get(k);
  if (v === undefined) {
    platno.font = `${styl} 100px ${pismoRodina}`;
    v = platno.measureText(text).width;
    mira.set(k, v);
  }
  return v;
}
/* největší velikost (mm), při které se text vejde do W × H na nejvýš maxRadku řádků */
function vejdeSe(text, styl, max, W, H, maxRadku, lh) {
  const slova = String(text).trim().split(/\s+/).filter(Boolean);
  if (!slova.length) return max;
  const ws = slova.map(s => sirka(s, styl)), mez = sirka(' ', styl);
  const Wb = W * 0.96;                       // rezerva na rozdíly mezi plátnem a sazbou
  for (let s = max; s > 1.2; s *= 0.95) {
    const k = s / 100;
    let radku = 1, rad = 0, ok = true;
    for (const w of ws) {
      const ww = w * k;
      if (ww > Wb) { ok = false; break; }
      if (rad === 0) rad = ww;
      else if (rad + mez * k + ww <= Wb) rad += mez * k + ww;
      else { radku++; rad = ww; }
    }
    if (ok && radku <= maxRadku && radku * s * lh <= H) return s;
  }
  return 1.2;
}

/* ---------- pomocné ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = n => (Math.round(n * 100) / 100) + 'mm';
function nahoda(seed) {               // mulberry32 – stejné semínko = stejné zamíchání
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const STYL = `
.kt-panel{position:fixed; inset:0; z-index:1000; background:var(--bg); color:var(--text); display:none; flex-direction:column; font-family:var(--font);}
.kt-panel.otevreno{display:flex;}
.kt-hlav{display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:10px 14px; background:var(--bg-elevated); border-bottom:1px solid var(--border);}
.kt-hlav h2{margin:0 auto 0 0; font-size:1.1rem;}
.kt-panel button{font-family:inherit; cursor:pointer; font-weight:600; color:var(--text); background:var(--bg-control);
  border:1px solid var(--border-strong); border-radius:6px; padding:8px 14px; font-size:.9rem;}
.kt-panel button:hover{background:var(--bg-hover);}
.kt-panel button.kt-hl{background:var(--accent); border-color:var(--accent); color:var(--on-accent, #fff);}
.kt-telo{flex:1; display:flex; min-height:0;}
.kt-boc{width:310px; flex:none; overflow-y:auto; padding:12px 14px 24px; border-right:1px solid var(--border); background:var(--bg-panel);}
.kt-boc fieldset{border:1px solid var(--border); border-radius:8px; margin:0 0 12px; padding:8px 10px 10px;}
.kt-boc legend{font-size:.75rem; font-weight:700; color:var(--accent); letter-spacing:.5px; text-transform:uppercase; padding:0 4px;}
.kt-boc label{display:flex; align-items:center; gap:6px; font-size:.84rem; margin:5px 0; color:var(--text);}
.kt-boc label.kt-sl{flex-direction:column; align-items:stretch; gap:3px; color:var(--text-muted); font-size:.78rem;}
.kt-boc select,.kt-boc input[type=number],.kt-boc input[type=text]{background:var(--bg-input); color:var(--text); border:1px solid var(--border-strong);
  border-radius:5px; padding:6px 7px; font:inherit; font-size:.86rem; width:100%; box-sizing:border-box;}
.kt-boc input[type=range]{width:100%;}
.kt-dva{display:grid; grid-template-columns:1fr 1fr; gap:8px;}
.kt-kats{max-height:190px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; padding:2px 8px; background:var(--bg-input);}
.kt-kats label{margin:3px 0;}
.kt-kats .kt-poc{margin-left:auto; color:var(--text-faint); font-size:.75rem;}
.kt-rychle{display:flex; gap:6px; margin:4px 0 6px;}
.kt-rychle button{padding:3px 10px; font-size:.75rem;}
.kt-obt{display:flex; gap:10px; flex-wrap:wrap;}
.kt-rada{font-size:.75rem; color:var(--text-faint); line-height:1.4; margin:6px 0 0;}
.kt-prava{flex:1; display:flex; flex-direction:column; min-width:0;}
.kt-info{padding:8px 14px; font-size:.84rem; color:var(--text-muted); border-bottom:1px solid var(--border);}
.kt-info .kt-chyba{color:var(--danger); font-weight:700;}
.kt-nahled{flex:1; overflow:auto; padding:16px; background:var(--bg-deep);}
.kt-list{position:relative; background:#fff; color:#111; margin:0 auto 16px; box-shadow:0 2px 12px rgba(0,0,0,.35); overflow:hidden;
  -webkit-print-color-adjust:exact; print-color-adjust:exact; font-family:var(--font);}
.kt-k{position:absolute; box-sizing:border-box; overflow:hidden; background:#fff;}
.kt-k.kt-ram{border:0.2mm solid #9a9a9a;}
.kt-zn{position:absolute; background:#555;}
.kt-pul{position:absolute; left:0; width:100%; overflow:hidden;}
.kt-pul.kt-obr{transform:rotate(180deg);}
.kt-abs{position:absolute; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.12; overflow:hidden; overflow-wrap:break-word;}
.kt-mal{position:absolute; font-weight:700; letter-spacing:.3mm; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.kt-tz{position:absolute; left:0; right:0; display:flex; align-items:center; justify-content:center; font-weight:700; white-space:nowrap;}
.kt-cara{position:absolute; border-bottom:0.25mm solid #999;}
@media (max-width:760px){
  .kt-telo{flex-direction:column; overflow-y:auto;}
  .kt-boc{width:auto; border-right:0; border-bottom:1px solid var(--border); overflow:visible;}
  .kt-prava{flex:none;}
  .kt-nahled{overflow:visible; padding:12px 8px;}
}
@media print{
  body.kt-tiskne{padding:0 !important; margin:0 !important; background:#fff !important; min-height:0 !important; display:block !important;}
  body.kt-tiskne > *:not(.kt-panel){display:none !important;}
  body.kt-tiskne .kt-panel{position:static; display:block; background:none;}
  body.kt-tiskne .kt-hlav, body.kt-tiskne .kt-boc, body.kt-tiskne .kt-info{display:none !important;}
  body.kt-tiskne .kt-telo, body.kt-tiskne .kt-prava{display:block;}
  body.kt-tiskne .kt-nahled{zoom:1 !important; padding:0; overflow:visible; background:none;}
  body.kt-tiskne .kt-list{margin:0; box-shadow:none; break-after:page; page-break-after:always;}
  body.kt-tiskne .kt-list:last-child{break-after:auto; page-break-after:auto;}
}`;

/* ============================================================
   VYKRESLENÍ JEDNÉ KARTIČKY (HTML řetězec, rozměry v mm)
   ============================================================ */
function barvaKat(n, poradiKat) {
  const i = poradiKat.indexOf(n);
  return BARVY_KAT[(i < 0 ? 0 : i) % BARVY_KAT.length];
}

/* Tabu: pruh s heslem nahoře, pod ním pět zakázaných slov */
function tabuPolovina(p, W, H, nast, ctx) {
  const s = nast.pismo / 100, cb = nast.barvy === 'cb';
  const pad = Math.max(2.2, Math.min(W, H) * 0.045);
  const pasH = H * 0.3;
  const barva = p ? barvaKat(p.cat, ctx.kategorie) : '#777';
  const malS = Math.min(2.5 * s, pasH * 0.16);
  const horni = (nast.ukazKat || nast.ukazObt) ? pad * 0.7 + malS * 1.2 : pad * 0.6;
  let h = '';
  const pasStyl = cb ? `background:#fff;border-bottom:0.6mm solid #111;color:#111` : `background:${barva};color:#fff`;
  h += `<div style="position:absolute;left:0;top:0;width:100%;height:${f(pasH)};${pasStyl}"></div>`;
  if (p && nast.ukazObt)
    h += `<div class="kt-mal" style="left:${f(pad)};top:${f(pad * 0.7)};font-size:${f(malS)};color:${cb ? '#111' : '#fff'}">${'●'.repeat(p.d)}</div>`;
  if (p && nast.ukazKat)
    h += `<div class="kt-mal" style="right:${f(pad)};top:${f(pad * 0.7)};max-width:${f(W * 0.62)};font-size:${f(malS)};color:${cb ? '#111' : '#fff'};opacity:.92">${esc(p.cat)}</div>`;
  const slH = pasH - horni - pad * 0.5, slW = W - 2 * pad;
  if (p) {
    const vel = vejdeSe(p.w, '800', 8.5 * s, slW, slH, 2, 1.12);
    h += `<div class="kt-abs" style="left:${f(pad)};top:${f(horni)};width:${f(slW)};height:${f(slH)};font-size:${f(vel)};font-weight:800;color:${cb ? '#111' : '#fff'}">${esc(p.w)}</div>`;
  }
  // zakázaná slova
  const sezTop = pasH + pad * 0.6, sezH = H - sezTop - pad * 0.7;
  const radH = sezH / 5;
  if (p) {
    let vel = Math.min(radH * 0.62, 5 * s);
    for (const t of p.t) vel = Math.min(vel, vejdeSe(t, '700', vel, slW, radH, 1, 1));
    p.t.forEach((t, i) => {
      h += `<div class="kt-tz" style="top:${f(sezTop + i * radH)};height:${f(radH)};font-size:${f(vel)};color:${cb ? '#111' : '#2a2a2a'}">${esc(t)}</div>`;
    });
  } else {
    for (let i = 0; i < 5; i++)
      h += `<div class="kt-cara" style="left:${f(pad * 2)};right:${f(pad * 2)};top:${f(sezTop + (i + 0.8) * radH - 0.3)}"></div>`;
    h += `<div class="kt-cara" style="left:${f(pad * 2)};right:${f(pad * 2)};top:${f(pasH * 0.72)};border-color:${cb ? '#999' : 'rgba(255,255,255,.7)'}"></div>`;
  }
  return h;
}

/* Pantomima: barevný proužek, heslo uprostřed, pod ním nápověda */
function pantoKarta(p, W, H, nast, ctx) {
  const s = nast.pismo / 100, cb = nast.barvy === 'cb';
  const pad = Math.max(2.2, Math.min(W, H) * 0.05);
  const barva = p ? barvaKat(p.cat, ctx.kategorie) : '#777';
  const prouzek = cb ? 0 : Math.max(1.6, H * 0.04);
  const malS = Math.min(2.5 * s, H * 0.06);
  let h = '';
  if (!cb) h += `<div style="position:absolute;left:0;top:0;width:100%;height:${f(prouzek)};background:${barva}"></div>`;
  const horni = prouzek + pad * 0.6;
  if (p && nast.ukazObt)
    h += `<div class="kt-mal" style="left:${f(pad)};top:${f(horni)};font-size:${f(malS)};color:${cb ? '#111' : BARVY_OBT[p.d]}">${'●'.repeat(p.d)}</div>`;
  if (p && nast.ukazKat)
    h += `<div class="kt-mal" style="right:${f(pad)};top:${f(horni)};max-width:${f(W * 0.62)};font-size:${f(malS)};color:${cb ? '#111' : barva}">${esc(p.cat)}</div>`;
  const top = horni + malS * 1.3 + pad * 0.3, W2 = W - 2 * pad, zbyva = H - top - pad;
  const napoveda = p && nast.ukazNap && p.hint;
  const slH = napoveda ? zbyva * 0.5 : zbyva;
  if (p) {
    const vel = vejdeSe(p.w, '800', 10 * s, W2, slH, 2, 1.12);
    h += `<div class="kt-abs" style="left:${f(pad)};top:${f(top)};width:${f(W2)};height:${f(slH)};font-size:${f(vel)};font-weight:800;color:#111">${esc(p.w)}</div>`;
    if (napoveda) {
      const nH = zbyva - slH;
      const nv = vejdeSe(p.hint, 'italic 400', 3.4 * s, W2, nH, 5, 1.2);
      h += `<div class="kt-abs" style="left:${f(pad)};top:${f(top + slH)};width:${f(W2)};height:${f(nH)};font-size:${f(nv)};line-height:1.2;font-style:italic;color:#444;align-items:flex-start">${esc(p.hint)}</div>`;
    }
  } else {
    h += `<div class="kt-cara" style="left:${f(pad * 2)};right:${f(pad * 2)};top:${f(top + slH * 0.55)}"></div>`;
  }
  return h;
}

function rubKarta(W, H, nast, ctx) {
  const cb = nast.barvy === 'cb';
  const text = nast.rubText.trim() || ctx.nazev;
  const pad = Math.min(W, H) * 0.07;
  const vel = vejdeSe(text, '800', Math.min(W, H) * 0.2, W - 4 * pad, H * 0.3, 2, 1.1);
  const emo = Math.min(W, H) * 0.24;
  const pozadi = cb
    ? 'background:#fff'
    : `background:repeating-linear-gradient(45deg, ${ctx.barva} 0 2.2mm, ${ctx.barva2} 2.2mm 4.4mm)`;
  return `<div style="position:absolute;inset:0;${pozadi}"></div>
    <div style="position:absolute;left:${f(pad)};top:${f(pad)};right:${f(pad)};bottom:${f(pad)};border:0.6mm solid ${cb ? '#111' : '#fff'};
      border-radius:2mm;background:${cb ? '#fff' : ctx.barva};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1mm">
      <div style="font-size:${f(emo)};line-height:1">${ctx.emoji}</div>
      <div style="font-size:${f(vel)};font-weight:800;letter-spacing:.4mm;color:${cb ? '#111' : '#fff'};text-align:center;line-height:1.1;padding:0 1mm">${esc(text)}</div>
    </div>`;
}

function kartaHTML(p, p2, W, H, nast, ctx) {
  if (ctx.druh === 'pantomima') return pantoKarta(p, W, H, nast, ctx);
  if (!nast.dvojita) return tabuPolovina(p, W, H, nast, ctx);
  const h2 = H / 2;
  return `<div class="kt-pul kt-obr" style="top:0;height:${f(h2)}">${tabuPolovina(p2, W, h2, nast, ctx)}</div>
    <div style="position:absolute;left:4%;right:4%;top:${f(h2)};border-top:0.2mm dashed #bbb"></div>
    <div class="kt-pul" style="top:${f(h2)};height:${f(h2)}">${tabuPolovina(p, W, h2, nast, ctx)}</div>`;
}

/* ============================================================
   ROZLOŽENÍ NA LISTY
   ============================================================ */
function rozloz(nast) {
  const pap = PAPIRY[nast.papir] || PAPIRY.a4;
  const pw = nast.naSirku ? pap.h : pap.w, ph = nast.naSirku ? pap.w : pap.h;
  let w = +nast.w || 63, h = +nast.h || 88;
  if (nast.otocit) [w, h] = [h, w];
  const m = Math.max(0, +nast.okraj || 0), g = Math.max(0, +nast.mezera || 0);
  const sl = Math.floor((pw - 2 * m + g) / (w + g)), ra = Math.floor((ph - 2 * m + g) / (h + g));
  const gw = sl * w + (sl - 1) * g, gh = ra * h + (ra - 1) * g;
  return { pw, ph, w, h, g, sl, ra, ox: (pw - gw) / 2, oy: (ph - gh) / 2, gw, gh };
}

function znackyHTML(L) {
  // krátké čáry v okraji na prodloužení hran karet
  const del = Math.min(5, L.ox - 1, L.oy - 1);
  if (del < 1.5) return '';
  const xs = new Set(), ys = new Set();
  for (let c = 0; c < L.sl; c++) { xs.add(L.ox + c * (L.w + L.g)); xs.add(L.ox + c * (L.w + L.g) + L.w); }
  for (let r = 0; r < L.ra; r++) { ys.add(L.oy + r * (L.h + L.g)); ys.add(L.oy + r * (L.h + L.g) + L.h); }
  const t = 0.2, mez = 1;
  let h = '';
  xs.forEach(x => {
    h += `<div class="kt-zn" style="left:${f(x - t / 2)};top:${f(L.oy - mez - del)};width:${f(t)};height:${f(del)}"></div>`;
    h += `<div class="kt-zn" style="left:${f(x - t / 2)};top:${f(L.oy + L.gh + mez)};width:${f(t)};height:${f(del)}"></div>`;
  });
  ys.forEach(y => {
    h += `<div class="kt-zn" style="top:${f(y - t / 2)};left:${f(L.ox - mez - del)};height:${f(t)};width:${f(del)}"></div>`;
    h += `<div class="kt-zn" style="top:${f(y - t / 2)};left:${f(L.ox + L.gw + mez)};height:${f(t)};width:${f(del)}"></div>`;
  });
  return h;
}

/* ============================================================
   PANEL
   ============================================================ */
function pripoj(cfg) {
  const druh = cfg.druh;
  const KLIC = 'webapp_karticky_' + druh;
  let nast = vychozi(druh);
  try { Object.assign(nast, JSON.parse(localStorage.getItem(KLIC)) || {}); } catch (e) { }
  let semeno = (Math.random() * 1e9) | 0;
  let vybKat = new Set(), vybObt = new Set([1, 2, 3]);
  let lang = 'cs', otevreno = false, casovac = null;
  let jazykDat = 'cs';     // jazyk tištěných hesel, nezávislý na jazyku rozhraní

  if (!document.getElementById('kt-styl')) {
    const st = document.createElement('style'); st.id = 'kt-styl'; st.textContent = STYL;
    document.head.appendChild(st);
  }
  const strankaStyl = document.createElement('style'); document.head.appendChild(strankaStyl);
  const panel = document.createElement('div');
  panel.className = 'kt-panel';
  document.body.appendChild(panel);

  const T = () => TEXTY[lang] || TEXTY.cs;
  const uloz = () => { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { } };
  const $ = s => panel.querySelector(s);

  function stavba() {
    const t = T();
    const opt = (m, v) => Object.entries(m).map(([k, n]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const chk = (k, n) => `<label><input type="checkbox" data-k="${k}"${nast[k] ? ' checked' : ''}> ${esc(n)}</label>`;
    const cis = (k, n, min, max, krok) => `<label class="kt-sl">${esc(n)}<input type="number" data-k="${k}" min="${min}" max="${max}" step="${krok}" value="${nast[k]}"></label>`;
    panel.innerHTML = `
      <div class="kt-hlav"><h2>${t.titul}</h2>
        <button class="kt-hl" data-a="tisk">${t.tisk}</button><button data-a="zavrit">${t.zavrit}</button></div>
      <div class="kt-telo">
        <div class="kt-boc">
          <fieldset><legend>${t.obsah}</legend>
            <label class="kt-sl">${t.jazyk}<select data-a="jazyk">${Object.entries(JAZYKY).map(([k, n]) => `<option value="${k}"${k === jazykDat ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
            <div style="font-size:.78rem;color:var(--text-muted)">${t.kat}</div>
            <div class="kt-rychle"><button data-a="vse">${t.vse}</button><button data-a="nic">${t.nic}</button></div>
            <div class="kt-kats"></div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:8px">${t.obt}</div>
            <div class="kt-obt">${[1, 2, 3].map(d => `<label><input type="checkbox" data-obt="${d}"${vybObt.has(d) ? ' checked' : ''}> ${t.obtN[d]}</label>`).join('')}</div>
            <label class="kt-sl">${t.poradi}<select data-k="poradi">${opt(t.poradiM, nast.poradi)}</select></label>
            <button data-a="znovu" style="width:100%;margin-top:6px">${t.znovu}</button>
            <div class="kt-dva" style="margin-top:6px">${cis('pocet', t.pocet, 0, 99999, 1)}${cis('prazdne', t.prazdne, 0, 500, 1)}</div>
          </fieldset>
          <fieldset><legend>${t.karta}</legend>
            <label class="kt-sl">${t.format}<select data-k="format">${opt(t.formatM, nast.format)}</select></label>
            <div class="kt-dva">${cis('w', t.sirka, 20, 400, 0.5)}${cis('h', t.vyska, 20, 400, 0.5)}</div>
            ${chk('otocit', t.otocit)}
            ${druh === 'tabu' ? chk('dvojita', t.dvojita) : ''}
            <label class="kt-sl">${t.pismo} <span class="kt-pv">${nast.pismo} %</span><input type="range" data-k="pismo" min="60" max="140" step="5" value="${nast.pismo}"></label>
            ${chk('ukazKat', t.ukazKat)}${chk('ukazObt', t.ukazObt)}${druh === 'pantomima' ? chk('ukazNap', t.ukazNap) : ''}
            <label class="kt-sl">${t.barvy}<select data-k="barvy">${opt(t.barvyM, nast.barvy)}</select></label>
          </fieldset>
          <fieldset><legend>${t.papir}</legend>
            <label class="kt-sl">${t.papirF}<select data-k="papir">${opt(Object.fromEntries(Object.entries(PAPIRY).map(([k, v]) => [k, v.n])), nast.papir)}</select></label>
            ${chk('naSirku', t.naSirku)}
            <div class="kt-dva">${cis('okraj', t.okraj, 0, 50, 0.5)}${cis('mezera', t.mezera, 0, 30, 0.5)}</div>
            <label class="kt-sl">${t.rez}<select data-k="rez">${opt(t.rezM, nast.rez)}</select></label>
            <label class="kt-sl">${t.rub}<select data-k="rub">${opt(t.rubM, nast.rub)}</select></label>
            <label class="kt-sl">${t.rubNadpis}<input type="text" data-k="rubText" maxlength="40" placeholder="${esc(cfg.nazev(jazykDat))}" value="${esc(nast.rubText)}"></label>
            <p class="kt-rada">${t.rada}</p><p class="kt-rada kt-rubrada"${nast.rub === 'ne' ? ' hidden' : ''}>${t.rubRada}</p>
          </fieldset>
        </div>
        <div class="kt-prava"><div class="kt-info"></div><div class="kt-nahled"></div></div>
      </div>`;
    kategorieSeznam();
    panel.querySelectorAll('[data-k]').forEach(el => el.addEventListener(el.type === 'range' || el.type === 'text' || el.type === 'number' ? 'input' : 'change', () => zmena(el)));
    panel.querySelectorAll('[data-obt]').forEach(el => el.addEventListener('change', () => {
      const d = +el.dataset.obt;
      el.checked ? vybObt.add(d) : vybObt.delete(d);
      kategorieSeznam(); prekresli();
    }));
    panel.querySelector('[data-a="tisk"]').onclick = tiskni;
    panel.querySelector('[data-a="zavrit"]').onclick = zavri;
    panel.querySelector('[data-a="znovu"]').onclick = () => { semeno = (Math.random() * 1e9) | 0; if (nast.poradi !== 'nahodne') { nast.poradi = 'nahodne'; $('[data-k="poradi"]').value = 'nahodne'; uloz(); } prekresli(); };
    panel.querySelector('[data-a="vse"]').onclick = () => { vybKat = new Set(cfg.kategorie(jazykDat)); kategorieSeznam(); prekresli(); };
    panel.querySelector('[data-a="jazyk"]').onchange = e => {
      jazykDat = e.target.value; vybKat = new Set(cfg.kategorie(jazykDat));
      $('[data-k="rubText"]').placeholder = cfg.nazev(jazykDat);
      kategorieSeznam(); prekresli();
    };
    panel.querySelector('[data-a="nic"]').onclick = () => { vybKat = new Set(); kategorieSeznam(); prekresli(); };
  }

  function kategorieSeznam() {
    const box = $('.kt-kats');
    const vse = cfg.polozky(jazykDat);
    box.innerHTML = cfg.kategorie(jazykDat).map(k => {
      const n = vse.filter(p => p.cat === k && vybObt.has(p.d)).length;
      return `<label><input type="checkbox" data-kat="${esc(k)}"${vybKat.has(k) ? ' checked' : ''}> ${esc(k)}<span class="kt-poc">${n}</span></label>`;
    }).join('');
    box.querySelectorAll('[data-kat]').forEach(el => el.addEventListener('change', () => {
      el.checked ? vybKat.add(el.dataset.kat) : vybKat.delete(el.dataset.kat); prekresli();
    }));
  }

  function zmena(el) {
    const k = el.dataset.k;
    if (el.type === 'checkbox') nast[k] = el.checked;
    else if (el.type === 'number' || el.type === 'range') nast[k] = el.value === '' ? 0 : +el.value;
    else nast[k] = el.value;
    if (k === 'format' && FORMATY[nast.format]) {
      nast.w = FORMATY[nast.format].w; nast.h = FORMATY[nast.format].h;
      $('[data-k="w"]').value = nast.w; $('[data-k="h"]').value = nast.h;
    }
    if (k === 'w' || k === 'h') {         // ruční rozměr = vlastní formát
      const shoda = Object.entries(FORMATY).find(([, v]) => v && v.w === nast.w && v.h === nast.h);
      nast.format = shoda ? shoda[0] : 'vlastni'; $('[data-k="format"]').value = nast.format;
    }
    if (k === 'pismo') $('.kt-pv').textContent = nast.pismo + ' %';
    if (k === 'rub') $('.kt-rubrada').hidden = nast.rub === 'ne';
    uloz();
    clearTimeout(casovac); casovac = setTimeout(prekresli, el.type === 'text' || el.type === 'number' ? 250 : 60);
  }

  function balicek() {
    let pol = cfg.polozky(jazykDat).filter(p => vybKat.has(p.cat) && vybObt.has(p.d));
    const kat = cfg.kategorie(jazykDat);
    if (nast.poradi === 'abeceda') pol.sort((a, b) => a.w.localeCompare(b.w, jazykDat));
    else if (nast.poradi === 'kategorie') pol.sort((a, b) => kat.indexOf(a.cat) - kat.indexOf(b.cat) || a.d - b.d || a.w.localeCompare(b.w, jazykDat));
    else {
      const r = nahoda(semeno);
      for (let i = pol.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pol[i], pol[j]] = [pol[j], pol[i]]; }
    }
    if (nast.pocet > 0) pol = pol.slice(0, nast.pocet);
    // u dvojitých tabu karet připadají dvě hesla na kartičku
    const karty = [];
    if (druh === 'tabu' && nast.dvojita) for (let i = 0; i < pol.length; i += 2) karty.push([pol[i], pol[i + 1] || null]);
    else pol.forEach(p => karty.push([p, null]));
    for (let i = 0; i < Math.max(0, nast.prazdne | 0); i++) karty.push([null, null]);
    return { karty, hesel: pol.length };
  }

  function listyHTML(L, karty, maxListu) {
    const ctx = {
      druh, kategorie: cfg.kategorie(jazykDat), nazev: cfg.nazev(jazykDat), emoji: cfg.emoji,
      barva: nast.barvy === 'cb' ? '#fff' : (druh === 'tabu' ? '#b1083a' : '#1f5fa8'),
      barva2: druh === 'tabu' ? '#8e062e' : '#184c86'
    };
    const naList = L.sl * L.ra, listu = Math.ceil(karty.length / naList);
    const ram = nast.rez === 'ramecek' || nast.rez === 'obe', zn = nast.rez === 'znacky' || nast.rez === 'obe';
    const znacky = zn ? znackyHTML(L) : '';
    const list = obsah => `<div class="kt-list" style="width:${f(L.pw)};height:${f(L.ph - 0.3)}">${obsah}${znacky}</div>`;
    const pozice = (r, c) => `left:${f(L.ox + c * (L.w + L.g))};top:${f(L.oy + r * (L.h + L.g))};width:${f(L.w)};height:${f(L.h)}`;
    let rub = null;
    let out = '';
    for (let li = 0; li < Math.min(listu, maxListu); li++) {
      let lic = '', ruby = '';
      for (let i = 0; i < naList; i++) {
        const k = karty[li * naList + i];
        if (!k) break;
        const r = Math.floor(i / L.sl), c = i % L.sl;
        lic += `<div class="kt-k${ram ? ' kt-ram' : ''}" style="${pozice(r, c)}">${kartaHTML(k[0], k[1], L.w, L.h, nast, ctx)}</div>`;
        if (nast.rub !== 'ne') {
          if (rub === null) rub = rubKarta(L.w, L.h, nast, ctx);
          // rub se zrcadlí podle hrany, přes kterou tiskárna list překlápí
          const rr = nast.rub === 'kratka' ? L.ra - 1 - r : r, cc = nast.rub === 'dlouha' ? L.sl - 1 - c : c;
          ruby += `<div class="kt-k${ram ? ' kt-ram' : ''}" style="${pozice(rr, cc)}">${rub}</div>`;
        }
      }
      out += list(lic);
      if (nast.rub !== 'ne') out += list(ruby);
    }
    return { html: out, listu: listu * (nast.rub !== 'ne' ? 2 : 1) };
  }

  function prekresli(vse) {
    if (!otevreno) return;
    pismoRodina = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const t = T(), L = rozloz(nast), info = $('.kt-info'), nah = $('.kt-nahled');
    strankaStyl.textContent = `@page{size:${L.pw}mm ${L.ph}mm;margin:0}`;
    if (L.sl < 1 || L.ra < 1) { info.innerHTML = `<span class="kt-chyba">${t.nevejde}</span>`; nah.innerHTML = ''; return false; }
    const { karty, hesel } = balicek();
    if (!karty.length) { info.innerHTML = `<span class="kt-chyba">${t.prazdno}</span>`; nah.innerHTML = ''; return false; }
    const naList = L.sl * L.ra;
    // s rubem tvoří lícový a rubový list dvojici
    const { html, listu } = listyHTML(L, karty, vse ? Infinity : Math.ceil(NAHLED_LISTU / (nast.rub !== 'ne' ? 2 : 1)));
    nah.innerHTML = html;
    const zobrazeno = nah.children.length;
    info.innerHTML = esc(t.info(karty.length, listu, naList, +L.w.toFixed(1), +L.h.toFixed(1)))
      + (druh === 'tabu' && nast.dvojita ? ` · ${hesel} ${lang === 'cs' ? 'hesel' : 'words'}` : '')
      + (zobrazeno < listu ? `<br>${esc(t.nahledJen(zobrazeno, listu))}` : '');
    priblizeni(L);
    return true;
  }

  function priblizeni(L) {
    const nah = $('.kt-nahled');
    const dost = nah.clientWidth - 24;
    const z = Math.min(1, Math.max(0.2, dost / (L.pw * MM_PX)));
    nah.style.zoom = z;
  }

  function tiskni() {
    if (!prekresli(true)) return;
    document.body.classList.add('kt-tiskne');
    const hotovo = () => { document.body.classList.remove('kt-tiskne'); window.removeEventListener('afterprint', hotovo); prekresli(); };
    window.addEventListener('afterprint', hotovo);
    window.print();
    // Chromium blokuje během dialogu; kdyby afterprint nepřišel, uklidí se tady
    setTimeout(() => { if (document.body.classList.contains('kt-tiskne') && !window.matchMedia('print').matches) hotovo(); }, 1500);
  }

  function otevri() {
    lang = cfg.jazyk();
    jazykDat = lang;
    const v = cfg.vyber ? cfg.vyber() : null;
    vybKat = new Set(v && v.kat ? v.kat : cfg.kategorie(jazykDat));
    vybObt = new Set(v && v.obt ? v.obt : [1, 2, 3]);
    otevreno = true;
    stavba();
    panel.classList.add('otevreno');
    document.body.style.overflow = 'hidden';
    prekresli();
  }
  function zavri() {
    otevreno = false;
    panel.classList.remove('otevreno');
    document.body.style.overflow = '';
    $('.kt-nahled') && ($('.kt-nahled').innerHTML = '');
  }

  // dokud je panel otevřený, klávesy nepatří hře (mezera = další slovo apod.)
  window.addEventListener('keydown', e => {
    if (!otevreno) return;
    if (e.key === 'Escape') zavri();
    e.stopImmediatePropagation();
  }, true);
  window.addEventListener('resize', () => { if (otevreno) priblizeni(rozloz(nast)); });

  if (cfg.tlacitko) cfg.tlacitko.addEventListener('click', otevri);
  return { otevri, zavri };
}

window.KartickyTisk = { pripoj, _vejdeSe: vejdeSe, _rozloz: rozloz };
})();
