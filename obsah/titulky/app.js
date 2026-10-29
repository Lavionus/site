/* ============================================================
   titulky/app.js – uživatelské rozhraní Editoru titulků.
   Jádro (formáty, kódování, přečasování, kontroly) je v jadro.js.
   ============================================================ */
(function () {
'use strict';
const T = window.TITULKY;
const MB = window.Mediabunny || null;
const $ = id => document.getElementById(id);
const video = $('video');
const LS = 'webapp_titulky_';
const DB_NAZEV = 'webapp_titulky';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const F = ms => T.formatCas(ms, 'srt');
const Fl = ms => T.formatCas(ms, 'lidsky');
const lsCti = (k, v) => { try { const x = localStorage.getItem(LS + k); return x == null ? v : JSON.parse(x); } catch { return v; } };
const lsPis = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {} };
const oznam = (t, chyba) => window.Dialog ? (chyba ? Dialog.chyba(t) : Dialog.info(t)) : console.log(t);

function prazdnyProjekt() {
  return { format: 'srt', titulky: [], styly: [T.vychoziStyl(1080)], info: { PlayResX: 1920, PlayResY: 1080 }, fps: 25, nazev: 'titulky' };
}
const S = {
  p: prazdnyProjekt(),
  vyber: new Set(), akt: null, index: new Map(), kontrola: [],
  undo: [], redo: [], sloucit: null, sloucitCas: 0,
  surove: null, surNazev: '', kodovani: '',
  video: null, vlna: null, vlnaKrok: 0.01, vlnaMax: 1, videoFps: 0, gen: 0,
  osa: { od: 0, rozsah: 20000 }, kurzor: 0, zastavV: null, tah: null,
  limity: Object.assign({}, T.LIMITY, lsCti('limity', {})),
  nast: Object.assign({ jenProblemy: false, sledovat: true, vyberSleduje: true, bom: false, crlf: true, fpsRadek: false, export: 'srt' }, lsCti('nastaveni', {})),
  prepis: false, prepisZac: null, prepisPauza: false,
  vypalovani: null,
};
const ulozNast = () => lsPis('nastaveni', S.nast);

// ============================================================
//  ČAS A PŘEHRÁVÁNÍ
// ============================================================
const maVideo = () => !!S.video && isFinite(video.duration);
const ted = () => maVideo() ? Math.round(video.currentTime * 1000) : S.kurzor;
function celkem() {
  const p = S.p.titulky;
  return Math.max(maVideo() ? video.duration * 1000 : 0, p.length ? p[p.length - 1].do + 3000 : 0, 10000);
}
function skoc(ms) {
  ms = Math.max(0, Math.round(ms));
  if (maVideo()) { ms = Math.min(ms, video.duration * 1000); video.currentTime = ms / 1000; }
  S.kurzor = ms;
  obnovZobrazeniCasu();
}
function hraj() {
  if (!maVideo()) return oznam('Nejdřív otevřete video nebo zvuk.');
  if (video.paused) { S.zastavV = null; video.play().catch(() => {}); } else video.pause();
}

// ============================================================
//  ZMĚNY, ZPĚT/ZNOVU
// ============================================================
const snimek = () => JSON.stringify({ t: S.p.titulky, s: S.p.styly, i: S.p.info });
function ulozUndo(sloucit) {
  const now = Date.now();
  if (sloucit && S.sloucit === sloucit && now - S.sloucitCas < 1500) { S.sloucitCas = now; return; }
  S.undo.push(snimek()); if (S.undo.length > 80) S.undo.shift();
  S.redo = []; S.sloucit = sloucit || null; S.sloucitCas = now;
}
function zmena(fn, sloucit, jenRadek) {
  ulozUndo(sloucit);
  fn();
  poZmene(jenRadek);
}
function obnov(sn) {
  const o = JSON.parse(sn);
  S.p.titulky = o.t; S.p.styly = o.s; S.p.info = o.i || S.p.info;
  T.nastavId(Math.max(0, ...S.p.titulky.map(t => t.id)) + 1);
  const ids = new Set(S.p.titulky.map(t => t.id));
  S.vyber = new Set([...S.vyber].filter(id => ids.has(id)));
  if (!ids.has(S.akt)) S.akt = S.p.titulky[0] ? S.p.titulky[0].id : null;
  S.sloucit = null;
  poZmene();
}
function zpet() { if (!S.undo.length) return oznam('Není co vrátit.'); S.redo.push(snimek()); obnov(S.undo.pop()); }
function znovu() { if (!S.redo.length) return oznam('Není co opakovat.'); S.undo.push(snimek()); obnov(S.redo.pop()); }

/** Po každé změně dat: seřadit, kontrola, překreslit, naplánovat uložení. jenRadek = id → bez přestavby tabulky. */
function poZmene(jenRadek) {
  T.serad(S.p.titulky);
  S.index = new Map(S.p.titulky.map((t, i) => [t.id, i]));
  S.kontrola = T.kontrola(S.p.titulky, S.limity);
  if (jenRadek && S.index.has(jenRadek) && !S.nast.jenProblemy) aktualizujRadek(jenRadek);
  else vykresliTabulku();
  vykresliEditor();
  obnovStav();
  kresliOsu(); kresliNahled();
  naplanujUlozeni();
}
const aktT = () => S.index.has(S.akt) ? S.p.titulky[S.index.get(S.akt)] : null;

// ============================================================
//  TABULKA
// ============================================================
const tbody = $('tbody');
function textRadku(t) {
  const an = T.zarovnaniZTextu(t.text);
  return (an && an >= 7 ? '<span class="zl" title="nahoře">⬆</span>' : '') + T.htmlNahled(t.text).replace(/<br>/g, ' <span class="zl">↵</span> ');
}
function radekHtml(t, i) {
  const pr = S.kontrola[i] || [];
  const ch = pr.some(x => x.chyba);
  const c = T.cps(t);
  const cpsT = isFinite(c) ? c.toFixed(1) : '∞';
  const tridy = [S.vyber.has(t.id) ? 'vybrany' : '', t.id === S.akt ? 'aktivni' : ''].join(' ');
  return `<tr data-id="${t.id}" class="${tridy}"><td class="p">${pr.length ? `<span class="ikona-pr${ch ? ' chyba' : ''}" title="${esc(pr.map(x => x.text).join(', '))}"></span>` : ''}</td>` +
    `<td class="n">${i + 1}</td><td class="c">${F(t.od)}</td><td class="c">${F(t.do)}</td>` +
    `<td class="c d${t.do - t.od < S.limity.minDelka || t.do - t.od > S.limity.maxDelka ? ' spatne' : ''}">${((t.do - t.od) / 1000).toFixed(2)}</td>` +
    `<td class="c cps${c > S.limity.maxCps ? ' spatne' : ''}">${cpsT}</td><td class="t">${textRadku(t)}</td></tr>`;
}
function vykresliTabulku() {
  const h = [];
  S.p.titulky.forEach((t, i) => { if (!S.nast.jenProblemy || S.kontrola[i].length) h.push(radekHtml(t, i)); });
  tbody.innerHTML = h.join('');
  $('prazdne').hidden = S.p.titulky.length > 0;
  if (S.nast.jenProblemy && S.p.titulky.length && !h.length) $('prazdne').hidden = false, $('prazdne').textContent = 'Žádné problémy – výborně.';
  else $('prazdne').innerHTML = 'Zatím žádné titulky. Otevřete soubor, vložte text, nebo zapněte <b>⌨ Přepis</b> a pište během přehrávání.';
}
function aktualizujRadek(id) {
  const tr = tbody.querySelector(`tr[data-id="${id}"]`);
  const i = S.index.get(id);
  if (!tr || i == null) return vykresliTabulku();
  tr.outerHTML = radekHtml(S.p.titulky[i], i);
}
function oznacRadky(posun) {
  for (const tr of tbody.rows) {
    const id = +tr.dataset.id;
    tr.classList.toggle('vybrany', S.vyber.has(id));
    tr.classList.toggle('aktivni', id === S.akt);
  }
  if (posun) {
    const tr = tbody.querySelector(`tr[data-id="${S.akt}"]`);
    if (tr) tr.scrollIntoView({ block: 'nearest' });
  }
}
function vyber(id, { pridat = false, rozsah = false, skok = true, posun = true } = {}) {
  if (id == null) return;
  if (rozsah && S.akt != null && S.index.has(S.akt)) {
    const a = S.index.get(S.akt), b = S.index.get(id);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) S.vyber.add(S.p.titulky[i].id);
  } else if (pridat) { S.vyber.has(id) ? S.vyber.delete(id) : S.vyber.add(id); }
  else S.vyber = new Set([id]);
  S.akt = id;
  oznacRadky(posun);
  vykresliEditor();
  const t = aktT();
  if (skok && t && (!maVideo() || video.paused)) skoc(t.od);
  else { kresliOsu(); }
  if (t) osaUkaz(t.od, t.do);
}
tbody.addEventListener('click', e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  vyber(+tr.dataset.id, { pridat: e.ctrlKey || e.metaKey, rozsah: e.shiftKey, posun: false });
});
tbody.addEventListener('dblclick', e => { if (e.target.closest('tr')) { $('edText').focus(); } });

