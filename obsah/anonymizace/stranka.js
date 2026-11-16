/* ============================================================
   anonymizace/stranka.js – rozhraní Anonymizace fotek.
   Fotky drží jen v paměti (File + oblasti), dekóduje se vždy jen ta aktuální.
   Výpočty (efekty, detekce, metadata, ZIP) jsou v jadro.js (window.ANON).
   ============================================================ */
(function () {
'use strict';
const A = window.ANON, $ = id => document.getElementById(id);
const ONNX = 'lib/onnx/', MODEL = 'anonymizace/ultraface-rfb-320.onnx';
const KLIC = 'webapp_anonymizace_nastaveni';
const EMOJI = ['😎', '🙂', '😀', '🤐', '🙈', '😺', '🐶', '⭐', '❤️', '🌸', '🎃', '🤖'];
const POZN_EFEKT = {
  rozmazat: 'Gaussovské rozmazání se vpálí do pixelů. U textu (SPZ, jména) volte velkou sílu – slabé rozmazání jde částečně obnovit.',
  pixely: 'Pixelizace průměruje bloky. Čím větší síla, tím větší bloky a tím bezpečnější.',
  cerna: 'Černý pruh úplně nahradí obsah – nejjistější volba.',
  emoji: 'Pod emoji je hrubá pixelizace, takže ani okraje kolem emoji nic neprozradí.',
};
if (window.self === window.top) document.body.classList.add('samostatne');

const nast = Object.assign({ efekt: 'rozmazat', sila: 60, emoji: '😎', tvar: 'elipsa', stetec: 40, format: 'image/jpeg', kvalita: '0.9',
  maxStrana: '0', pripona: '_anonym', citlivost: '0.65', auto: true }, nactiNast());
function nactiNast() { try { return JSON.parse(localStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } }
function ulozNast() { try { localStorage.setItem(KLIC, JSON.stringify(nast)); } catch (e) { /* bez úložiště jen nezapamatuje */ } }

const S = { fotky: [], akt: -1, obr: null, nastroj: 'vyber', vybrana: null, porovnat: false, z: 1, ai: null, casVykresleni: 0 };
const UZKY = matchMedia('(max-width:900px)');
const foto = () => S.fotky[S.akt] || null;
const oblasti = () => (foto() ? foto().oblasti : []);
const vybrana = () => oblasti().find(o => o.id === S.vybrana) || null;
const vychozi = () => ({ efekt: nast.efekt, sila: nast.sila, emoji: nast.emoji });
const tr = t => (window.I18N && typeof I18N.t === 'function' ? I18N.t(t) : t);
const mb = n => (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' kB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB');

/* ---------- práce s průběhem a fronta ---------- */
let fronta = Promise.resolve();
function vePoradi(fn) { const p = fronta.then(fn, fn); fronta = p.catch(() => {}); return p; }
function prace(text, podil) {
  if (text === null) { $('prace').hidden = true; return; }
  $('prace').hidden = false; $('praceText').textContent = text;
  $('praceProuzek').style.width = Math.round((podil || 0) * 100) + '%';
}
const chvilka = () => new Promise(r => setTimeout(r, 0));

/* ---------- načtení fotek ---------- */
async function dekoduj(f) {
  const bmp = await createImageBitmap(f.soubor); // otočení podle EXIF se použije (image-orientation: from-image)
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0); bmp.close();
  return { W: c.width, H: c.height, data: ctx.getImageData(0, 0, c.width, c.height).data };
}
async function pridejSoubory(seznam) {
  const soubory = [...seznam].filter(f => f && (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name)));
  if (!soubory.length) return;
  const chybne = [], nove = [];
  for (let i = 0; i < soubory.length; i++) {
    const s = soubory[i];
    prace(`Načítám ${i + 1} / ${soubory.length}: ${s.name}`, i / soubory.length);
    try {
      const bmp = await createImageBitmap(s);
      const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const f = { id: 'f' + Date.now().toString(36) + i, soubor: s, nazev: s.name || 'foto', typ: s.type, velikost: s.size, W: bmp.width, H: bmp.height,
        oblasti: [], historie: [], meta: A.ctiMetadata(await s.arrayBuffer()), nahled: c.toDataURL('image/jpeg', 0.75), hledano: false, stazeno: false, overeni: '' };
      bmp.close();
      S.fotky.push(f); nove.push(f);
    } catch (e) { console.warn(e); chybne.push(s.name); }
  }
  prace(null);
  if (S.akt < 0 && S.fotky.length) await vyber(0); else vykresliFotky();
  if (chybne.length) Dialog.chyba('Tyto soubory prohlížeč neumí otevřít (např. HEIC z iPhonu – převeďte je na JPG):\n' + chybne.join('\n'));
  if (nast.auto && nove.length) hledejVe(nove);
}
async function vyber(i) {
  if (i < 0 || i >= S.fotky.length) { S.akt = -1; S.obr = null; return obnovVse(); }
  S.akt = i; S.vybrana = null;
  prace('Otevírám fotku…', 0.5); await chvilka();
  try { S.obr = await dekoduj(foto()); }
  catch (e) { prace(null); S.obr = null; Dialog.chyba('Fotku se nepodařilo otevřít: ' + e.message); return obnovVse(); }
  prace(null);
  const co = $('cOrig'); co.width = S.obr.W; co.height = S.obr.H;
  co.getContext('2d').putImageData(new ImageData(S.obr.data, S.obr.W, S.obr.H), 0, 0);
  obnovVse();
}
function odeber(i) {
  S.fotky.splice(i, 1);
  if (!S.fotky.length) { S.akt = -1; S.obr = null; return obnovVse(); }
  if (i < S.akt) { S.akt--; return vykresliFotky(); }
  if (i === S.akt) return vyber(Math.min(i, S.fotky.length - 1));
  vykresliFotky();
}

/* ---------- vykreslení ---------- */
function obnovVse() {
  const je = !!S.obr;
  $('scena').hidden = !je; $('prazdno').hidden = je; $('porovnani').hidden = !je || !S.porovnat;
  $('cOrig').hidden = !S.porovnat;
  if (je) { nastavScenu(); vykresliVysledek(); }
  vykresliFotky(); vykresliPanel(); vykresliSeznam(); vykresliMetadata();
}
function nastavScenu() {
  if (!S.obr) return;
  const { W, H } = S.obr, obal = $('obal');
  // na úzkém displeji má plocha výšku podle fotky (max. 70 % okna), jinak vyplní volné místo
  const vyska = UZKY.matches ? innerHeight * 0.7 : obal.clientHeight;
  const z = $('zoom').value === 'fit' ? Math.min((obal.clientWidth - 24) / W, (vyska - 24) / H, 2) : +$('zoom').value;
  S.z = Math.max(0.02, z);
  const sc = $('scena'); sc.style.width = Math.round(W * S.z) + 'px'; sc.style.height = Math.round(H * S.z) + 'px';
  const dpr = window.devicePixelRatio || 1, ov = $('cOverlay');
  ov.width = Math.round(W * S.z * dpr); ov.height = Math.round(H * S.z * dpr);
  kresliOverlay();
}
function kresliEmoji(ctx, o, k = 1) {
  const w = o.w * k, h = o.h * k;
  ctx.save();
  ctx.translate((o.x + o.w / 2) * k, (o.y + o.h / 2) * k);
  ctx.scale(w / h, 1);
  ctx.font = `${h * 0.92}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(o.emoji, 0, h * 0.04);
  ctx.restore();
}
function vykresliDo(ctx, obr, obl, k) {
  ctx.putImageData(new ImageData(A.vykresli(obr.data, obr.W, obr.H, obl), obr.W, obr.H), 0, 0);
  for (const o of obl) if (A.aktivni(o) && o.efekt === 'emoji') kresliEmoji(ctx, o, k);
}
function vykresliVysledek() {
  if (!S.obr) return;
  const t0 = performance.now(), c = $('cVysl');
  if (c.width !== S.obr.W || c.height !== S.obr.H) { c.width = S.obr.W; c.height = S.obr.H; }
  vykresliDo(c.getContext('2d'), S.obr, oblasti(), 1);
  S.casVykresleni = performance.now() - t0;
}
let rafVysl = 0;
function planujVysledek() { if (!rafVysl) rafVysl = requestAnimationFrame(() => { rafVysl = 0; vykresliVysledek(); }); }

function barva(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888'; }
function cestaTvaru(ctx, o, k) {
  ctx.beginPath();
  if (o.tvar === 'elipsa') ctx.ellipse((o.x + o.w / 2) * k, (o.y + o.h / 2) * k, o.w / 2 * k, o.h / 2 * k, 0, 0, Math.PI * 2);
  else if (o.tvar === 'stetec') {
    // obrys tahu: silná čára s kulatými konci (kreslí se tahem, ne výplní)
    o.body.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
    if (o.body.length === 1) ctx.lineTo(o.body[0][0] * k + 0.01, o.body[0][1] * k);
  } else ctx.rect(o.x * k, o.y * k, o.w * k, o.h * k);
}
let kurzorStetce = null, novyNahled = null;
function kresliOverlay() {
  const ov = $('cOverlay'), ctx = ov.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ov.width, ov.height);
  if (!S.obr) return;
  const dpr = window.devicePixelRatio || 1, k = S.z * dpr;
  const cAcc = barva('--accent'), cOk = barva('--ok'), cWarn = barva('--warn'), cFaint = barva('--text-faint');
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const o of oblasti()) {
    const vyb = o.id === S.vybrana;
    const c = vyb ? cAcc : o.navrh ? cWarn : o.vypnuta ? cFaint : o.zdroj === 'oblicej' ? cOk : cAcc;
    ctx.setLineDash(o.navrh || o.vypnuta ? [6 * dpr, 4 * dpr] : []);
    if (o.tvar === 'stetec') {
      cestaTvaru(ctx, o, k);
      ctx.globalAlpha = o.navrh || o.vypnuta ? 0.25 : 0.12; ctx.strokeStyle = c; ctx.lineWidth = o.r * 2 * k; ctx.stroke(); ctx.globalAlpha = 1;
      if (vyb) { ctx.lineWidth = 1.5 * dpr; ctx.strokeRect(o.x * k, o.y * k, o.w * k, o.h * k); }
    } else {
      cestaTvaru(ctx, o, k);
      if (o.navrh) { ctx.fillStyle = cWarn; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.lineWidth = (vyb ? 2.5 : 1.6) * dpr; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
      ctx.lineWidth = (vyb ? 1.6 : 1) * dpr; ctx.strokeStyle = c; ctx.stroke();
    }
    ctx.setLineDash([]);
    if ((o.zdroj !== 'rucni' || o.navrh) && (vyb || o.w * S.z >= 44)) { // popisek jen u dost velkých oblastí
      const t = (o.zdroj === 'oblicej' ? '👤' : o.zdroj === 'spz' ? '🚗' : '') + (o.navrh ? ' ' + tr('návrh?') : o.skore ? ' ' + Math.round(o.skore * 100) + ' %' : '');
      ctx.font = `${11 * dpr}px system-ui,sans-serif`;
      const tw = ctx.measureText(t).width + 8 * dpr, tx = o.x * k, ty = Math.max(0, o.y * k - 16 * dpr);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(tx, ty, tw, 15 * dpr);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(t, tx + 4 * dpr, ty + 7.5 * dpr);
    }
    if (vyb) {
      const u = A.uchyty(o), s = 8 * dpr;
      for (const n of A.UCHYTY) {
        ctx.fillStyle = barva('--bg'); ctx.strokeStyle = cAcc; ctx.lineWidth = 1.5 * dpr;
        ctx.fillRect(u[n][0] * k - s / 2, u[n][1] * k - s / 2, s, s); ctx.strokeRect(u[n][0] * k - s / 2, u[n][1] * k - s / 2, s, s);
      }
    }
  }
  if (novyNahled) {
    ctx.setLineDash([5 * dpr, 4 * dpr]); cestaTvaru(ctx, novyNahled, k);
    ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = cAcc; ctx.stroke(); ctx.setLineDash([]);
  }
  if (kurzorStetce && S.nastroj === 'stetec') {
    ctx.beginPath(); ctx.arc(kurzorStetce[0] * k, kurzorStetce[1] * k, nast.stetec / 2 * dpr, 0, Math.PI * 2);
    ctx.lineWidth = 2 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke(); ctx.lineWidth = 1 * dpr; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
}

/* ---------- miniatury, panel, seznam, metadata ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function vykresliFotky() {
  const el = $('fotky');
  el.innerHTML = S.fotky.map((f, i) => {
    const n = f.oblasti.filter(A.aktivni).length, navrhy = f.oblasti.filter(o => o.navrh).length;
    const st = f.hledam ? '⏳ hledám' : (f.stazeno ? '💾 ' : '🕶️ ') + n + (navrhy ? ' · 🚗 ' + navrhy + '?' : '');
    return `<button class="fotka" data-foto="${i}" aria-current="${i === S.akt}" title="${esc(f.nazev)} (${f.W}×${f.H})">
      <img src="${f.nahled}" alt=""><span class="stitek${f.stazeno ? ' hotovo' : ''}">${st}</span>
      <span class="x" role="button" data-odebrat="${i}" title="Odebrat fotku" aria-label="Odebrat fotku">✕</span></button>`;
  }).join('') + '<button class="pridat-fotku" data-prikaz="pridat">➕ Přidat</button>';
}
function vykresliPanel() {
  const o = vybrana(), zdroj = o || nast;
  $('nadpisVlastnosti').textContent = o ? 'Vybraná oblast' : 'Výchozí úprava nových oblastí';
  document.querySelectorAll('[data-efekt]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.efekt === zdroj.efekt)));
  $('sila').value = zdroj.sila; $('silaHodnota').textContent = zdroj.sila + ' %';
  $('radekSila').hidden = zdroj.efekt === 'cerna' || zdroj.efekt === 'emoji';
  $('emojiVyber').hidden = zdroj.efekt !== 'emoji';
  $('emojiVyber').innerHTML = EMOJI.map(e => `<button type="button" data-emoji="${e}" aria-pressed="${e === zdroj.emoji}">${e}</button>`).join('');
  $('radekTvar').hidden = !!o && o.tvar === 'stetec';
  $('tvar').value = o ? o.tvar : nast.tvar;
  $('tvar').title = o ? 'Tvar vybrané oblasti' : 'Tvar oblastí z hledání obličejů';
  $('stetec').value = nast.stetec; $('stetecHodnota').textContent = nast.stetec + ' px';
  $('poznEfekt').textContent = POZN_EFEKT[zdroj.efekt];
}
function popisOblasti(o) {
  const tvar = { obdelnik: '▭', elipsa: '◯', stetec: '🖌️' }[o.tvar];
  const ef = { rozmazat: '🌫️', pixely: '▦', cerna: '⬛', emoji: o.emoji }[o.efekt];
  if (o.zdroj === 'oblicej') return `👤 Obličej${o.skore ? ' ' + Math.round(o.skore * 100) + ' %' : ''} ${ef}`;
  if (o.zdroj === 'spz') return `🚗 SPZ${o.navrh ? ' – návrh' : ''} ${ef}`;
  return `${tvar} ${{ obdelnik: 'Obdélník', elipsa: 'Elipsa', stetec: 'Štětec' }[o.tvar]} ${ef}`;
}
function vykresliSeznam() {
  const obl = oblasti();
  $('pocetOblasti').textContent = obl.length ? `(${obl.filter(A.aktivni).length} / ${obl.length})` : '';
  $('seznamOblasti').innerHTML = obl.length ? obl.map(o => `
    <div class="polozka${o.navrh ? ' navrh' : ''}${o.vypnuta ? ' vyp' : ''}" data-oblast="${o.id}" aria-current="${o.id === S.vybrana}">
      <span class="jm">${popisOblasti(o)}</span>
      ${o.navrh ? `<button data-prijmout="${o.id}" title="Přijmout návrh – oblast se upraví">✅</button>` : `<button data-prepnout="${o.id}" title="${o.vypnuta ? 'Zapnout' : 'Vypnout'} úpravu oblasti">${o.vypnuta ? '🚫' : '👁️'}</button>`}
      <button data-smazat="${o.id}" title="Smazat oblast">🗑️</button></div>`).join('')
    : `<p class="pozn">${S.obr ? 'Zatím žádné oblasti. Najděte obličeje 👤 nebo táhněte myší přes fotku (nástroj ▭ ◯ 🖌️).' : 'Přidejte fotku.'}</p>`;
}
function vykresliMetadata() {
  const f = foto(), el = $('metadata');
  if (!f) { el.innerHTML = '<p class="pozn">Zatím není načtena žádná fotka.</p>'; return; }
  const m = f.meta;
  let h = `<p class="pozn">${esc(f.nazev)} · ${m.format} · ${f.W}×${f.H} px · ${mb(f.velikost)}</p>`;
  if (!m.bloky.length && !m.polozky.length) h += '<div class="stav-meta ok">Původní soubor neobsahuje EXIF ani jiná metadata.</div>';
  else {
    h += `<div class="stav-meta zle"><b>${m.gps ? 'Původní soubor prozrazuje i GPS polohu!' : 'Původní soubor obsahuje metadata.'}</b> Při uložení se všechna odstraní.</div>`;
    if (m.bloky.length) h += '<div class="bloky">' + m.bloky.map(b => `<span>${esc(b)}</span>`).join('') + '</div>';
    if (m.gps) h += `<p class="pozn">📍 Místo pořízení: <a href="https://www.openstreetmap.org/?mlat=${m.gps.lat}&amp;mlon=${m.gps.lon}#map=16/${m.gps.lat}/${m.gps.lon}" target="_blank" rel="noopener">${m.gps.lat}, ${m.gps.lon} – ukázat na mapě</a> (odkaz otevře OpenStreetMap)</p>`;
    if (m.polozky.length) h += '<table class="meta-tab"><tbody>' + m.polozky.map(([k, v, c]) => `<tr${c ? ' class="citlive"' : ''}><td>${esc(k)}</td><td data-i18n="ne">${esc(v)}</td></tr>`).join('') + '</tbody></table>';
  }
  if (f.overeni) h += `<div class="stav-meta ok">${esc(f.overeni)}</div>`;
  el.innerHTML = h;
}

/* ---------- úpravy oblastí ---------- */
function zapamatuj() {
  const f = foto(); if (!f) return;
  f.historie.push(JSON.stringify(f.oblasti)); if (f.historie.length > 80) f.historie.shift();
}
function zmeneno(kresli = true) {
  const f = foto(); if (f) f.stazeno = false;
  if (kresli) vykresliVysledek();
  kresliOverlay(); vykresliSeznam(); vykresliPanel(); vykresliFotky();
}
function zpet() {
  const f = foto(); if (!f || !f.historie.length) return;
  f.oblasti = JSON.parse(f.historie.pop());
  if (!vybrana()) S.vybrana = null;
  zmeneno();
}
function smazOblast(id) {
  const f = foto(); if (!f) return;
  zapamatuj(); f.oblasti = f.oblasti.filter(o => o.id !== id);
  if (S.vybrana === id) S.vybrana = null;
  zmeneno();
}
function upravVybranou(fn) {
  const o = vybrana();
  if (o) { zapamatuj(); fn(o); zmeneno(); }
  else { fn(nast); ulozNast(); vykresliPanel(); }
}
function nastavNastroj(n) {
  S.nastroj = n;
  document.querySelectorAll('[data-nastroj]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nastroj === n)));
  $('cOverlay').classList.toggle('vyber', n === 'vyber');
  if (n !== 'stetec') kurzorStetce = null;
  kresliOverlay();
}

/* ---------- myš / dotyk na plátně ---------- */
const ov = $('cOverlay');
let tah = null;
function bod(e) {
  const r = ov.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * S.obr.W, y: (e.clientY - r.top) / r.height * S.obr.H };
}
const KURZORY = { sz: 'nwse-resize', jv: 'nwse-resize', sv: 'nesw-resize', jz: 'nesw-resize', s: 'ns-resize', j: 'ns-resize', v: 'ew-resize', z: 'ew-resize' };
ov.addEventListener('pointerdown', e => {
  if (!S.obr || e.button > 0) return;
  e.preventDefault(); try { ov.setPointerCapture(e.pointerId); } catch (err) { /* syntetická událost */ }
  const p = bod(e), tol = 9 / S.z, sel = vybrana();
  if (S.nastroj === 'stetec') {
    zapamatuj();
    const o = A.novaOblast({ ...vychozi(), tvar: 'stetec', body: [[p.x, p.y]], r: nast.stetec / 2 / S.z });
    foto().oblasti.push(o); S.vybrana = o.id; tah = { druh: 'stetec', o };
    return zmeneno(false);
  }
  const u = sel && A.najdiUchyt(sel, p.x, p.y, tol);
  if (u) { zapamatuj(); tah = { druh: 'uchyt', o: sel, u, r0: { x: sel.x, y: sel.y, w: sel.w, h: sel.h }, p0: p }; return; }
  const h = A.najdiOblast(oblasti(), p.x, p.y);
  if (h) { S.vybrana = h.id; zapamatuj(); tah = { druh: 'posun', o: h, r0: { x: h.x, y: h.y, w: h.w, h: h.h }, p0: p, pohnuto: false }; return zmeneno(false); }
  if (S.nastroj === 'obdelnik' || S.nastroj === 'elipsa') { tah = { druh: 'novy', p0: p }; return; }
  if (S.vybrana) { S.vybrana = null; zmeneno(false); }
});
ov.addEventListener('pointermove', e => {
  if (!S.obr) return;
  const p = bod(e);
  if (S.nastroj === 'stetec') { kurzorStetce = [p.x, p.y]; if (!tah) kresliOverlay(); }
  if (!tah) {
    const sel = vybrana(), u = sel && A.najdiUchyt(sel, p.x, p.y, 9 / S.z);
    ov.style.cursor = u ? KURZORY[u] : (S.nastroj !== 'stetec' && A.najdiOblast(oblasti(), p.x, p.y)) ? 'move' : '';
    return;
  }
  if (tah.druh === 'stetec') {
    const b = tah.o.body, posl = b[b.length - 1];
    if (Math.hypot(p.x - posl[0], p.y - posl[1]) > tah.o.r / 3) { b.push([p.x, p.y]); A.prepocitejStetec(tah.o); }
  } else if (tah.druh === 'novy') {
    const r = A.normObdelnik(tah.p0.x, tah.p0.y, p.x, p.y);
    novyNahled = { ...r, tvar: S.nastroj };
  } else {
    const dx = p.x - tah.p0.x, dy = p.y - tah.p0.y;
    if (tah.druh === 'posun') { tah.pohnuto = tah.pohnuto || Math.hypot(dx, dy) * S.z > 2; A.nastavObdelnik(tah.o, { ...tah.r0, x: tah.r0.x + dx, y: tah.r0.y + dy }); }
    else A.nastavObdelnik(tah.o, A.tahUchytem(tah.r0, tah.u, dx, dy, 4 / S.z));
  }
  if (S.casVykresleni < 45 && tah.druh !== 'novy') planujVysledek();
  kresliOverlay();
});
function konecTahu() {
  if (!tah) return;
  const t = tah; tah = null;
  if (t.druh === 'novy') {
    const n = novyNahled; novyNahled = null;
    if (n && n.w * S.z >= 4 && n.h * S.z >= 4) {
      zapamatuj();
      const o = A.novaOblast({ ...vychozi(), ...n });
      foto().oblasti.push(o); S.vybrana = o.id;
      return zmeneno();
    }
    return kresliOverlay();
  }
  if (t.druh === 'posun' && !t.pohnuto) { foto().historie.pop(); return; }
  zmeneno();
}
ov.addEventListener('pointerup', konecTahu);
ov.addEventListener('pointercancel', konecTahu);
ov.addEventListener('pointerleave', () => { if (kurzorStetce && !tah) { kurzorStetce = null; kresliOverlay(); } });

/* ---------- detekce ---------- */
async function stahni(url, prubeh) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
  const celkem = +r.headers.get('content-length') || 0;
  if (!r.body || !celkem) return new Uint8Array(await r.arrayBuffer());
  const cteni = r.body.getReader(), kusy = []; let n = 0;
  for (;;) { const { done, value } = await cteni.read(); if (done) break; kusy.push(value); n += value.length; prubeh(n / celkem); }
  const ven = new Uint8Array(n); let o = 0;
  for (const k of kusy) { ven.set(k, o); o += k.length; }
  return ven;
}
function nactiSkript(src) {
  return new Promise((ok, chyba) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => chyba(new Error('Nepodařilo se načíst ' + src)); document.head.appendChild(s);
  });
}
async function pripravAi() {
  if (S.ai) return S.ai;
  prace('Načítám model pro hledání obličejů…', 0);
  if (!window.ort) await nactiSkript(ONNX + 'ort.wasm.min.js');
  let a = 0, b = 0;
  const ukaz = () => prace('Načítám model pro hledání obličejů (jen poprvé, ~12 MB)…', a * 0.9 + b * 0.1);
  const [wasm, model] = await Promise.all([
    stahni(ONNX + 'ort-wasm-simd-threaded.wasm', x => { a = x; ukaz(); }),
    stahni(MODEL, x => { b = x; ukaz(); }),
  ]);
  ort.env.logLevel = 'error';
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL(ONNX, location.href).href;
  ort.env.wasm.wasmBinary = wasm.buffer;
  S.ai = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], logSeverityLevel: 3 });
  return S.ai;
}
/** Najde obličeje ve fotce a přidá je jako oblasti (bez duplicit s už nalezenými). */
async function najdiObliceje(f, obr, popis) {
  const ses = await pripravAi(), plan = A.planDlazdic(obr.W, obr.H), prah = +nast.citlivost;
  let boxy = [];
  for (let i = 0; i < plan.length; i++) {
    prace(`${popis}hledám obličeje… ${Math.round(i / plan.length * 100)} %`, i / plan.length);
    const d = plan[i];
    const t = new ort.Tensor('float32', A.tenzorUltraFace(A.vyrezNa(obr.data, obr.W, obr.H, d, A.UF_W, A.UF_H)), [1, 3, A.UF_H, A.UF_W]);
    const v = await ses.run({ [ses.inputNames[0]]: t });
    boxy = boxy.concat(A.dekodujUltraFace(v.scores.data, v.boxes.data, prah).map(b => A.naObraz(b, d)));
  }
  let nove = 0;
  for (const b of A.slucDetekce(boxy)) {
    const o = A.oblastZObliceje(b, obr.W, obr.H, 0.18, { ...vychozi(), tvar: nast.tvar });
    const ob = { x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h };
    if (f.oblasti.some(k => A.iou({ x0: k.x, y0: k.y, x1: k.x + k.w, y1: k.y + k.h }, ob) > 0.4)) continue;
    f.oblasti.push(o); nove++;
  }
  return nove;
}
function najdiSpz(f, obr) {
  const k = Math.min(1, 1000 / Math.max(obr.W, obr.H)), w = Math.max(1, Math.round(obr.W * k)), h = Math.max(1, Math.round(obr.H * k));
  const g = A.sedotisk(A.vyrezNa(obr.data, obr.W, obr.H, { x: 0, y: 0, w: obr.W, h: obr.H }, w, h), w, h);
  let nove = 0;
  for (const c of A.hledejSpz(g, w, h)) {
    const r = { x: c.x / k, y: c.y / k, w: c.w / k, h: c.h / k };
    const ob = { x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h };
    if (f.oblasti.some(o => A.iou({ x0: o.x, y0: o.y, x1: o.x + o.w, y1: o.y + o.h }, ob) > 0.3)) continue;
    f.oblasti.push(A.novaOblast({ ...vychozi(), efekt: nast.efekt === 'rozmazat' ? 'pixely' : nast.efekt, sila: Math.max(nast.sila, 70), tvar: 'obdelnik', ...r, zdroj: 'spz', skore: c.skore, navrh: true }));
    nove++;
  }
  return nove;
}
/** Hledání v jedné fotce: obličeje a/nebo SPZ. */
async function hledej(f, coHledat, popis = '') {
  const jeAkt = f === foto();
  const obr = jeAkt && S.obr ? S.obr : await dekoduj(f);
  if (jeAkt) zapamatuj();
  f.hledam = true; vykresliFotky();
  let o = 0, s = 0;
  try {
    if (coHledat.spz) s = najdiSpz(f, obr);
    if (coHledat.obliceje) o = await najdiObliceje(f, obr, popis);
    if (coHledat.obliceje && coHledat.spz) f.hledano = true;
  } finally { f.hledam = false; }
  if (o || s) f.stazeno = false;
  if (f === foto()) zmeneno(); else vykresliFotky();
  return { o, s };
}
function hledejVe(fotky, coHledat = { obliceje: true, spz: true }) {
  return vePoradi(async () => {
    let o = 0, s = 0;
    try {
      for (let i = 0; i < fotky.length; i++) {
        if (!S.fotky.includes(fotky[i])) continue;
        const r = await hledej(fotky[i], coHledat, fotky.length > 1 ? `Fotka ${i + 1} / ${fotky.length}: ` : '');
        o += r.o; s += r.s;
      }
    } catch (e) { console.error(e); prace(null); return Dialog.chyba('Hledání selhalo: ' + e.message); }
    prace(null);
    const t = [coHledat.obliceje ? `👤 Nalezené obličeje: ${o}` : '', coHledat.spz ? `🚗 Návrhy SPZ: ${s}` : ''].filter(Boolean).join(' · ');
    oznam(t + ' · ⚠️ Automatika může něco přehlédnout – projděte fotky.');
  });
}
let casOznam = 0;
function oznam(t) {
  prace(t, 1); $('praceProuzek').parentNode.hidden = true;
  clearTimeout(casOznam);
  casOznam = setTimeout(() => { $('praceProuzek').parentNode.hidden = false; prace(null); }, 4500);
}

/* ---------- uložení ---------- */
function toBlob(c, typ, q) { return new Promise((ok, chyba) => c.toBlob(b => (b ? ok(b) : chyba(new Error('Prohlížeč nevytvořil obrázek'))), typ, q)); }
async function vystup(f) {
  const obr = f === foto() && S.obr ? S.obr : await dekoduj(f);
  const c = document.createElement('canvas'); c.width = obr.W; c.height = obr.H;
  const ctx = c.getContext('2d');
  vykresliDo(ctx, obr, f.oblasti, 1);
  let cil = c;
  const max = +nast.maxStrana;
  if (max && Math.max(obr.W, obr.H) > max) {
    const k = max / Math.max(obr.W, obr.H);
    cil = document.createElement('canvas'); cil.width = Math.round(obr.W * k); cil.height = Math.round(obr.H * k);
    const cx = cil.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(c, 0, 0, cil.width, cil.height);
  }
  if (nast.format === 'image/jpeg') { // JPEG nezná průhlednost – podklad bílý
    const b = document.createElement('canvas'); b.width = cil.width; b.height = cil.height;
    const bx = b.getContext('2d'); bx.fillStyle = '#fff'; bx.fillRect(0, 0, b.width, b.height); bx.drawImage(cil, 0, 0); cil = b;
  }
  const blob = await toBlob(cil, nast.format, +nast.kvalita);
  // ověření: přečti výsledný soubor a zkontroluj, že v něm nic nezůstalo
  const m = A.ctiMetadata(await blob.arrayBuffer());
  const typ = (blob.type || nast.format).replace('image/', '').toUpperCase().replace('JPEG', 'JPG');
  const zbylo = m.bloky.filter(b => b !== 'Barevný profil ICC'); // obecný profil sRGB přidává sám prohlížeč – nic neprozradí
  f.overeni = (m.polozky.length || zbylo.length ? '⚠️ Uložený soubor obsahuje: ' + zbylo.join(', ') : '✓ Uložený soubor ověřen: žádná metadata (EXIF, GPS…) v něm nejsou.') + ` (${typ}, ${cil.width}×${cil.height}, ${mb(blob.size)})`;
  return blob;
}
function stahniBlob(blob, nazev) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nazev;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
async function kontrolaPredUlozenim(fotky) {
  const navrhy = fotky.reduce((n, f) => n + f.oblasti.filter(o => o.navrh).length, 0);
  const nehledano = fotky.filter(f => !f.hledano && !f.oblasti.length).length;
  const duvody = [];
  if (navrhy) duvody.push(`${navrhy} nepřijatých návrhů SPZ se NEupraví (přijměte je ✅ nebo smažte).`);
  if (nehledano) duvody.push(`Fotek bez upravené oblasti: ${nehledano} – uloží se jen bez metadat.`);
  if (!duvody.length) return true;
  return Dialog.potvrd(duvody.join('\n') + '\n\nPřesto uložit?');
}
async function stahnout() {
  const f = foto(); if (!f) return Dialog.info('Nejdřív přidejte fotku.');
  if (!(await kontrolaPredUlozenim([f]))) return;
  await vePoradi(async () => {
    try {
      prace('Ukládám…', 0.5); await chvilka();
      const b = await vystup(f);
      stahniBlob(b, A.nazevVystupu(f.nazev, b.type || nast.format, nast.pripona));
      f.stazeno = true;
    } catch (e) { Dialog.chyba('Uložení selhalo: ' + e.message); }
    prace(null); vykresliFotky(); vykresliMetadata();
  });
}
async function stahnoutVse() {
  if (!S.fotky.length) return Dialog.info('Nejdřív přidejte fotky.');
  if (!(await kontrolaPredUlozenim(S.fotky))) return;
  await vePoradi(async () => {
    try {
      const soubory = [];
      for (let i = 0; i < S.fotky.length; i++) {
        const f = S.fotky[i];
        prace(`Zpracovávám ${i + 1} / ${S.fotky.length}: ${f.nazev}`, i / S.fotky.length); await chvilka();
        const b = await vystup(f);
        soubory.push({ nazev: A.nazevVystupu(f.nazev, b.type || nast.format, nast.pripona), data: new Uint8Array(await b.arrayBuffer()) });
        f.stazeno = true;
      }
      const jm = A.unikatniNazvy(soubory.map(s => s.nazev));
      soubory.forEach((s, i) => { s.nazev = jm[i]; });
      prace('Balím ZIP…', 1); await chvilka();
      stahniBlob(new Blob([A.zip(soubory)], { type: 'application/zip' }), 'anonymizovane_fotky.zip');
    } catch (e) { console.error(e); Dialog.chyba('Uložení selhalo: ' + e.message); }
    prace(null); vykresliFotky(); vykresliMetadata();
  });
}

/* ---------- příkazy, nabídky, události ---------- */
function nastavNaVse(fotky) {
  const z = vybrana() || nast;
  for (const f of fotky) {
    if (f === foto()) zapamatuj();
    for (const o of f.oblasti) { o.efekt = z.efekt; o.sila = z.sila; o.emoji = z.emoji; }
    if (f.oblasti.length) f.stazeno = false;
  }
  zmeneno();
}
const PRIKAZY = {
  pridat: () => $('vstupSoubory').click(),
  odebrat: () => { if (S.akt >= 0) odeber(S.akt); },
  odebratVse: async () => { if (S.fotky.length && await Dialog.potvrd('Odebrat všechny fotky ze stránky? Neuložené úpravy se ztratí.')) { S.fotky = []; vyber(-1); } },
  obliceje: () => (foto() ? hledejVe([foto()], { obliceje: true }) : Dialog.info('Nejdřív přidejte fotku.')),
  spz: () => (foto() ? hledejVe([foto()], { spz: true }) : Dialog.info('Nejdřív přidejte fotku.')),
  vseVsude: () => (S.fotky.length ? hledejVe(S.fotky.slice()) : Dialog.info('Nejdřív přidejte fotky.')),
  prijmout: () => { if (!foto()) return; zapamatuj(); foto().oblasti.forEach(o => { o.navrh = false; }); zmeneno(); },
  smazatAuto: () => { if (!foto()) return; zapamatuj(); foto().oblasti = foto().oblasti.filter(o => o.zdroj === 'rucni'); S.vybrana = null; zmeneno(); },
  smazatVse: () => { if (!foto()) return; zapamatuj(); foto().oblasti = []; S.vybrana = null; zmeneno(); },
  zpet,
  smazat: () => { if (S.vybrana) smazOblast(S.vybrana); },
  porovnat: () => {
    S.porovnat = !S.porovnat; $('tlPorovnat').setAttribute('aria-pressed', String(S.porovnat));
    $('cOrig').hidden = !S.porovnat; $('porovnani').hidden = !S.porovnat || !S.obr;
  },
  stahnout, stahnoutVse,
  naVseOblasti: () => nastavNaVse(foto() ? [foto()] : []),
  naVseFotky: () => nastavNaVse(S.fotky),
  napoveda: () => $('dlgNapoveda').showModal(),
};
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
  const t = e.target;
  const p = t.closest('[data-prikaz]');
  if (p) { e.stopPropagation(); zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
  if (!t.closest('.nabidka')) zavriNabidky();
  const od = t.closest('[data-odebrat]');
  if (od) { e.stopPropagation(); return odeber(+od.dataset.odebrat); }
  const fo = t.closest('[data-foto]');
  if (fo) { const i = +fo.dataset.foto; if (i !== S.akt) vePoradi(() => vyber(i)); return; }
  const n = t.closest('[data-nastroj]');
  if (n) return nastavNastroj(n.dataset.nastroj);
  const ef = t.closest('[data-efekt]');
  if (ef) return upravVybranou(o => { o.efekt = ef.dataset.efekt; });
  const em = t.closest('[data-emoji]');
  if (em) return upravVybranou(o => { o.emoji = em.dataset.emoji; });
  const pj = t.closest('[data-prijmout]');
  if (pj) { zapamatuj(); oblasti().find(o => o.id === pj.dataset.prijmout).navrh = false; return zmeneno(); }
  const pr = t.closest('[data-prepnout]');
  if (pr) { zapamatuj(); const o = oblasti().find(x => x.id === pr.dataset.prepnout); o.vypnuta = !o.vypnuta; return zmeneno(); }
  const sm = t.closest('[data-smazat]');
  if (sm) return smazOblast(sm.dataset.smazat);
  const ob = t.closest('[data-oblast]');
  if (ob) { S.vybrana = ob.dataset.oblast; zmeneno(false); }
});
// síla: jeden krok Zpět za celý tah posuvníkem
let silaZapamatovana = false;
$('sila').addEventListener('input', () => {
  const v = +$('sila').value, o = vybrana();
  $('silaHodnota').textContent = v + ' %';
  if (o) { if (!silaZapamatovana) { zapamatuj(); silaZapamatovana = true; } o.sila = v; foto().stazeno = false; planujVysledek(); vykresliSeznam(); }
  else { nast.sila = v; ulozNast(); }
});
$('sila').addEventListener('change', () => { silaZapamatovana = false; vykresliFotky(); });
$('tvar').addEventListener('change', () => upravVybranou(o => { o.tvar = $('tvar').value; }));
$('stetec').addEventListener('input', () => { nast.stetec = +$('stetec').value; $('stetecHodnota').textContent = nast.stetec + ' px'; ulozNast(); });
$('rozdel').addEventListener('input', () => { $('cOrig').style.clipPath = `inset(0 ${100 - +$('rozdel').value}% 0 0)`; });
$('zoom').addEventListener('change', nastavScenu);
for (const id of ['format', 'kvalita', 'maxStrana', 'pripona', 'citlivost']) {
  $(id).value = nast[id];
  $(id).addEventListener('change', () => { nast[id] = $(id).value.trim(); ulozNast(); });
}
$('auto').checked = nast.auto;
$('auto').addEventListener('change', () => { nast.auto = $('auto').checked; ulozNast(); });
$('format').addEventListener('change', () => { $('kvalita').disabled = nast.format === 'image/png'; });
$('kvalita').disabled = nast.format === 'image/png';
$('vstupSoubory').addEventListener('change', e => { pridejSoubory(e.target.files); e.target.value = ''; });

// přetažení a vložení
let pocitadloDrag = 0;
addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { pocitadloDrag++; $('drop').classList.add('nad'); } });
addEventListener('dragleave', () => { if (--pocitadloDrag <= 0) { pocitadloDrag = 0; $('drop').classList.remove('nad'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); pocitadloDrag = 0; $('drop').classList.remove('nad'); if (e.dataTransfer.files.length) pridejSoubory(e.dataTransfer.files); });
addEventListener('paste', e => { const f = [...(e.clipboardData ? e.clipboardData.files : [])]; if (f.length) pridejSoubory(f.map((s, i) => (s.name && s.name !== 'image.png' ? s : new File([s], `vlozeno_${Date.now()}_${i}.png`, { type: s.type })))); });

addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea') || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); return zpet(); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'delete' || k === 'backspace') { if (S.vybrana) { e.preventDefault(); smazOblast(S.vybrana); } return; }
  if (k === 'escape') { if (S.vybrana) { S.vybrana = null; zmeneno(false); } return; }
  const sip = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
  if (sip && vybrana()) {
    e.preventDefault(); zapamatuj();
    const d = (e.shiftKey ? 10 : 1) / S.z; A.posun(vybrana(), sip[0] * d, sip[1] * d); return zmeneno();
  }
  const n = { v: 'vyber', r: 'obdelnik', e: 'elipsa', b: 'stetec' }[k];
  if (n) nastavNastroj(n);
});
addEventListener('beforeunload', e => { if (S.fotky.some(f => f.oblasti.length && !f.stazeno)) { e.preventDefault(); e.returnValue = ''; } });
new ResizeObserver(() => { if (S.obr && $('zoom').value === 'fit') nastavScenu(); }).observe($('obal'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', kresliOverlay);
new MutationObserver(kresliOverlay).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

window.ANON_APP = { S, pridejSoubory, hledejVe, vyber, vystup, nast };
obnovVse();
})();