// ============================================================
//  EDITOR VYBRANÉHO TITULKU
// ============================================================
const edOd = $('edOd'), edDo = $('edDo'), edDelka = $('edDelka'), edText = $('edText'), edStyl = $('edStyl');
function vykresliEditor() {
  const t = aktT();
  const n = S.p.titulky.length;
  $('edPocet').textContent = `${n} ${n === 1 ? 'titulek' : n >= 2 && n <= 4 ? 'titulky' : 'titulků'}${S.vyber.size > 1 ? ` · vybráno ${S.vyber.size}` : ''}`;
  for (const el of [edOd, edDo, edDelka, edText, edStyl]) el.disabled = !t;
  if (!t) {
    $('edCislo').textContent = ''; edOd.value = edDo.value = edDelka.value = edText.value = '';
    $('edInfo').textContent = 'Vyberte titulek v tabulce nebo na ose.'; $('edProblemy').innerHTML = '';
    return;
  }
  const i = S.index.get(t.id);
  $('edCislo').textContent = '#' + (i + 1);
  const akt = document.activeElement;
  if (akt !== edOd) edOd.value = F(t.od);
  if (akt !== edDo) edDo.value = F(t.do);
  if (akt !== edDelka) edDelka.value = ((t.do - t.od) / 1000).toFixed(3);
  if (akt !== edText) edText.value = t.text;
  $('edStylObal').hidden = S.p.styly.length < 2;
  if (S.p.styly.length > 1) {
    edStyl.innerHTML = S.p.styly.map(s => `<option${s.nazev === t.styl ? ' selected' : ''}>${esc(s.nazev)}</option>`).join('');
  }
  const radky = T.viditelny(t.text).split('\n');
  const c = T.cps(t);
  $('edInfo').innerHTML = `Řádky: ${radky.map(r => `<span class="${r.length > S.limity.maxRadek ? 'spatne' : ''}">${r.length}</span>`).join(' + ')} zn. · ` +
    `CPS <span class="${c > S.limity.maxCps ? 'spatne' : ''}">${isFinite(c) ? c.toFixed(1) : '∞'}</span> · ` +
    `mezera k dalšímu ${S.p.titulky[i + 1] ? (S.p.titulky[i + 1].od - t.do) + ' ms' : '–'}`;
  $('edProblemy').innerHTML = (S.kontrola[i] || []).map(p => `<span class="znacka${p.chyba ? ' chyba' : ''}">${esc(p.text)}</span>`).join('');
}
function casZPole(el) {
  const v = el.value.trim();
  let ms = T.casZTextu(v);
  if (isNaN(ms) && /^-?\d+(?:[.,]\d+)?$/.test(v)) ms = Math.round(parseFloat(v.replace(',', '.')) * 1000);
  return ms;
}
edOd.addEventListener('change', () => {
  const t = aktT(); const ms = casZPole(edOd);
  if (!t || isNaN(ms)) return vykresliEditor();
  zmena(() => { const d = t.do - t.od; t.od = Math.max(0, ms); if (t.do <= t.od) t.do = t.od + Math.max(500, d); });
});
edDo.addEventListener('change', () => {
  const t = aktT(); const ms = casZPole(edDo);
  if (!t || isNaN(ms)) return vykresliEditor();
  zmena(() => { t.do = Math.max(t.od + 1, ms); });
});
edDelka.addEventListener('change', () => {
  const t = aktT(); const s = parseFloat(edDelka.value.replace(',', '.'));
  if (!t || !(s > 0)) return vykresliEditor();
  zmena(() => { t.do = t.od + Math.round(s * 1000); });
});
edText.addEventListener('input', () => {
  const t = aktT(); if (!t) return;
  zmena(() => { t.text = edText.value; }, 'text' + t.id, t.id);
});
edStyl.addEventListener('change', () => { const t = aktT(); if (t) zmena(() => { t.styl = edStyl.value; }); });
for (const el of [edOd, edDo, edDelka]) el.addEventListener('keydown', e => { if (e.key === 'Enter') el.blur(); });

// ============================================================
//  NÁHLED TITULKŮ NA VIDEU (stejné kreslení jako při vypálení)
// ============================================================
function styl(nazev) { return S.p.styly.find(s => s.nazev === nazev) || S.p.styly[0] || T.vychoziStyl(1080); }
/** Vykreslí titulky aktivní v čase ms do kontextu w×h. Používá se pro náhled i vypálení. */
function kresliTitulkyNa(ctx, w, h, ms, titulky) {
  const prY = +S.p.info.PlayResY || 1080;
  const k = h / prY;
  const obsazeno = { dole: 0, nahore: 0, stred: 0 };
  ctx.textBaseline = 'alphabetic';
  for (const t of T.aktivni(titulky, ms)) {
    const st = styl(t.styl);
    const an = T.zarovnaniZTextu(t.text) || st.zarovnani || 2;
    const vel = Math.max(6, st.velikost * k), lh = vel * 1.22;
    const radky = T.useky(t.text).filter((r, i, a) => r.length || a.length === 1);
    if (!radky.some(r => r.some(u => u.text.trim()))) continue;
    const font = u => `${(u.i || st.kurziva) ? 'italic ' : ''}${(u.b || st.tucne) ? 'bold ' : ''}${vel.toFixed(1)}px "${st.font}", Arial, sans-serif`;
    const sirky = radky.map(r => r.reduce((s, u) => { ctx.font = font(u); return s + ctx.measureText(u.text).width; }, 0));
    const vyska = radky.length * lh;
    const sl = (an - 1) % 3, okrV = (st.okrajV || 0) * k;
    const skup = an <= 3 ? 'dole' : an >= 7 ? 'nahore' : 'stred';
    let y0 = skup === 'dole' ? h - okrV - vyska - obsazeno.dole : skup === 'nahore' ? okrV + obsazeno.nahore : (h - vyska) / 2 + obsazeno.stred;
    obsazeno[skup] += vyska + lh * 0.2;
    const obrys = (st.obrysSirka || 0) * k;
    radky.forEach((r, ri) => {
      const sw = sirky[ri];
      let x = sl === 0 ? (st.okrajL || 10) * k : sl === 2 ? w - (st.okrajP || 10) * k - sw : (w - sw) / 2;
      const yb = y0 + ri * lh + vel * 0.95;
      if (st.podklad && sw > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(x - vel * 0.25, y0 + ri * lh - vel * 0.05, sw + vel * 0.5, lh + vel * 0.02);
      }
      for (const u of r) {
        ctx.font = font(u);
        const uw = ctx.measureText(u.text).width;
        if (obrys > 0 && !st.podklad) {
          ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.lineWidth = obrys * 2; ctx.strokeStyle = st.obrys || '#000';
          ctx.strokeText(u.text, x, yb);
        }
        ctx.fillStyle = st.barva || '#fff';
        ctx.fillText(u.text, x, yb);
        if (u.u) ctx.fillRect(x, yb + vel * 0.1, uw, Math.max(1, vel * 0.06));
        x += uw;
      }
    });
  }
}
const platno = $('titulkyPlatno');
function kresliNahled() {
  const box = $('obraz');
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(box.clientWidth * dpr), H = Math.round(box.clientHeight * dpr);
  if (!W || !H) return;
  if (platno.width !== W || platno.height !== H) { platno.width = W; platno.height = H; }
  const ctx = platno.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  // obdélník obrazu (object-fit: contain)
  const pomer = maVideo() && video.videoWidth ? video.videoWidth / video.videoHeight : 16 / 9;
  let w = W, h = W / pomer;
  if (h > H) { h = H; w = H * pomer; }
  ctx.save();
  ctx.translate((W - w) / 2, (H - h) / 2);
  kresliTitulkyNa(ctx, w, h, ted(), S.p.titulky);
  ctx.restore();
}

// ============================================================
//  ČASOVÁ OSA S VLNOU
// ============================================================
const osa = $('osa');
const KROKY = [100, 200, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000, 1800000];
let osaBarvy = null;
function nactiBarvy() {
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim() || '#888';
  osaBarvy = { bg: g('--bg-input'), text: g('--text-muted'), faint: g('--text-faint'), border: g('--border'), accent: g('--accent'), danger: g('--danger'), warn: g('--warn'), onAccent: g('--on-accent') || '#fff', textC: g('--text') };
}
let osaRaf = 0;
function kresliOsu() { if (!osaRaf) osaRaf = requestAnimationFrame(() => { osaRaf = 0; kresliOsuTed(); }); }
function osaGeom() {
  const H = osa.clientHeight;
  return { W: osa.clientWidth, H, y0: Math.round(H * 0.38), y1: H - 5 };
}
const msNaX = (ms, W) => (ms - S.osa.od) / S.osa.rozsah * W;
const xNaMs = (x, W) => S.osa.od + x / W * S.osa.rozsah;
function kresliOsuTed() {
  if (!osaBarvy) nactiBarvy();
  const B = osaBarvy;
  const dpr = window.devicePixelRatio || 1;
  const { W, H, y0, y1 } = osaGeom();
  if (!W) return;
  if (osa.width !== Math.round(W * dpr) || osa.height !== Math.round(H * dpr)) { osa.width = Math.round(W * dpr); osa.height = Math.round(H * dpr); }
  const ctx = osa.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = B.bg; ctx.fillRect(0, 0, W, H);
  const od = S.osa.od, rozsah = S.osa.rozsah, ms2px = W / rozsah;
  // pravítko
  const krok = KROKY.find(k => k * ms2px >= 80) || KROKY[KROKY.length - 1];
  ctx.font = '10px system-ui, sans-serif'; ctx.textBaseline = 'top';
  ctx.strokeStyle = B.border; ctx.fillStyle = B.faint; ctx.lineWidth = 1;
  for (let m = Math.floor(od / krok) * krok; m <= od + rozsah; m += krok) {
    const x = Math.round((m - od) * ms2px) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillText(krok < 1000 ? Fl(m).replace(/0+$/, '') : Fl(m).replace(/\.\d+$/, ''), x + 3, 2);
  }
  // vlna
  if (S.vlna && S.vlna.length) {
    const kr = S.vlnaKrok * 1000, stred = (14 + H) / 2, amp = (H - 18) / 2, norm = 1 / (S.vlnaMax || 1);
    ctx.fillStyle = B.text; ctx.globalAlpha = 0.45;
    for (let x = 0; x < W; x++) {
      const a = Math.floor((od + x / ms2px) / kr), b = Math.max(a + 1, Math.floor((od + (x + 1) / ms2px) / kr));
      let mx = 0;
      for (let i = Math.max(0, a); i < b && i < S.vlna.length; i++) if (S.vlna[i] > mx) mx = S.vlna[i];
      const v = Math.min(1, mx * norm) * amp;
      if (v > 0.3) ctx.fillRect(x, stred - v, 1, v * 2);
    }
    ctx.globalAlpha = 1;
  }
  // bloky titulků
  ctx.textBaseline = 'middle'; ctx.font = '11px system-ui, sans-serif';
  S.p.titulky.forEach((t, i) => {
    if (t.do < od || t.od > od + rozsah) return;
    const x1 = (t.od - od) * ms2px, x2 = (t.do - od) * ms2px, w = Math.max(2, x2 - x1);
    const vyb = S.vyber.has(t.id), akt = t.id === S.akt;
    const pr = S.kontrola[i] || [];
    ctx.globalAlpha = vyb ? 0.55 : 0.28; ctx.fillStyle = B.accent;
    ctx.fillRect(x1, y0, w, y1 - y0);
    ctx.globalAlpha = 1;
    ctx.lineWidth = akt ? 2 : 1;
    ctx.strokeStyle = pr.some(p => p.chyba) ? B.danger : akt ? B.textC : B.accent;
    ctx.strokeRect(x1 + 0.5, y0 + 0.5, w - 1, y1 - y0 - 1);
    // úchyty okrajů
    ctx.fillStyle = B.accent; ctx.fillRect(x1, y0, 3, y1 - y0); ctx.fillRect(x2 - 3, y0, 3, y1 - y0);
    if (w > 24) {
      ctx.save(); ctx.beginPath(); ctx.rect(x1 + 4, y0, w - 8, y1 - y0); ctx.clip();
      ctx.fillStyle = B.textC;
      const radky = T.viditelny(t.text).split('\n');
      const lh = 13, zac = (y0 + y1) / 2 - (Math.min(radky.length, 3) - 1) * lh / 2;
      radky.slice(0, 3).forEach((r, k) => ctx.fillText(r, x1 + 6, zac + k * lh));
      ctx.fillStyle = B.faint; ctx.textBaseline = 'top'; ctx.fillText('#' + (i + 1), x1 + 6, y0 + 2); ctx.textBaseline = 'middle';
      ctx.restore();
    }
  });
  // přehrávací hlava
  const xp = Math.round((ted() - od) * ms2px) + 0.5;
  ctx.strokeStyle = B.danger; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, H); ctx.stroke();
}
function osaOrez() {
  const c = celkem();
  S.osa.rozsah = Math.min(Math.max(S.osa.rozsah, 1000), Math.max(c, 10000));
  S.osa.od = Math.min(Math.max(0, S.osa.od), Math.max(0, c - S.osa.rozsah));
}
function osaUkaz(od, doo) {
  if (od >= S.osa.od && doo <= S.osa.od + S.osa.rozsah) return;
  if (doo - od > S.osa.rozsah * 0.9) S.osa.rozsah = Math.min((doo - od) * 1.3, 600000);
  S.osa.od = od - S.osa.rozsah * 0.2;
  osaOrez(); kresliOsu();
}
function osaZoom(k, kolemMs) {
  const st = kolemMs == null ? ted() : kolemMs;
  const pomer = (st - S.osa.od) / S.osa.rozsah;
  S.osa.rozsah *= k;
  osaOrez();
  S.osa.od = st - pomer * S.osa.rozsah;
  osaOrez(); kresliOsu();
}
function najdiBlok(x, y) {
  const { W, y0, y1 } = osaGeom();
  if (y < y0 - 2 || y > y1 + 2) return null;
  let nej = null;
  for (const t of S.p.titulky) {
    const x1 = msNaX(t.od, W), x2 = msNaX(t.do, W);
    if (x < x1 - 6 || x > x2 + 6) continue;
    const okraj = x2 - x1 > 16 ? 6 : 3;
    let typ = 'cely';
    if (Math.abs(x - x1) <= okraj) typ = 'od';
    else if (Math.abs(x - x2) <= okraj) typ = 'do';
    else if (x < x1 || x > x2) continue;
    if (!nej || t.id === S.akt) nej = { t, typ };
  }
  return nej;
}
osa.addEventListener('pointerdown', e => {
  const { W } = osaGeom();
  const hit = najdiBlok(e.offsetX, e.offsetY);
  osa.setPointerCapture(e.pointerId);
  if (hit) {
    if (hit.t.id !== S.akt || !S.vyber.has(hit.t.id)) vyber(hit.t.id, { skok: false, pridat: e.ctrlKey });
    S.tah = { typ: hit.typ, id: hit.t.id, x0: e.offsetX, od: hit.t.od, do: hit.t.do, pohyb: false };
  } else {
    S.tah = { typ: 'skok' };
    skoc(xNaMs(e.offsetX, W));
  }
});
osa.addEventListener('pointermove', e => {
  const { W } = osaGeom();
  if (!S.tah) {
    const hit = najdiBlok(e.offsetX, e.offsetY);
    osa.style.cursor = !hit ? 'crosshair' : hit.typ === 'cely' ? 'grab' : 'ew-resize';
    return;
  }
  if (S.tah.typ === 'skok') return skoc(xNaMs(e.offsetX, W));
  const dms = (e.offsetX - S.tah.x0) / W * S.osa.rozsah;
  if (!S.tah.pohyb) { if (Math.abs(e.offsetX - S.tah.x0) < 3) return; S.tah.pohyb = true; ulozUndo(); }
  const t = S.p.titulky[S.index.get(S.tah.id)]; if (!t) return;
  const d = S.tah.do - S.tah.od;
  if (S.tah.typ === 'cely') { t.od = Math.max(0, Math.round(S.tah.od + dms)); t.do = t.od + d; }
  else if (S.tah.typ === 'od') t.od = Math.max(0, Math.min(Math.round(S.tah.od + dms), t.do - 100));
  else t.do = Math.max(Math.round(S.tah.do + dms), t.od + 100);
  S.kontrola = T.kontrola(S.p.titulky, S.limity);
  aktualizujRadek(t.id); vykresliEditor(); kresliOsu(); kresliNahled();
});
function konecTahu() {
  if (S.tah && S.tah.pohyb) poZmene();
  S.tah = null;
}
osa.addEventListener('pointerup', konecTahu);
osa.addEventListener('pointercancel', konecTahu);
osa.addEventListener('wheel', e => {
  e.preventDefault();
  const { W } = osaGeom();
  if (e.ctrlKey || e.metaKey) osaZoom(e.deltaY > 0 ? 1.25 : 0.8, xNaMs(e.offsetX, W));
  else { S.osa.od += (e.deltaY + e.deltaX) / W * S.osa.rozsah * 0.6; osaOrez(); kresliOsu(); }
}, { passive: false });

// ============================================================
//  SMYČKA PŘEHRÁVÁNÍ
// ============================================================
let posledniAkt = null;
function obnovZobrazeniCasu() {
  const ms = ted();
  $('casText').textContent = Fl(ms) + (maVideo() ? ' / ' + Fl(video.duration * 1000) : '');
  if (S.zastavV != null && ms >= S.zastavV && !video.paused) { video.pause(); S.zastavV = null; }
  const hraje = maVideo() && !video.paused;
  if (hraje && S.nast.sledovat && (ms > S.osa.od + S.osa.rozsah * 0.92 || ms < S.osa.od)) { S.osa.od = ms - S.osa.rozsah * 0.08; osaOrez(); }
  if (hraje && S.nast.vyberSleduje && !S.prepis && document.activeElement !== edText) {
    const a = T.aktivni(S.p.titulky, ms);
    const id = a.length ? a[a.length - 1].id : null;
    if (id != null && id !== posledniAkt && id !== S.akt) { posledniAkt = id; S.vyber = new Set([id]); S.akt = id; oznacRadky(true); vykresliEditor(); }
  }
  if (S.prepis) obnovPrepisInfo();
  kresliOsu(); kresliNahled();
}
function smycka() {
  obnovZobrazeniCasu();
  if (maVideo() && !video.paused) requestAnimationFrame(smycka);
}
video.addEventListener('play', () => { $('tlHraj').textContent = '⏸'; requestAnimationFrame(smycka); });
video.addEventListener('pause', () => { $('tlHraj').textContent = '▶'; obnovZobrazeniCasu(); });
video.addEventListener('seeked', obnovZobrazeniCasu);
video.addEventListener('loadedmetadata', () => { osaOrez(); kresliNahled(); obnovZobrazeniCasu(); });
$('rychlost').addEventListener('change', e => { video.playbackRate = +e.target.value; });

// ============================================================
//  OTEVÍRÁNÍ SOUBORŮ
// ============================================================
const PRIPONY_VIDEA = /\.(mp4|m4v|mkv|webm|mov|avi|ogv|ogg|mp3|m4a|aac|wav|flac|opus)$/i;
function jeVideo(f) { return /^(video|audio)\//.test(f.type) || PRIPONY_VIDEA.test(f.name); }
async function otevriSoubory(soubory) {
  for (const f of soubory) {
    if (jeVideo(f)) await otevriVideo(f);
    else await otevriTitulky(f);
  }
}
async function otevriTitulky(f) {
  if (f.size > 30 * 1024 * 1024) return oznam('Soubor je na titulky příliš velký.', true);
  S.surove = new Uint8Array(await f.arrayBuffer());
  S.surNazev = f.name;
  $('stKodovani').value = 'auto';
  await nactiZBajtu('auto', true);
}
async function nactiZBajtu(kod, ptatSe) {
  const d = T.dekoduj(S.surove, kod);
  let p;
  try { p = T.nacti(d.text, null, { nazev: S.surNazev, fps: +$('stFps').value }); }
  catch (e) { return oznam('Soubor se nepodařilo přečíst: ' + e.message, true); }
  if (!p.titulky.length) return oznam(`V souboru „${S.surNazev}“ nejsou žádné titulky.`, true);
  if (ptatSe && S.p.titulky.length && !(await Dialog.potvrd(`Nahradit současné titulky (${S.p.titulky.length}) obsahem souboru „${S.surNazev}“?`))) return;
  nastavProjekt(p, S.surNazev.replace(/\.[^.]+$/, ''));
  S.kodovani = d.kodovani + (d.bom ? ' + BOM' : '');
  if (p.fpsZeSouboru) nastavFpsVyber(p.fps);
  oznam(`Načteno ${p.titulky.length} titulků · ${T.FORMATY[p.format].nazev} · ${d.kodovani}${p.odhadCasu ? ' · časy jsou jen odhad' : ''}`);
  obnovStav();
}
function nastavProjekt(p, nazev) {
  ulozUndo();
  S.p = Object.assign(prazdnyProjekt(), p, { nazev: nazev || 'titulky' });
  S.vyber = new Set(); S.akt = S.p.titulky[0] ? S.p.titulky[0].id : null;
  if (S.akt != null) S.vyber.add(S.akt);
  S.osa.od = 0; S.osa.rozsah = 20000;
  poZmene();
  if (S.akt != null) osaUkaz(S.p.titulky[0].od, S.p.titulky[0].do);
}
function nastavFpsVyber(fps) {
  const sel = $('stFps');
  let opt = [...sel.options].find(o => Math.abs(+o.value - fps) < 0.01);
  if (!opt) { opt = new Option(String(fps)); sel.add(opt); }
  sel.value = opt.value;
  S.p.fps = +opt.value;
}
$('stKodovani').addEventListener('change', async e => {
  if (!S.surove) { oznam('Kódování se použije u dalšího otevřeného souboru.'); return; }
  await nactiZBajtu(e.target.value, false);
});
$('stFps').addEventListener('change', async e => {
  S.p.fps = +e.target.value;
  if (S.surove && S.p.format === 'sub' && !S.p.fpsZeSouboru && await Dialog.potvrd('Přepočítat načtený soubor MicroDVD (SUB) s touto snímkovou frekvencí?')) await nactiZBajtu($('stKodovani').value, false);
  naplanujUlozeni();
});

async function otevriVideo(f) {
  const gen = ++S.gen;
  if (S.video) URL.revokeObjectURL(S.video.url);
  S.video = { soubor: f, url: URL.createObjectURL(f), nazev: f.name };
  video.src = S.video.url;
  video.playbackRate = +$('rychlost').value;
  $('vyzva').hidden = true;
  S.vlna = null; S.videoFps = 0;
  await new Promise(res => { video.onloadedmetadata = res; video.onerror = res; });
  if (gen !== S.gen) return;
  if (!isFinite(video.duration)) {
    oznam('Tento soubor prohlížeč neumí přehrát (zkuste MP4 s H.264 nebo WebM).', true);
  } else {
    oznam(`Video ${f.name} · ${Fl(video.duration * 1000)}`);
    if (S.p.titulky.length === 0) S.osa.rozsah = Math.min(20000, video.duration * 1000);
  }
  obnovStav(); kresliOsu(); kresliNahled();
  naplanujUlozeni();
  nactiVlnu(f, gen);
}

// vlna zvuku: přednostně proudově přes Mediabunny (zvládne i dlouhá videa), jinak WebAudio pro menší soubory
const MAX_VLNA_S = 4 * 3600;
async function nactiVlnu(f, gen) {
  const stav = $('stavVlny');
  stav.textContent = '⏳ načítám zvukovou vlnu…';
  try {
    if (!MB) throw new Error('bez knihovny');
    const input = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack().catch(() => null);
    if (vt) {
      try { const st = await vt.computePacketStats(120); if (st.averagePacketRate) { S.videoFps = st.averagePacketRate; obnovStav(); } } catch {}
    }
    const at = await input.getPrimaryAudioTrack();
    if (!at || !(await at.canDecode())) throw new Error('zvuk nejde dekódovat');
    const delka = Math.min(await input.computeDuration(), MAX_VLNA_S);
    const krok = Math.max(0.01, delka / 800000);
    const vlna = new Float32Array(Math.ceil(delka / krok) + 1);
    S.vlna = vlna; S.vlnaKrok = krok; S.vlnaMax = 0.01;
    const sink = new MB.AudioBufferSink(at);
    let posledni = performance.now();
    for await (const { buffer, timestamp } of sink.buffers(0, delka)) {
      if (gen !== S.gen) return;
      const sr = buffer.sampleRate, d = buffer.getChannelData(0), naKos = Math.max(1, Math.round(sr * krok));
      for (let s0 = 0; s0 < d.length; s0 += naKos) {
        const kos = Math.floor((timestamp + s0 / sr) / krok);
        if (kos < 0 || kos >= vlna.length) continue;
        let mx = vlna[kos];
        const kon = Math.min(d.length, s0 + naKos);
        for (let s = s0; s < kon; s++) { const v = d[s] < 0 ? -d[s] : d[s]; if (v > mx) mx = v; }
        vlna[kos] = mx;
        if (mx > S.vlnaMax) S.vlnaMax = mx;
      }
      if (performance.now() - posledni > 500) {
        stav.textContent = `⏳ vlna ${Math.min(100, Math.round(timestamp / delka * 100))} %`;
        kresliOsu(); posledni = performance.now();
      }
    }
    stav.textContent = delka >= MAX_VLNA_S ? 'vlna jen pro první 4 hodiny' : '';
    kresliOsu();
  } catch (err) {
    if (gen !== S.gen) return;
    if (f.size < 150 * 1024 * 1024 && (window.AudioContext || window.webkitAudioContext)) {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const buf = await ac.decodeAudioData(await f.arrayBuffer());
        ac.close();
        if (gen !== S.gen) return;
        const krok = Math.max(0.01, buf.duration / 800000), d = buf.getChannelData(0), naKos = Math.max(1, Math.round(buf.sampleRate * krok));
        const vlna = new Float32Array(Math.ceil(d.length / naKos));
        let mxAll = 0.01;
        for (let k = 0; k < vlna.length; k++) {
          let mx = 0; const kon = Math.min(d.length, (k + 1) * naKos);
          for (let s = k * naKos; s < kon; s++) { const v = Math.abs(d[s]); if (v > mx) mx = v; }
          vlna[k] = mx; if (mx > mxAll) mxAll = mx;
        }
        S.vlna = vlna; S.vlnaKrok = krok; S.vlnaMax = mxAll;
        stav.textContent = ''; kresliOsu();
        return;
      } catch (e2) { /* ani WebAudio */ }
    }
    S.vlna = null;
    stav.textContent = 'zvukovou vlnu nelze zobrazit';
    console.warn('Vlna:', err);
  }
}

// drag & drop
let dropHloubka = 0;
document.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dropHloubka++; $('drop').classList.add('zobraz'); } });
document.addEventListener('dragleave', () => { if (--dropHloubka <= 0) { dropHloubka = 0; $('drop').classList.remove('zobraz'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault(); dropHloubka = 0; $('drop').classList.remove('zobraz');
  if (e.dataTransfer.files.length) otevriSoubory([...e.dataTransfer.files]);
});
$('souborTitulky').addEventListener('change', e => { if (e.target.files[0]) otevriTitulky(e.target.files[0]); e.target.value = ''; });
$('souborVideo').addEventListener('change', e => { if (e.target.files[0]) otevriVideo(e.target.files[0]); e.target.value = ''; });

// ============================================================
//  ÚPRAVY
// ============================================================
function vybraneTitulky() {
  const v = S.p.titulky.filter(t => S.vyber.has(t.id));
  if (!v.length && aktT()) v.push(aktT());
  return v;
}
function vlozit(naTed) {
  const t = aktT();
  let od;
  if (naTed || !t) od = ted();
  else od = t.do + S.limity.minMezera;
  const i = t ? S.index.get(t.id) : -1, dalsi = S.p.titulky[i + 1];
  let doo = od + 2000;
  if (!naTed && dalsi && dalsi.od - S.limity.minMezera > od + 300) doo = Math.min(doo, dalsi.od - S.limity.minMezera);
  const n = T.titulek(od, doo, '', { styl: t ? t.styl : 'Default' });
  zmena(() => S.p.titulky.push(n));
  vyber(n.id, { skok: true });
  setTimeout(() => edText.focus(), 0);
}
function rozdelit() {
  const t = aktT(); if (!t) return;
  const ms = ted();
  const [a, b] = T.rozdel(t, ms > t.od && ms < t.do ? ms : undefined);
  zmena(() => { S.p.titulky.splice(S.index.get(t.id), 1, a, b); });
  vyber(a.id, { skok: false });
}
function spojit() {
  let v = vybraneTitulky();
  if (v.length === 1) { const d = S.p.titulky[S.index.get(v[0].id) + 1]; if (!d) return oznam('Za titulkem už žádný není.'); v = [v[0], d]; }
  if (v.length < 2) return;
  const nove = v.slice(1).reduce((a, b) => T.spoj(a, b), v[0]);
  zmena(() => {
    const ids = new Set(v.map(t => t.id));
    S.p.titulky = S.p.titulky.filter(t => !ids.has(t.id));
    S.p.titulky.push(nove);
  });
  vyber(nove.id, { skok: false });
}
function smazat() {
  const v = vybraneTitulky(); if (!v.length) return;
  const ids = new Set(v.map(t => t.id));
  const i = S.index.get(v[0].id);
  zmena(() => { S.p.titulky = S.p.titulky.filter(t => !ids.has(t.id)); });
  const dalsi = S.p.titulky[Math.min(i, S.p.titulky.length - 1)];
  S.vyber = new Set(); S.akt = null;
  if (dalsi) vyber(dalsi.id, { skok: false }); else { vykresliEditor(); kresliOsu(); }
}
function kurziva() {
  const v = vybraneTitulky(); if (!v.length) return;
  zmena(() => v.forEach(t => {
    const an = (t.text.match(/^\{\\an\d\}/) || [''])[0], telo = t.text.slice(an.length);
    t.text = an + (/^<i>[\s\S]*<\/i>$/.test(telo) ? telo.slice(3, -4) : `<i>${telo}</i>`);
  }));
}
function zacatekTed() {
  const t = aktT(), ms = ted();
  if (!t) { const n = T.titulek(ms, ms + 2000, ''); zmena(() => S.p.titulky.push(n)); return vyber(n.id, { skok: false }); }
  zmena(() => { const d = t.do - t.od; t.od = ms; if (t.do <= t.od) t.do = t.od + Math.max(1000, d); });
}
function konecTed() {
  const t = aktT(), ms = ted(); if (!t) return;
  if (ms <= t.od) return oznam('Konec musí být po začátku titulku.', true);
  zmena(() => { t.do = ms; });
}
function konecDalsi() {
  const t = aktT(), ms = ted(); if (!t) return zacatekTed();
  const i = S.index.get(t.id), d = S.p.titulky[i + 1];
  zmena(() => {
    if (ms > t.od) t.do = ms;
    if (d) { const del = d.do - d.od; d.od = Math.max(ms + S.limity.minMezera, t.do + S.limity.minMezera); if (d.do <= d.od) d.do = d.od + Math.max(1500, del); }
  });
  if (d) vyber(d.id, { skok: false });
}
function hrajVybrany() {
  const t = aktT(); if (!t || !maVideo()) return;
  skoc(t.od); video.play().catch(() => {}); S.zastavV = t.do;
}
function posunVyber(smer) {
  if (!S.p.titulky.length) return;
  const i = S.index.has(S.akt) ? S.index.get(S.akt) + smer : 0;
  const t = S.p.titulky[Math.max(0, Math.min(S.p.titulky.length - 1, i))];
  vyber(t.id);
}

// ============================================================
//  DIALOGY
// ============================================================
function otevriDlg(id) { zavriNabidky(); $(id).classList.add('zobraz'); const f = $(id).querySelector('input:not([type=checkbox]):not([type=radio]),select,textarea'); if (f) setTimeout(() => f.focus(), 0); }
function zavriDlg(el) { (el || document.querySelector('.modal-bg.zobraz')).classList.remove('zobraz'); }
document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-zavrit]')) { if (bg.id === 'dlgVypalit' && S.vypalovani) return; zavriDlg(bg); } });
});
const otevrenyDlg = () => document.querySelector('.modal-bg.zobraz');

// --- uložit ---
function exportMoznosti() { return { fps: +$('expFps').value, fpsRadek: $('expFpsRadek').checked, crlf: $('expCrlf').checked }; }
$('expFormat').innerHTML = Object.entries(T.FORMATY).map(([k, f]) => `<option value="${k}">${f.nazev}</option>`).join('');
function obnovExport() {
  const f = $('expFormat').value, jeSub = f === 'sub';
  $('expFps').hidden = $('expFpsLbl').hidden = $('expFpsRadekLbl').hidden = !jeSub;
  const maStyly = S.p.styly.length > 1 || S.p.titulky.some(t => /\{\\(?!an\d\})/.test(t.text));
  $('expPozn').textContent = {
    sub: 'Časy se zaokrouhlí na celé snímky – FPS musí odpovídat videu.',
    txt: 'Uloží jen text bez časů (např. pro korekturu nebo překlad).',
    sbv: 'SBV neumí formátování – kurzíva se vynechá.',
    ass: 'Uloží i styly (Vzhled titulků). Časy s přesností na setiny sekundy.',
    ssa: 'Starší formát SubStation Alpha v4. Časy s přesností na setiny sekundy.',
  }[f] || (maStyly ? 'Styly a pozicování z ASS se do tohoto formátu nepřenesou (kromě {\\an8} v SRT).' : '');
  const zakl = S.p.nazev || 'titulky';
  $('expNazev').value = zakl + '.' + T.FORMATY[f].pripona;
}
function otevriExport(format) {
  $('expFormat').value = format || S.nast.export || S.p.format || 'srt';
  $('expBom').checked = S.nast.bom; $('expCrlf').checked = S.nast.crlf; $('expFpsRadek').checked = S.nast.fpsRadek;
  $('expFps').value = [...$('expFps').options].some(o => +o.value === +S.p.fps) ? String(S.p.fps) : '25';
  obnovExport();
  otevriDlg('dlgExport');
}
$('expFormat').addEventListener('change', obnovExport);
function stahni(data, nazev, typ) {
  const url = URL.createObjectURL(new Blob([data], { type: typ || 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nazev;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function exportuj(format, nazev) {
  if (!S.p.titulky.length) return oznam('Nejsou žádné titulky k uložení.', true);
  const txt = T.zapis(S.p, format, exportMoznosti());
  stahni(T.zakoduj(txt, S.nast.bom), nazev || (S.p.nazev || 'titulky') + '.' + T.FORMATY[format].pripona);
  const chyby = S.kontrola.filter(p => p.some(x => x.chyba)).length;
  oznam(`Uloženo (${T.FORMATY[format].nazev}, UTF-8${S.nast.bom ? ' s BOM' : ''})${chyby ? ` – pozor, ${chyby} titulků má chybu (Kontrola)` : ''}`);
}
$('expStahnout').addEventListener('click', () => {
  Object.assign(S.nast, { bom: $('expBom').checked, crlf: $('expCrlf').checked, fpsRadek: $('expFpsRadek').checked, export: $('expFormat').value });
  ulozNast();
  exportuj($('expFormat').value, $('expNazev').value.trim() || undefined);
  zavriDlg($('dlgExport'));
});
$('expKopirovat').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(T.zapis(S.p, $('expFormat').value, exportMoznosti())); oznam('Zkopírováno do schránky.'); }
  catch { oznam('Schránka není dostupná.', true); }
});

// --- vložit text ---
$('vlozitOk').addEventListener('click', () => {
  const txt = $('vlozitText').value;
  if (!txt.trim()) return;
  try {
    const p = T.nacti(txt, null, { fps: +$('stFps').value });
    if (!p.titulky.length) return oznam('V textu nejsou žádné titulky.', true);
    S.surove = null;
    nastavProjekt(p, S.p.nazev);
    S.kodovani = 'vložený text';
    zavriDlg($('dlgVlozit'));
    oznam(`Načteno ${p.titulky.length} titulků (${T.FORMATY[p.format].nazev})${p.odhadCasu ? ' – časy jsou odhad, dolaďte je klávesou D při přehrávání' : ''}.`);
  } catch (e) { oznam(e.message, true); }
});

// --- posun ---
function rozsahPosunu() {
  const r = document.querySelector('input[name=posunRozsah]:checked').value;
  if (r === 'vse') return null;
  if (r === 'vyber') return new Set(vybraneTitulky().map(t => t.id));
  const t = aktT(); if (!t) return null;
  return new Set(S.p.titulky.slice(S.index.get(t.id)).map(x => x.id));
}
document.querySelectorAll('[data-posun]').forEach(b => b.addEventListener('click', () => { $('posunMs').value = (+$('posunMs').value || 0) + +b.dataset.posun; }));
$('posunNaTed').addEventListener('click', () => { const t = aktT(); if (t) $('posunMs').value = ted() - t.od; });
$('posunOk').addEventListener('click', () => {
  const ms = Math.round(+$('posunMs').value || 0);
  if (!ms) return zavriDlg($('dlgPosun'));
  const vyb = rozsahPosunu();
  zmena(() => T.posun(S.p.titulky, ms, vyb));
  zavriDlg($('dlgPosun'));
  oznam(`Posunuto o ${ms > 0 ? '+' : ''}${ms} ms (${vyb ? vyb.size : S.p.titulky.length} titulků).`);
});
// --- fps ---
$('fpsOk').addEventListener('click', () => {
  const z = +$('fpsZ').value, na = +$('fpsNa').value;
  if (z === na) return zavriDlg($('dlgFps'));
  const vyb = $('fpsVyber').checked ? new Set(vybraneTitulky().map(t => t.id)) : null;
  zmena(() => T.zmenFps(S.p.titulky, z, na, vyb));
  zavriDlg($('dlgFps'));
  oznam(`Přepočítáno ${z} → ${na} fps.`);
});
// --- synchronizace ---
function otevriSync() {
  if (S.p.titulky.length < 2) return oznam('Synchronizace potřebuje aspoň dva titulky.', true);
  const opt = S.p.titulky.map((t, i) => `<option value="${t.id}">#${i + 1} ${esc(Fl(t.od))} – ${esc(T.viditelny(t.text).replace(/\n/g, ' ').slice(0, 40))}</option>`).join('');
  $('sync1').innerHTML = $('sync2').innerHTML = opt;
  const v = vybraneTitulky();
  $('sync1').value = String(v.length >= 2 ? v[0].id : S.p.titulky[0].id);
  $('sync2').value = String(v.length >= 2 ? v[v.length - 1].id : S.p.titulky[S.p.titulky.length - 1].id);
  const nastav = k => { const t = S.p.titulky[S.index.get(+$('sync' + k).value)]; $('sync' + k + 'Cas').value = F(t.od); };
  nastav(1); nastav(2);
  $('sync1').onchange = () => nastav(1); $('sync2').onchange = () => nastav(2);
  otevriDlg('dlgSync');
}
document.querySelectorAll('[data-synted]').forEach(b => b.addEventListener('click', () => { $('sync' + b.dataset.synted + 'Cas').value = F(ted()); }));
$('syncOk').addEventListener('click', () => {
  const t1 = S.p.titulky[S.index.get(+$('sync1').value)], t2 = S.p.titulky[S.index.get(+$('sync2').value)];
  const b1 = casZPole($('sync1Cas')), b2 = casZPole($('sync2Cas'));
  if (isNaN(b1) || isNaN(b2)) return oznam('Zadejte časy ve tvaru 00:01:02,500.', true);
  if (t1.od === t2.od) return oznam('Vyberte dva titulky s různým začátkem.', true);
  try { zmena(() => T.synchronizuj(S.p.titulky, t1.od, b1, t2.od, b2)); }
  catch (e) { return oznam(e.message, true); }
  zavriDlg($('dlgSync'));
  oznam('Titulky synchronizovány.');
});
// --- kontrola ---
function otevriKontrolu() {
  const sh = T.souhrnKontroly(S.kontrola);
  const kody = Object.keys(sh);
  $('kontrolaSouhrn').innerHTML = kody.length
    ? kody.map(k => `<span class="znacka${['prazdny', 'zaporna', 'prekryv'].includes(k) ? ' chyba' : ''}">${esc(T.POPIS[k])}: ${sh[k]}</span>`).join('')
    : '<span class="znacka" style="background:color-mix(in srgb,var(--ok) 22%,transparent);color:var(--text)">✓ bez problémů</span>';
  const h = [];
  S.p.titulky.forEach((t, i) => {
    const pr = S.kontrola[i]; if (!pr.length) return;
    h.push(`<button data-id="${t.id}"><span class="c">#${i + 1} ${esc(Fl(t.od))}</span><span>${pr.map(p => `<span class="znacka${p.chyba ? ' chyba' : ''}">${esc(p.text)}</span>`).join(' ')} ${esc(T.viditelny(t.text).replace(/\n/g, ' ').slice(0, 50))}</span></button>`);
  });
  $('kontrolaSeznam').innerHTML = h.join('') || '<p style="padding:10px">Všechny titulky splňují limity.</p>';
  otevriDlg('dlgKontrola');
}
$('kontrolaSeznam').addEventListener('click', e => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  zavriDlg($('dlgKontrola')); vyber(+b.dataset.id);
});
$('opravyOk').addEventListener('click', () => {
  const vol = { seradit: $('opSeradit').checked, prazdne: $('opPrazdne').checked, mezeryText: $('opMezeryText').checked, zalomit: $('opZalomit').checked, kratke: $('opKratke').checked, mezery: $('opMezery').checked };
  let n;
  zmena(() => {
    if ($('opVyber').checked) {
      const pod = vybraneTitulky();
      n = T.opravy(pod, vol, S.limity);
      const zbyle = new Set(pod.map(t => t.id)), puvodni = new Set(vybraneTitulky().map(t => t.id));
      S.p.titulky = S.p.titulky.filter(t => !puvodni.has(t.id) || zbyle.has(t.id));
    } else n = T.opravy(S.p.titulky, vol, S.limity);
  });
  zavriDlg($('dlgOpravy'));
  const pop = { prazdne: 'smazáno prázdných', mezeryText: 'upraveno mezer', zalomit: 'zalomeno', kratke: 'prodlouženo', mezery: 'opraveno mezer/překryvů' };
  const t = Object.keys(pop).filter(k => n[k]).map(k => `${pop[k]} ${n[k]}`).join(', ');
  oznam(t ? 'Opraveno: ' + t + '.' : 'Nebylo co opravit.');
});
// --- limity ---
const LIM_POLE = { minDelka: 'limMinDelka', maxDelka: 'limMaxDelka', maxCps: 'limMaxCps', maxRadek: 'limMaxRadek', maxRadku: 'limMaxRadku', minMezera: 'limMinMezera' };
function otevriLimity() { for (const k in LIM_POLE) $(LIM_POLE[k]).value = S.limity[k]; otevriDlg('dlgLimity'); }
$('limVychozi').addEventListener('click', () => { for (const k in LIM_POLE) $(LIM_POLE[k]).value = T.LIMITY[k]; });
$('limOk').addEventListener('click', () => {
  for (const k in LIM_POLE) { const v = +$(LIM_POLE[k]).value; if (v > 0 || (k === 'minMezera' && v === 0)) S.limity[k] = v; }
  lsPis('limity', S.limity);
  zavriDlg($('dlgLimity'));
  poZmene();
});
// --- najít a nahradit ---
function hledaciRe() {
  const co = $('hlCo').value; if (!co) return null;
  try { return new RegExp($('hlRegex').checked ? co : co.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $('hlVelka').checked ? 'g' : 'gi'); }
  catch (e) { $('hlInfo').textContent = 'Chybný regulární výraz: ' + e.message; return null; }
}
$('hlDalsi').addEventListener('click', () => {
  const re = hledaciRe(); if (!re) return;
  const n = S.p.titulky.length, z = S.index.has(S.akt) ? S.index.get(S.akt) : -1;
  for (let k = 1; k <= n; k++) {
    const t = S.p.titulky[(z + k) % n];
    re.lastIndex = 0;
    if (re.test(t.text)) { vyber(t.id); $('hlInfo').textContent = `Nalezeno v #${S.index.get(t.id) + 1}.`; return; }
  }
  $('hlInfo').textContent = 'Nenalezeno.';
});
$('hlVse').addEventListener('click', () => {
  const re = hledaciRe(); if (!re) return;
  let pocet = 0;
  const cim = $('hlCim').value;
  zmena(() => S.p.titulky.forEach(t => {
    const m = t.text.match(re); if (!m) return;
    pocet += m.length; t.text = t.text.replace(re, cim);
  }));
  $('hlInfo').textContent = `Nahrazeno ${pocet}×.`;
});
// --- vzhled ---
function naplnStyl() {
  const s = S.p.styly.find(x => x.nazev === $('vzStyl').value) || S.p.styly[0];
  $('vzFont').value = [...$('vzFont').options].some(o => o.value === s.font) ? s.font : (() => { $('vzFont').add(new Option(s.font)); return s.font; })();
  $('vzVelikost').value = s.velikost; $('vzBarva').value = s.barva; $('vzObrys').value = s.obrys;
  $('vzObrysSirka').value = s.obrysSirka; $('vzZarovnani').value = String(s.zarovnani);
  $('vzOkraj').value = s.okrajV; $('vzTucne').checked = s.tucne; $('vzKurziva').checked = s.kurziva; $('vzPodklad').checked = !!s.podklad;
}
function otevriVzhled() {
  $('vzStyl').innerHTML = S.p.styly.map(s => `<option>${esc(s.nazev)}</option>`).join('');
  const t = aktT(); if (t && S.p.styly.some(s => s.nazev === t.styl)) $('vzStyl').value = t.styl;
  $('vzPlayRes').textContent = S.p.info.PlayResY || 1080;
  naplnStyl();
  otevriDlg('dlgVzhled');
}
$('vzStyl').addEventListener('change', naplnStyl);
$('vzNovy').addEventListener('click', async () => {
  const n = await Dialog.zeptej('Název nového stylu', 'Nahoře');
  if (!n || S.p.styly.some(s => s.nazev === n.trim())) return;
  const zaklad = S.p.styly.find(x => x.nazev === $('vzStyl').value) || S.p.styly[0];
  zmena(() => S.p.styly.push(Object.assign({}, zaklad, { nazev: n.trim().replace(/,/g, ' ') })));
  otevriVzhled(); $('vzStyl').value = n.trim(); naplnStyl();
});
$('vzOk').addEventListener('click', () => {
  const s = S.p.styly.find(x => x.nazev === $('vzStyl').value); if (!s) return;
  zmena(() => Object.assign(s, {
    font: $('vzFont').value, velikost: Math.max(4, +$('vzVelikost').value || s.velikost), barva: $('vzBarva').value, obrys: $('vzObrys').value,
    obrysSirka: Math.max(0, +$('vzObrysSirka').value || 0), zarovnani: +$('vzZarovnani').value, okrajV: Math.max(0, +$('vzOkraj').value || 0),
    tucne: $('vzTucne').checked, kurziva: $('vzKurziva').checked, podklad: $('vzPodklad').checked,
  }));
  zavriDlg($('dlgVzhled'));
});

// ============================================================
//  VYPÁLENÍ TITULKŮ DO VIDEA (Mediabunny + WebCodecs)
// ============================================================
function otevriVypalit() {
  const umi = MB && typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
  $('vypStart').disabled = !umi || !S.video;
  $('vypStav').textContent = !umi
    ? '⚠ Tento prohlížeč nepodporuje WebCodecs (VideoEncoder), takže titulky do videa vypálit nejde. Zkuste aktuální Chrome, Edge nebo Firefox 130+ – nebo uložte titulky jako soubor a vypalte je jiným programem (např. ffmpeg -vf subtitles=…).'
    : !S.video ? 'Nejdřív otevřete video.' : `Video: ${S.video.nazev} · ${S.p.titulky.length} titulků.`;
  $('vypPrubeh').hidden = true;
  otevriDlg('dlgVypalit');
}
$('vypStart').addEventListener('click', async () => {
  if (S.vypalovani || !S.video) return;
  const titulky = S.p.titulky.slice();
  $('vypStart').disabled = true; $('vypZrusit').hidden = false; $('vypPrubeh').hidden = false;
  const pruh = $('vypPrubeh').firstElementChild; pruh.style.width = '0';
  $('vypStav').textContent = '⏳ připravuji…';
  const input = new MB.Input({ source: new MB.BlobSource(S.video.soubor), formats: MB.ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new Error('Soubor neobsahuje video stopu.');
    if (!(await vt.canDecode())) throw new Error(`Prohlížeč neumí dekódovat video kodek ${vt.codec || ''}.`);
    let W = vt.displayWidth, H = vt.displayHeight;
    const cil = +$('vypVyska').value;
    if (cil && H > cil) { W = Math.round(W * cil / H); H = cil; }
    W -= W % 2; H -= H % 2;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const webm = $('vypFormat').value === 'webm';
    const output = new MB.Output({ format: webm ? new MB.WebMOutputFormat() : new MB.Mp4OutputFormat(), target: new MB.BufferTarget() });
    const kv = MB['QUALITY_' + $('vypKvalita').value];
    const conv = await MB.Conversion.init({
      input, output, showWarnings: false,
      video: {
        forceTranscode: true, processedWidth: W, processedHeight: H, quality: kv,
        process: sample => {
          ctx.clearRect(0, 0, W, H);
          sample.drawWithFit(ctx, { fit: 'fill' });
          kresliTitulkyNa(ctx, W, H, Math.round(sample.timestamp * 1000), titulky);
          return canvas;
        },
      },
      audio: { quality: kv },
    });
    if (!conv.isValid) throw new Error('Video v tomto formátu nelze vytvořit (' + conv.discardedTracks.map(d => `${d.track.type}: ${d.reason}`).join(', ') + '). Zkuste druhý formát.');
    S.vypalovani = conv;
    const start = performance.now();
    conv.onProgress = p => {
      pruh.style.width = (p * 100).toFixed(1) + '%';
      const uplynulo = (performance.now() - start) / 1000;
      const zbyva = p > 0.02 ? Math.round(uplynulo / p - uplynulo) : null;
      $('vypStav').textContent = `🔥 ${Math.round(p * 100)} %${zbyva != null ? ` · zbývá asi ${zbyva >= 60 ? Math.round(zbyva / 60) + ' min' : zbyva + ' s'}` : ''}`;
    };
    await conv.execute();
    const bez = conv.discardedTracks.some(d => d.track.type === 'audio');
    const nazev = (S.video.nazev.replace(/\.[^.]+$/, '') || 'video') + '_titulky.' + (webm ? 'webm' : 'mp4');
    stahni(output.target.buffer, nazev, output.format.mimeType);
    pruh.style.width = '100%';
    $('vypStav').textContent = `✓ Hotovo – staženo ${nazev}${bez ? ' (bez zvuku – nešel převést do zvoleného formátu)' : ''}.`;
  } catch (err) {
    if (MB.ConversionCanceledError && err instanceof MB.ConversionCanceledError) $('vypStav').textContent = 'Zastaveno.';
    else { console.error(err); $('vypStav').textContent = '⚠ ' + (err.message || err); }
  } finally {
    S.vypalovani = null;
    try { input.dispose(); } catch {}
    $('vypStart').disabled = false; $('vypZrusit').hidden = true;
  }
});
$('vypZrusit').addEventListener('click', () => { if (S.vypalovani) S.vypalovani.cancel(); });

// ============================================================
//  REŽIM PŘEPISU
// ============================================================
const prepisText = $('prepisText');
function prepniPrepis() {
  S.prepis = !S.prepis;
  $('panelEditor').hidden = S.prepis; $('panelPrepis').hidden = !S.prepis;
  document.querySelectorAll('[data-prikaz="prepis"]').forEach(b => b.setAttribute('aria-pressed', String(S.prepis)));
  S.prepisZac = null;
  if (S.prepis) {
    if (maVideo()) video.playbackRate = +$('prepisRychlost').value;
    prepisText.focus();
    obnovPrepisInfo();
  } else { if (maVideo()) video.playbackRate = +$('rychlost').value; vykresliEditor(); }
}
function obnovPrepisInfo() {
  $('prepisStav').textContent = maVideo() ? (video.paused ? '⏸ pauza' : '▶ přehrává') : 'bez videa';
  $('prepisInfo').textContent = S.prepisZac != null ? `Začátek zachycen v ${Fl(S.prepisZac)} · teď ${Fl(ted())}` : `Teď ${Fl(ted())} · začněte psát`;
}
$('prepisRychlost').addEventListener('change', e => { if (maVideo()) video.playbackRate = +e.target.value; });
prepisText.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ulozPrepis(); return; }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hraj(); return; }
  if (S.prepisZac == null && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    S.prepisZac = Math.max(0, ted() - Math.round((+$('prepisNaskok').value || 0) * 1000));
    if ($('prepisPauza').checked && maVideo() && !video.paused) { video.pause(); S.prepisPauza = true; }
    obnovPrepisInfo();
  }
});
function ulozPrepis() {
  const text = prepisText.value.trim();
  if (!text) return;
  const od = S.prepisZac != null ? S.prepisZac : Math.max(0, ted() - 2000);
  const odhad = Math.min(6000, Math.max(1200, T.viditelny(text).length * 1000 / S.limity.maxCps));
  const doo = Math.max(ted(), od + (S.prepisPauza ? odhad : 700));
  const n = T.titulek(od, doo, text);
  zmena(() => S.p.titulky.push(n));
  S.akt = n.id; S.vyber = new Set([n.id]); oznacRadky(true);
  prepisText.value = ''; S.prepisZac = null;
  if (S.prepisPauza) { S.prepisPauza = false; video.play().catch(() => {}); }
  obnovPrepisInfo();
}

// ============================================================
//  UKLÁDÁNÍ ROZPRACOVANÉHO PROJEKTU (IndexedDB)
// ============================================================
let dbSlib = null;
function db() {
  if (!dbSlib) dbSlib = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAZEV, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('projekt');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbSlib;
}
async function dbOp(rezim, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('projekt', rezim);
    const r = fn(tx.objectStore('projekt'));
    tx.oncomplete = () => res(r && r.result);
    tx.onerror = () => rej(tx.error);
  });
}
let ulozTimer = 0;
let obnoveno = false;   // dokud se nenačte uložený projekt, nic nepřepisovat
function naplanujUlozeni() {
  if (!obnoveno) return;
  clearTimeout(ulozTimer);
  ulozTimer = setTimeout(async () => {
    try {
      await dbOp('readwrite', st => st.put({ p: S.p, video: S.video ? S.video.nazev : '', kodovani: S.kodovani, ulozeno: Date.now() }, 'rozpracovany'));
      $('stUlozeno').textContent = '💾 uloženo ' + new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) { $('stUlozeno').textContent = '⚠ nelze ukládat do prohlížeče'; }
  }, 700);
}
async function obnovRozpracovany() {
  try { await obnovRozpracovanyTed(); } finally { obnoveno = true; }
}
async function obnovRozpracovanyTed() {
  try {
    const z = await dbOp('readonly', st => st.get('rozpracovany'));
    if (!z || !z.p || !z.p.titulky || !z.p.titulky.length) return;
    S.p = Object.assign(prazdnyProjekt(), z.p);
    T.nastavId(Math.max(0, ...S.p.titulky.map(t => t.id)) + 1);
    S.kodovani = z.kodovani || '';
    S.akt = S.p.titulky[0].id; S.vyber = new Set([S.akt]);
    nastavFpsVyber(S.p.fps || 25);
    poZmene();
    oznam(`Obnoven rozpracovaný projekt (${S.p.titulky.length} titulků${z.video ? ` – otevřete znovu video „${z.video}“` : ''}).`);
  } catch (e) { console.warn('Obnova projektu:', e); }
}

// ============================================================
//  STAVOVÝ ŘÁDEK, MENU, PŘÍKAZY, KLÁVESY
// ============================================================
function obnovStav() {
  const n = S.p.titulky.length;
  $('stFormat').textContent = `${T.FORMATY[S.p.format] ? T.FORMATY[S.p.format].nazev : ''} · ${n} titulků${S.video ? ' · 🎞 ' + S.video.nazev : ''}${S.videoFps ? ` (${+S.videoFps.toFixed(3)} fps)` : ''}`;
  $('stKodInfo').textContent = S.kodovani ? `(${S.kodovani})` : '';
  const sp = S.kontrola.filter(p => p.length).length;
  $('pocetProblemu').textContent = sp ? `(${sp})` : '';
}

function ukazka() {
  const txt = `1
00:00:01,000 --> 00:00:03,200
Vítejte v editoru titulků.

2
00:00:03,400 --> 00:00:06,000
Titulky můžete posouvat na časové ose
a měnit jejich konce tažením.

3
00:00:05,800 --> 00:00:06,500
Tenhle se překrývá a je moc rychlý na přečtení!

4
00:00:07,000 --> 00:00:10,000
<i>Kurzíva</i> se zachová v SRT, VTT i ASS.

5
00:00:10,500 --> 00:00:13,000
{\\an8}Tento titulek je nahoře.

6
00:00:13,200 --> 00:00:16,500
Tenhle řádek je naopak příliš dlouhý, takže ho automatická oprava zalomí na dva.
`;
  nastavProjekt(T.nacti(txt), 'ukazka');
  S.kodovani = 'ukázka';
  obnovStav();
}

const PRIKAZY = {
  otevritTitulky: () => $('souborTitulky').click(),
  otevritVideo: () => $('souborVideo').click(),
  vlozitText: () => { $('vlozitText').value = ''; otevriDlg('dlgVlozit'); },
  novy: async () => {
    if (S.p.titulky.length && !(await Dialog.potvrd('Začít nový prázdný projekt? (Současné titulky lze vrátit přes Zpět.)'))) return;
    nastavProjekt(prazdnyProjekt(), 'titulky'); S.surove = null; S.kodovani = ''; obnovStav();
  },
  ukazka,
  export: () => otevriExport(),
  zpet, znovu,
  vlozit: () => vlozit(false), vlozitTed: () => vlozit(true),
  rozdelit, spojit, smazat, kurziva,
  vybratVse: () => { S.vyber = new Set(S.p.titulky.map(t => t.id)); oznacRadky(); vykresliEditor(); kresliOsu(); },
  hledat: () => { $('hlInfo').textContent = ''; otevriDlg('dlgHledat'); },
  zalomitJeden: () => { const t = aktT(); if (t) zmena(() => { t.text = T.zalomit(t.text, S.limity.maxRadek); }); },
  zacatekTed, konecTed, konecDalsi,
  posun: () => { document.querySelectorAll('.pocetVyber').forEach(e => { e.textContent = vybraneTitulky().length; }); otevriDlg('dlgPosun'); },
  fps: () => otevriDlg('dlgFps'),
  sync: otevriSync,
  prepis: prepniPrepis,
  kontrola: () => { zavriDlg(otevrenyDlg() || $('dlgKontrola')); otevriKontrolu(); },
  opravy: () => { const d = otevrenyDlg(); if (d) zavriDlg(d); otevriDlg('dlgOpravy'); },
  limity: () => { const d = otevrenyDlg(); if (d) zavriDlg(d); otevriLimity(); },
  jenProblemy: () => { S.nast.jenProblemy = !S.nast.jenProblemy; ulozNast(); vykresliTabulku(); obnovPrepinace(); },
  sledovat: () => { S.nast.sledovat = !S.nast.sledovat; ulozNast(); obnovPrepinace(); },
  vyberSleduje: () => { S.nast.vyberSleduje = !S.nast.vyberSleduje; ulozNast(); obnovPrepinace(); },
  vzhled: otevriVzhled,
  vypalit: otevriVypalit,
  napoveda: () => otevriDlg('dlgNapoveda'),
  hraj, hrajVybrany,
  zpet5: () => skoc(ted() - 5000), vpred5: () => skoc(ted() + 5000),
  osaPlus: () => osaZoom(0.6), osaMinus: () => osaZoom(1.6),
  osaVse: () => { S.osa.od = 0; S.osa.rozsah = celkem(); osaOrez(); kresliOsu(); },
};
for (const f of Object.keys(T.FORMATY)) PRIKAZY['exp-' + f] = () => exportuj(f);
function prikaz(id) { zavriNabidky(); const p = PRIKAZY[id]; if (p) p(); }
function obnovPrepinace() {
  document.querySelectorAll('.nabidka .prep').forEach(b => {
    const k = b.dataset.prikaz;
    if (k in S.nast) b.setAttribute('aria-pressed', String(!!S.nast[k]));
  });
}

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
  const b = e.target.closest('[data-prikaz]');
  if (b && !b.disabled) { e.stopPropagation(); return prikaz(b.dataset.prikaz); }
  if (!e.target.closest('.nabidka')) zavriNabidky();
});
addEventListener('resize', zavriNabidky);

document.addEventListener('keydown', e => {
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  const pole = e.target.closest && e.target.closest('input,textarea,select,[contenteditable]');
  // klávesy fungující i při psaní
  const fk = { F1: 'napoveda', F2: 'hraj', F3: 'zacatekTed', F4: 'konecTed', F9: 'konecDalsi' }[k];
  if (fk) { e.preventDefault(); return prikaz(fk); }
  if (ctrl && !e.shiftKey && e.code === 'KeyS') { e.preventDefault(); return prikaz('export'); }
  if (ctrl && e.code === 'KeyO') { e.preventDefault(); return prikaz('otevritTitulky'); }
  if (otevrenyDlg()) {
    if (k === 'Escape' && !S.vypalovani) zavriDlg();
    if (k === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
      const prim = otevrenyDlg().querySelector('.btn.primary:not([data-zavrit])'); if (prim) { e.preventDefault(); prim.click(); }
    }
    return;
  }
  if (k === 'Escape') {
    if (document.querySelector('.nabidka:not([hidden])')) return zavriNabidky();
    if (pole) { e.target.blur(); return; }
  }
  if (pole) return;
  if (ctrl) {
    const c = { KeyZ: e.shiftKey ? 'znovu' : 'zpet', KeyY: 'znovu', KeyA: 'vybratVse', KeyD: 'rozdelit', KeyJ: 'spojit', KeyH: 'hledat' }[e.code];
    if (c) { e.preventDefault(); prikaz(c); }
    return;
  }
  if (e.altKey && (k === 'ArrowLeft' || k === 'ArrowRight')) {
    e.preventDefault();
    return skoc(ted() + (k === 'ArrowLeft' ? -1 : 1) * 1000 / (S.videoFps || S.p.fps || 25));
  }
  if (e.altKey) return;
  const c = {
    ' ': 'hraj', Insert: 'vlozit', Delete: 'smazat', ArrowUp: () => posunVyber(-1), ArrowDown: () => posunVyber(1),
    ArrowLeft: () => skoc(ted() - (e.shiftKey ? 5000 : 1000)), ArrowRight: () => skoc(ted() + (e.shiftKey ? 5000 : 1000)),
    Enter: () => { if (aktT()) edText.focus(); },
  }[k] || { KeyA: 'zacatekTed', KeyS: 'konecTed', KeyD: 'konecDalsi', KeyP: 'hrajVybrany' }[e.code];
  if (!c) return;
  e.preventDefault();
  typeof c === 'function' ? c() : prikaz(c);
});

// ============================================================
//  START
// ============================================================
new ResizeObserver(() => { kresliOsu(); kresliNahled(); }).observe($('obraz'));
new ResizeObserver(() => kresliOsu()).observe(osa);
new MutationObserver(() => { nactiBarvy(); kresliOsu(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
nastavFpsVyber(25);
obnovPrepinace();
poZmene();
obnovRozpracovany();

// pro testy
window.TITULKY_APP = { S, otevriTitulky, otevriVideo, nactiZBajtu, kresliTitulkyNa, prikaz, vyber, poZmene, ukazka };
})();
